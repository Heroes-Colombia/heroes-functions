/**
 * Batch Sending Helper for Campaign Delivery
 *
 * Handles sending push notifications via FCM and emails via Resend
 * in batches to handle large numbers of recipients.
 *
 * Part of the Automated Engagement System - Part A (Phase 4)
 */

import { admin, getDb } from "../../utils/firebase";
import { Resend } from "resend";
import { PushContent, EmailContent } from "./claudeApi";
import { Timestamp, FieldValue } from "firebase-admin/firestore"

// ============================================================================
// Types
// ============================================================================

export interface ActiveUser {
  id: string;
  email: string;
  device_notification_token?: string;
  first_name?: string;
  last_name?: string;
}

export interface SendResult {
  total_recipients: number;
  push_sent: number;
  push_failed: number;
  email_sent: number;
  email_failed: number;
  failed_tokens: string[];
  failed_emails: string[];
}

export interface EmailTemplateData {
  subject: string;
  preheader: string;
  sections: Array<{
    headline: string;
    promotions: PromotionData[];
    cta_text: string;
    cta_url: string;
  }>;
  footer_text: string;
}

export interface PromotionData {
  id: string;
  title: string;
  percentage: number;
  business_name: string;
  featured_image?: string;
}

// ============================================================================
// Configuration
// ============================================================================

// Email batch size for Resend
const EMAIL_BATCH_SIZE = 100;

// Resend email configuration
const EMAIL_FROM = "Heroes Colombia <noreply@heroescolombia.com>";
const EMAIL_REPLY_TO = "jonathan@heroescolombia.com";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initialize Resend client with API key from environment
 */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

/**
 * Fetch all active users who can receive notifications
 */
export async function getActiveUsers(): Promise<ActiveUser[]> {
  const usersSnapshot = await getDb()
    .collection("users")
    .where("status", "==", "active")
    .where("user_type", "!=", "business_team")
    .get();

  return usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    email: doc.data().email || "",
    device_notification_token: doc.data().device_notification_token,
    first_name: doc.data().first_last_name,
    last_name: doc.data().last_name,
  }));
}

/**
 * Get users eligible for push notifications
 */
export function getPushEligibleUsers(users: ActiveUser[]): ActiveUser[] {
  return users.filter(
    (user) =>
      user.device_notification_token &&
      user.device_notification_token.length > 0
  );
}

/**
 * Get users eligible for email notifications
 */
export function getEmailEligibleUsers(users: ActiveUser[]): ActiveUser[] {
  return users.filter(
    (user) =>
      user.email &&
      user.email.length > 0 &&
      user.email.includes("@")
  );
}

// ============================================================================
// Push Notification Sending
// ============================================================================

// FCM topic all consumer users are subscribed to on login
const CONSUMER_TOPIC = "user";

/**
 * Send push notifications to all users via the "user" FCM topic.
 * Every consumer subscribes to this topic on login in the Flutter app,
 * so FCM handles fan-out without needing individual tokens.
 */
