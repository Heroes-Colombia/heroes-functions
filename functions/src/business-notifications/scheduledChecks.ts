/**
 * Scheduled Business Notification Checks
 *
 * Scheduled functions that check for conditions requiring
 * business notifications (expired promos, no promos, incomplete profile).
 *
 * Part of the Automated Engagement System - Part B (Phase 5)
 */

import * as functions from "firebase-functions/v1";
import { admin, getDb } from "../utils/firebase";
import {
  getBusinessInfo,
  sendBusinessNotification,
  wasRecentlySent,
  isEmailNotificationEnabled,
  getActiveBusinesses,
  checkProfileCompleteness,
  hasActivePromotions,
  getExpiredPromotions,
} from "./emailSender";
import {
  getPromotionExpiredEmail,
  getNoActivePromotionsEmail,
  getIncompleteProfileEmail,
} from "./emailTemplates";

// ============================================================================
// Promotion Expired Check
// ============================================================================

/**
 * Check for recently expired promotions and notify business owners
 * Schedule: Every day at 9 AM Colombia time
 */
export const checkExpiredPromotions = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 300 })
  .pubsub.schedule("0 9 * * *")
  .timeZone("America/Bogota")
  .onRun(async (context) => {
    console.log("Starting expired promotions check...");

    // Check promotions that expired in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      // Get all businesses with recently expired promotions
      const expiredPromosSnapshot = await getDb()
        .collection("promotions")
        .where("status", "==", "expired")
        .where("expired_at", ">", admin.firestore.Timestamp.fromDate(yesterday))
        .get();

      // Group by business
      const businessPromotions = new Map<
        string,
        Array<{ id: string; title: string }>
      >();

      for (const doc of expiredPromosSnapshot.docs) {
        const promo = doc.data();
        const businessId = promo.business_id;

        if (!businessPromotions.has(businessId)) {
          businessPromotions.set(businessId, []);
        }
        businessPromotions.get(businessId)!.push({
          id: doc.id,
          title: promo.title || "Promoción",
        });
      }

      console.log(
        `Found ${businessPromotions.size} businesses with expired promotions`
      );

      // Send notifications
      let sent = 0;
      let skipped = 0;

      for (const [businessId, promotions] of businessPromotions) {
        // Check if email notifications are enabled
        if (!(await isEmailNotificationEnabled(businessId))) {
          skipped++;
          continue;
        }

        // Check if we recently sent this notification
        if (await wasRecentlySent(businessId, "promotion_expired", 48)) {
          skipped++;
          continue;
        }

        const business = await getBusinessInfo(businessId);
        if (!business) {
          skipped++;
          continue;
        }

        // Send notification for the first expired promotion
        const firstExpired = promotions[0];
        const emailContent = getPromotionExpiredEmail(business, {
          promotion_id: firstExpired.id,
          promotion_title: firstExpired.title,
        });

        const result = await sendBusinessNotification(
          business,
          "promotion_expired",
          emailContent,
          { promotion_id: firstExpired.id, promotion_title: firstExpired.title }
        );

        if (result.success) {
          sent++;
        }
      }

      console.log(
        `Expired promotions check complete: ${sent} sent, ${skipped} skipped`
      );
      return null;
    } catch (error) {
      console.error("Error checking expired promotions:", error);
      throw error;
    }
  });

// ============================================================================
// No Active Promotions Check
// ============================================================================

/**
 * Check for businesses with no active promotions
 * Schedule: Every Monday at 11 AM Colombia time
 */
export const checkNoActivePromotions = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 300 })
  .pubsub.schedule("0 11 * * 1")
  .timeZone("America/Bogota")
  .onRun(async (context) => {
    console.log("Starting no active promotions check...");

    try {
      const businesses = await getActiveBusinesses();
      console.log(`Checking ${businesses.length} active businesses`);

      let sent = 0;
      let skipped = 0;

      for (const business of businesses) {
        // Check if email notifications are enabled
        if (!(await isEmailNotificationEnabled(business.id))) {
          skipped++;
          continue;
        }

        // Check if we recently sent this notification (7 days cooldown)
        if (await wasRecentlySent(business.id, "no_active_promotions", 168)) {
          skipped++;
          continue;
        }

        // Check if business has active promotions
        if (await hasActivePromotions(business.id)) {
          skipped++;
          continue;
        }

        const emailContent = getNoActivePromotionsEmail(business);

        const result = await sendBusinessNotification(
          business,
          "no_active_promotions",
          emailContent
        );

        if (result.success) {
          sent++;
        }
      }

      console.log(
        `No active promotions check complete: ${sent} sent, ${skipped} skipped`
      );
      return null;
    } catch (error) {
      console.error("Error checking no active promotions:", error);
      throw error;
    }
  });

