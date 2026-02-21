/**
 * Business Notification Email Sender
 *
 * Handles sending business notification emails via Resend
 * and storing notification records in Firestore.
 *
 * Part of the Automated Engagement System - Part B (Phase 5)
 */

import { getDb } from "../utils/firebase";
import { Timestamp, FieldValue } from "firebase-admin/firestore"
import { Resend } from "resend";
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  BusinessNotificationType,
  BusinessInfo,
} from "./emailTemplates";

// ============================================================================
// Types
// ============================================================================

export interface BusinessNotificationRecord {
  business_id: string;
  notification_type: BusinessNotificationType;
  trigger_data: Record<string, any>;
  status: "pending" | "sent" | "failed";
  email_content: {
    subject: string;
    body_html: string;
  };
  created_at: Timestamp;
  sent_at?: Timestamp;
  error_message?: string;
  recipient_email: string;
  owner_name: string;
  business_name: string;
}

// ============================================================================
// Resend Client
// ============================================================================

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

// ============================================================================
// Notification Helpers
// ============================================================================

/**
 * Check if a notification was recently sent to avoid duplicates
 */
export async function wasRecentlySent(
  businessId: string,
  notificationType: BusinessNotificationType,
  hoursAgo: number = 24
): Promise<boolean> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

  const recentNotifications = await getDb()
    .collection("business_notifications")
    .where("business_id", "==", businessId)
    .where("notification_type", "==", notificationType)
    .where("status", "==", "sent")
    .where("sent_at", ">", Timestamp.fromDate(cutoffTime))
    .limit(1)
    .get();

  return !recentNotifications.empty;
}

/**
 * Check if the business has email notifications enabled
 */
export async function isEmailNotificationEnabled(
  businessId: string
): Promise<boolean> {
  const businessDoc = await getDb().collection("businesses").doc(businessId).get();
  if (!businessDoc.exists) return false;

  const data = businessDoc.data();
  // Default to true if not explicitly set to false
  return data?.email_notifications_enabled !== false;
}

/**
 * Get business information for notifications
 */
export async function getBusinessInfo(
  businessId: string
): Promise<BusinessInfo | null> {
  const businessDoc = await getDb().collection("businesses").doc(businessId).get();
  if (!businessDoc.exists) return null;

  const data = businessDoc.data()!;

  // Get owner email - could be in business doc or need to look up user
  let ownerEmail = data.owner_email || data.email;
  let ownerName = data.owner_name || data.contact_name || "Empresario";

  // If no email on business, try to find the owner user
  if (!ownerEmail && data.owner_uid) {
    const userDoc = await getDb().collection("users").doc(data.owner_uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data()!;
      ownerEmail = userData.email;
      ownerName = userData.first_name
        ? `${userData.first_name} ${userData.last_name || ""}`.trim()
        : ownerName;
    }
  }

  if (!ownerEmail) return null;

  return {
    id: businessId,
    name: data.name || "Tu negocio",
    owner_name: ownerName,
    owner_email: ownerEmail,
  };
}

// ============================================================================
// Send Notification
// ============================================================================

/**
 * Send a business notification email and record it in Firestore
 */