export async function sendPushNotifications(
  content: PushContent,
  users: ActiveUser[]
): Promise<{ sent: number; failed: number; failedTokens: string[] }> {
  console.log(`Sending push notification to topic "${CONSUMER_TOPIC}"...`);

  await admin.messaging().send({
    notification: {
      title: content.title,
      body: content.body,
    },
    data: {
      campaign_type: "consumer",
    },
    topic: CONSUMER_TOPIC,
  });

  console.log(`Push notification sent to topic "${CONSUMER_TOPIC}"`);

  // Topic sends deliver to all subscribers — report total active users as recipients
  return { sent: users.length, failed: 0, failedTokens: [] };
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Generate HTML email from campaign content
 */
export function generateEmailHtml(
  templateData: EmailTemplateData
): string {
  const sectionsHtml = templateData.sections
    .map((section) => {
      const promotionsHtml = section.promotions
        .map((promo) => {
          return `
          <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            ${promo.featured_image ? `<img src="${promo.featured_image}" alt="${promo.title}" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;" />` : ""}
            <h4 style="margin: 0 0 5px 0; color: #1a1a1a;">${promo.title}</h4>
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">${promo.business_name}</p>
            <p style="margin: 0; color: #22c55e; font-weight: bold; font-size: 18px;">${promo.percentage}% descuento</p>
          </div>
        `;
        })
        .join("");

      return `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 20px;">${section.headline}</h2>
          ${promotionsHtml}
          <a href="${section.cta_url}" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${section.cta_text}
          </a>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Heroes Colombia</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: #1a1a1a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 24px;">🇨🇴 Heroes Colombia</h1>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          ${sectionsHtml}

          <!-- Footer -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="color: #666; font-size: 14px; margin: 0;">${templateData.footer_text}</p>
            <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
              Heroes Colombia - Honrando a quienes sirven 🇨🇴
            </p>
            <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
              <a href="https://heroescolombia.com/unsubscribe" style="color: #999;">Cancelar suscripción</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Fetch promotion data for email template
 */
export async function fetchPromotionData(
  promotionIds: string[]
): Promise<Map<string, PromotionData>> {
  const promotionsMap = new Map<string, PromotionData>();

  if (promotionIds.length === 0) {
    return promotionsMap;
  }

  // Firestore "in" queries support max 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < promotionIds.length; i += 30) {
    chunks.push(promotionIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const snapshot = await getDb()
      .collection("promotions")
      .where(admin.firestore.FieldPath.documentId(), "in", chunk)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch business name
      let businessName = "Business";
      if (data.business_id) {
        try {
          const businessDoc = await getDb()
            .collection("businesses")
            .doc(data.business_id)
            .get();
          if (businessDoc.exists) {
            businessName = businessDoc.data()?.name || "Business";
          }
        } catch (e) {
          console.error("Error fetching business:", e);
        }
      }

      promotionsMap.set(doc.id, {
        id: doc.id,
        title: data.title || "Promoción",
        percentage: data.percentage || data.discount_percentage || 0,
        business_name: businessName,
        featured_image: data.featured_image,
      });
    }
  }

  return promotionsMap;
}

/**
 * Send email campaign to all eligible users
 */
export async function sendEmailCampaign(
  content: EmailContent,
  users: ActiveUser[],
  promotionsMap: Map<string, PromotionData>
): Promise<{ sent: number; failed: number; failedEmails: string[] }> {
  const eligibleUsers = getEmailEligibleUsers(users);

  if (eligibleUsers.length === 0) {
    console.log("No eligible users for email campaign");
    return { sent: 0, failed: 0, failedEmails: [] };
  }

  console.log(`Sending email campaign to ${eligibleUsers.length} users...`);

  const resend = getResendClient();

  // Build template data with resolved promotions
  const templateData: EmailTemplateData = {
    subject: content.subject,
    preheader: content.preheader,
    sections: content.sections.map((section) => ({
      headline: section.headline,
      promotions: section.promotions
        .map((id) => promotionsMap.get(id))
        .filter((p): p is PromotionData => p !== undefined),
      cta_text: section.cta_text,
      cta_url: "https://heroescolombia.com/promotions",
    })),
    footer_text: content.footer_text,
  };

  const htmlContent = generateEmailHtml(templateData);

  let totalSent = 0;
  let totalFailed = 0;
  const failedEmails: string[] = [];

  // Send emails in batches
  for (let i = 0; i < eligibleUsers.length; i += EMAIL_BATCH_SIZE) {
    const batch = eligibleUsers.slice(i, i + EMAIL_BATCH_SIZE);

    // Send each email in the batch
    const sendPromises = batch.map(async (user) => {
      try {
        const personalizedSubject = user.first_name
          ? `${user.first_name}, ${content.subject}`
          : content.subject;

        await resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          replyTo: EMAIL_REPLY_TO,
          subject: personalizedSubject,
          html: htmlContent,
        });

        return { success: true, email: user.email };
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        return { success: false, email: user.email };
      }
    });

    const results = await Promise.all(sendPromises);

    for (const result of results) {
      if (result.success) {
        totalSent++;
      } else {
        totalFailed++;
        failedEmails.push(result.email);
      }
    }

    console.log(
      `Email batch ${Math.floor(i / EMAIL_BATCH_SIZE) + 1}: ` +
      `${results.filter((r) => r.success).length} sent, ` +
      `${results.filter((r) => !r.success).length} failed`
    );

    // Rate limiting - wait between batches
    if (i + EMAIL_BATCH_SIZE < eligibleUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent: totalSent, failed: totalFailed, failedEmails };
}

// ============================================================================
// In-App Message Configuration
// ============================================================================

/**
 * Configure in-app message by storing it in Firestore
 * The mobile app will fetch this on launch
 */
export async function configureInAppMessage(
  campaignId: string,
  content: {
    title: string;
    body: string;
    image_url: string;
    featured_promotions: string[];
    button_text: string;
    button_action: string;
  },
  expiresAt: Date
): Promise<void> {
  const inAppMessageRef = getDb().collection("active_inapp_messages").doc("current");

  await inAppMessageRef.set({
    campaign_id: campaignId,
    title: content.title,
    body: content.body,
    image_url: content.image_url,
    featured_promotions: content.featured_promotions,
    button_text: content.button_text,
    button_action: content.button_action,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
    active: true,
  });

  console.log(`In-app message configured for campaign: ${campaignId}`);
}

// ============================================================================
// Main Send Function
// ============================================================================

/**
 * Send a campaign to all eligible users based on campaign type
 */
export async function sendCampaign(
  campaignId: string,
  campaignType: "push" | "inapp" | "email",
  content: PushContent | EmailContent | any
): Promise<SendResult> {
  console.log(`Starting to send ${campaignType} campaign: ${campaignId}`);

  // Get all active users
  const users = await getActiveUsers();
  console.log(`Found ${users.length} active users`);

  const result: SendResult = {
    total_recipients: users.length,
    push_sent: 0,
    push_failed: 0,
    email_sent: 0,
    email_failed: 0,
    failed_tokens: [],
    failed_emails: [],
  };

  switch (campaignType) {
    case "push": {
      const pushResult = await sendPushNotifications(
        content as PushContent,
        users
      );
      result.push_sent = pushResult.sent;
      result.push_failed = pushResult.failed;
      result.failed_tokens = pushResult.failedTokens;
      break;
    }

    case "email": {
      const emailContent = content as EmailContent;

      // Gather all promotion IDs from sections
      const promotionIds = emailContent.sections.flatMap(
        (section) => section.promotions
      );

      // Fetch promotion data
      const promotionsMap = await fetchPromotionData(promotionIds);

      const emailResult = await sendEmailCampaign(
        emailContent,
        users,
        promotionsMap
      );
      result.email_sent = emailResult.sent;
      result.email_failed = emailResult.failed;
      result.failed_emails = emailResult.failedEmails;
      break;
    }

    case "inapp": {
      // Configure in-app message to show for 3 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      await configureInAppMessage(campaignId, content, expiresAt);

      // Count eligible users
      const eligibleCount = getPushEligibleUsers(users).length;
      result.total_recipients = eligibleCount;
      break;
    }
  }

  console.log(`Campaign ${campaignId} send complete:`, result);
  return result;
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Remove invalid notification tokens from user records
 */
export async function cleanupInvalidTokens(
  failedTokens: string[]
): Promise<number> {
  if (failedTokens.length === 0) {
    return 0;
  }

  console.log(`Cleaning up ${failedTokens.length} invalid tokens...`);

  let cleaned = 0;

  // Find users with these tokens and clear them
  for (const token of failedTokens) {
    try {
      const usersWithToken = await getDb()
        .collection("users")
        .where("device_notification_token", "==", token)
        .get();

      for (const doc of usersWithToken.docs) {
        await doc.ref.update({
          device_notification_token: FieldValue.delete(),
          device_notification_token_invalid: true,
          device_notification_token_invalid_at:
            FieldValue.serverTimestamp(),
        });
        cleaned++;
      }
    } catch (error) {
      console.error(`Error cleaning up token:`, error);
    }
  }

  console.log(`Cleaned up ${cleaned} invalid tokens`);
  return cleaned;
}
