/**
 * Event-Driven Business Notification Triggers
 *
 * Firestore triggers that send notifications when specific
 * events occur (new favourite, CTA click).
 *
 * Part of the Automated Engagement System - Part B (Phase 5)
 */

import * as functions from "firebase-functions/v1";
import { getDb } from "../utils/firebase";
import { Timestamp } from "firebase-admin/firestore"
import {
  getBusinessInfo,
  sendBusinessNotification,
  wasRecentlySent,
  isEmailNotificationEnabled,
} from "./emailSender";
import {
  getNewFavouriteEmail,
  getCtaClickedEmail,
} from "./emailTemplates";

// ============================================================================
// New Favourite Trigger
// ============================================================================

/**
 * Trigger when a user adds a business to favourites
 * Listens to updates on user documents and detects changes to favourite_businesses array
 */
export const onNewFavourite = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const previousFavourites: string[] = before.favourite_businesses || [];
    const currentFavourites: string[] = after.favourite_businesses || [];

    // Find newly added business IDs
    const newlyAdded = currentFavourites.filter(
      (id) => !previousFavourites.includes(id)
    );

    if (newlyAdded.length === 0) {
      return null;
    }

    const userId = context.params.userId;
    const rank = after.rank.split("_");
    const userRank = rank[2] + " de la " + rank[0];

    console.log(`User ${userId} added ${newlyAdded.length} new favourite(s)`);

    try {
      for (const businessId of newlyAdded) {
        // Check if email notifications are enabled
        if (!(await isEmailNotificationEnabled(businessId))) {
          console.log(`Email notifications disabled for ${businessId}`);
          continue;
        }

        // Check if we recently sent a new_favourite notification (24 hour cooldown)
        // This prevents spamming if multiple users favourite in quick succession
        if (await wasRecentlySent(businessId, "new_favourite", 24)) {
          console.log(`Recently sent new_favourite to ${businessId}, skipping`);
          continue;
        }

        const business = await getBusinessInfo(businessId);
        if (!business) {
          console.log(`Business not found: ${businessId}`);
          continue;
        }

        const emailContent = getNewFavouriteEmail(business, {
          user_rank: userRank,
        });

        await sendBusinessNotification(
          business,
          "new_favourite",
          emailContent,
          { user_rank: userRank }
        );

        console.log(`Sent new favourite notification for business: ${businessId}`);
      }

      return null;
    } catch (error) {
      console.error("Error sending new favourite notification:", error);
      return null;
    }
  });

// ============================================================================
// CTA Click Trigger
// ============================================================================

/**
 * Trigger when a user clicks on a business CTA (phone, whatsapp, website, navigation)
 * Listens to analytics_events collection for click events
 */
export const onCtaClick = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("analytics_events/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();

    // Only process click events
    if (event.event_type !== "click") {
      return null;
    }

    // Must have a business_id and cta_type
    if (!event.business_id || !event.cta_type) {
      return null;
    }

    const businessId = event.business_id;
    const ctaType = event.cta_type as "phone" | "whatsapp" | "website" | "navigation";

    // Validate CTA type
    if (!["phone", "whatsapp", "website", "navigation"].includes(ctaType)) {
      return null;
    }

    console.log(`CTA click (${ctaType}) for business: ${businessId}`);

    try {
      // Check if email notifications are enabled
      if (!(await isEmailNotificationEnabled(businessId))) {
        console.log(`Email notifications disabled for ${businessId}`);
        return null;
      }

      // Check if we recently sent a cta_clicked notification (2 hour cooldown)
      if (await wasRecentlySent(businessId, "cta_clicked", 2)) {
        console.log(`Recently sent cta_clicked to ${businessId}, skipping`);
        return null;
      }

      const business = await getBusinessInfo(businessId);
      if (!business) {
        console.log(`Business not found: ${businessId}`);
        return null;
      }

      const emailContent = getCtaClickedEmail(business, { cta_type: ctaType });

      await sendBusinessNotification(
        business,
        "cta_clicked",
        emailContent,
        { cta_type: ctaType }
      );

      return null;
    } catch (error) {
      console.error("Error sending CTA click notification:", error);
      return null;
    }
  });

// ============================================================================
// Alternative: Batch CTA clicks trigger
// ============================================================================

/**
 * Alternative approach: Scheduled check for CTA clicks
 * Schedule: Every 6 hours
 */
export const checkCtaClicks = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 300 })
  .pubsub.schedule("0 */6 * * *")
  .timeZone("America/Bogota")
  .onRun(async (context) => {
    console.log("Checking for CTA clicks...");

    // Check clicks from the last 6 hours
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    try {
      const recentClicks = await getDb()
        .collection("analytics_events")
        .where("event_type", "==", "click")
        .where("timestamp", ">", Timestamp.fromDate(sixHoursAgo))
        .get();

      // Group by business, keep track of CTA types
      const businessClicks = new Map<
        string,
        { types: Set<string>; count: number }
      >();

      for (const doc of recentClicks.docs) {
        const event = doc.data();
        if (event.business_id && event.cta_type) {
          if (!businessClicks.has(event.business_id)) {
            businessClicks.set(event.business_id, {
              types: new Set(),
              count: 0,
            });
          }
          const clicks = businessClicks.get(event.business_id)!;
          clicks.types.add(event.cta_type);
          clicks.count++;
        }
      }

      console.log(`Found clicks for ${businessClicks.size} businesses`);

      let sent = 0;

      for (const [businessId, clicks] of businessClicks) {
        // Skip if recently notified
        if (await wasRecentlySent(businessId, "cta_clicked", 6)) {
          continue;
        }

        if (!(await isEmailNotificationEnabled(businessId))) {
          continue;
        }

        const business = await getBusinessInfo(businessId);
        if (!business) continue;

        // Use the most relevant CTA type
        const ctaType = (clicks.types.has("phone") ? "phone" :
          clicks.types.has("whatsapp") ? "whatsapp" :
            clicks.types.has("website") ? "website" : "navigation") as
          "phone" | "whatsapp" | "website" | "navigation";

        const emailContent = getCtaClickedEmail(business, { cta_type: ctaType });

        await sendBusinessNotification(
          business,
          "cta_clicked",
          emailContent,
          { cta_type: ctaType, count: clicks.count }
        );

        sent++;
      }

      console.log(`CTA clicks check complete: ${sent} notifications sent`);
      return null;
    } catch (error) {
      console.error("Error checking CTA clicks:", error);
      return null;
    }
  });