export async function sendBusinessNotification(
  business: BusinessInfo,
  notificationType: BusinessNotificationType,
  emailContent: { subject: string; html: string },
  triggerData: Record<string, any> = {}
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  // Create notification record first (pending status)
  const notificationRecord: BusinessNotificationRecord = {
    business_id: business.id,
    notification_type: notificationType,
    trigger_data: triggerData,
    status: "pending",
    email_content: {
      subject: emailContent.subject,
      body_html: emailContent.html,
    },
    created_at: Timestamp.now(),
    recipient_email: business.owner_email,
    owner_name: business.owner_name,
    business_name: business.name,
  };

  const notificationRef = await getDb()
    .collection("business_notifications")
    .add(notificationRecord);

  try {
    const resend = getResendClient();

    await resend.emails.send({
      from: EMAIL_FROM,
      to: business.owner_email,
      replyTo: EMAIL_REPLY_TO,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    // Update notification as sent
    await notificationRef.update({
      status: "sent",
      sent_at: FieldValue.serverTimestamp(),
    });

    console.log(
      `Business notification sent: ${notificationType} to ${business.owner_email}`
    );

    return { success: true, notificationId: notificationRef.id };
  } catch (error) {
    console.error(
      `Failed to send business notification: ${notificationType}`,
      error
    );

    // Update notification as failed
    await notificationRef.update({
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      notificationId: notificationRef.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Batch Notification Helpers
// ============================================================================

/**
 * Get all active businesses for scheduled notifications
 */
export async function getActiveBusinesses(): Promise<BusinessInfo[]> {
  const businessesSnapshot = await getDb()
    .collection("businesses")
    .where("subscription.status", "in", ["active", "trial"])
    .get();

  const businesses: BusinessInfo[] = [];

  for (const doc of businessesSnapshot.docs) {
    const info = await getBusinessInfo(doc.id);
    if (info) {
      businesses.push(info);
    }
  }

  return businesses;
}

/**
 * Get business statistics for a given period
 */
export async function getBusinessStats(
  businessId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  views: number;
  saves: number;
  clicks: number;
  topPromotions: Array<{ title: string; views: number }>;
}> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  // Get analytics events for this business
  const eventsSnapshot = await getDb()
    .collection("analytics_events")
    .where("business_id", "==", businessId)
    .where("timestamp", ">=", startTimestamp)
    .where("timestamp", "<=", endTimestamp)
    .get();

  let views = 0;
  let saves = 0;
  let clicks = 0;
  const promotionViews = new Map<string, number>();

  for (const doc of eventsSnapshot.docs) {
    const event = doc.data();

    switch (event.event_type) {
      case "view":
        views++;
        if (event.promotion_id) {
          promotionViews.set(
            event.promotion_id,
            (promotionViews.get(event.promotion_id) || 0) + 1
          );
        }
        break;
      case "save":
        saves++;
        break;
      case "click":
        clicks++;
        break;
    }
  }

  // Get top promotions
  const topPromotionIds = [...promotionViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const topPromotions: Array<{ title: string; views: number }> = [];

  for (const [promoId, viewCount] of topPromotionIds) {
    const promoDoc = await getDb().collection("promotions").doc(promoId).get();
    if (promoDoc.exists) {
      topPromotions.push({
        title: promoDoc.data()?.title || "Promoción",
        views: viewCount,
      });
    }
  }

  return { views, saves, clicks, topPromotions };
}

/**
 * Check business profile completeness
 */
export async function checkProfileCompleteness(
  businessId: string
): Promise<string[]> {
  const businessDoc = await getDb().collection("businesses").doc(businessId).get();
  if (!businessDoc.exists) return [];

  const data = businessDoc.data()!;
  const missingFields: string[] = [];

  if (!data.description || data.description.length < 10) {
    missingFields.push("description");
  }
  if (!data.featured_image) {
    missingFields.push("featured_image");
  }
  if (!data.phone_number) {
    missingFields.push("phone_number");
  }
  if (!data.website) {
    missingFields.push("website");
  }

  return missingFields;
}

/**
 * Check if business has active promotions
 */
export async function hasActivePromotions(businessId: string): Promise<boolean> {
  const promotionsSnapshot = await getDb()
    .collection("promotions")
    .where("business_id", "==", businessId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  return !promotionsSnapshot.empty;
}

/**
 * Get expired promotions for a business
 */
export async function getExpiredPromotions(
  businessId: string,
  since: Date
): Promise<Array<{ id: string; title: string }>> {
  const sinceTimestamp = Timestamp.fromDate(since);

  const expiredSnapshot = await getDb()
    .collection("promotions")
    .where("business_id", "==", businessId)
    .where("status", "==", "expired")
    .where("expired_at", ">", sinceTimestamp)
    .get();

  return expiredSnapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title || "Promoción",
  }));
}