// ============================================================================
// Incomplete Profile Check
// ============================================================================

/**
 * Check for businesses with incomplete profiles
 * Schedule: Every Wednesday at 11 AM Colombia time
 */
export const checkIncompleteProfiles = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 300 })
  .pubsub.schedule("0 11 * * 3")
  .timeZone("America/Bogota")
  .onRun(async (context) => {
    console.log("Starting incomplete profile check...");

    try {
      const businesses = await getActiveBusinesses();
      console.log(`Checking ${businesses.length} active businesses`);

      let sent = 0;
      let skipped = 0;

      for (const business of businesses) {
        // Check if email notifications are enabled
        if (!(await isEmailNotificationEnabled(business.id))) {
          skipped++;
          continue;
        }

        // Check if we recently sent this notification (14 days cooldown)
        if (await wasRecentlySent(business.id, "incomplete_profile", 336)) {
          skipped++;
          continue;
        }

        // Check profile completeness
        const missingFields = await checkProfileCompleteness(business.id);
        if (missingFields.length === 0) {
          skipped++;
          continue;
        }

        const emailContent = getIncompleteProfileEmail(business, {
          missing_fields: missingFields,
        });

        const result = await sendBusinessNotification(
          business,
          "incomplete_profile",
          emailContent,
          { missing_fields: missingFields }
        );

        if (result.success) {
          sent++;
        }
      }

      console.log(
        `Incomplete profile check complete: ${sent} sent, ${skipped} skipped`
      );
      return null;
    } catch (error) {
      console.error("Error checking incomplete profiles:", error);
      throw error;
    }
  });

// ============================================================================
// Manual Trigger Helpers (for testing)
// ============================================================================

/**
 * Manually trigger expired promotions check
 */
export async function manualCheckExpiredPromotions(): Promise<{
  sent: number;
  skipped: number;
}> {
  console.log("Manual expired promotions check...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const expiredPromosSnapshot = await getDb()
    .collection("promotions")
    .where("status", "==", "expired")
    .where("expired_at", ">", admin.firestore.Timestamp.fromDate(yesterday))
    .get();

  const businessPromotions = new Map<
    string,
    Array<{ id: string; title: string }>
  >();

  for (const doc of expiredPromosSnapshot.docs) {
    const promo = doc.data();
    const businessId = promo.business_id;

    if (!businessPromotions.has(businessId)) {
      businessPromotions.set(businessId, []);
    }
    businessPromotions.get(businessId)!.push({
      id: doc.id,
      title: promo.title || "Promoción",
    });
  }

  let sent = 0;
  let skipped = 0;

  for (const [businessId, promotions] of businessPromotions) {
    if (!(await isEmailNotificationEnabled(businessId))) {
      skipped++;
      continue;
    }

    const business = await getBusinessInfo(businessId);
    if (!business) {
      skipped++;
      continue;
    }

    const firstExpired = promotions[0];
    const emailContent = getPromotionExpiredEmail(business, {
      promotion_id: firstExpired.id,
      promotion_title: firstExpired.title,
    });

    const result = await sendBusinessNotification(
      business,
      "promotion_expired",
      emailContent,
      { promotion_id: firstExpired.id, promotion_title: firstExpired.title }
    );

    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

/**
 * Manually check a specific business
 */
export async function checkBusinessNotifications(
  businessId: string
): Promise<{
  hasActivePromotions: boolean;
  missingFields: string[];
  expiredPromotions: Array<{ id: string; title: string }>;
}> {
  const hasPromos = await hasActivePromotions(businessId);
  const missingFields = await checkProfileCompleteness(businessId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 7);
  const expiredPromotions = await getExpiredPromotions(businessId, yesterday);

  return {
    hasActivePromotions: hasPromos,
    missingFields,
    expiredPromotions,
  };
}
