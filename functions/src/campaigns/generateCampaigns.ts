/**
 * Campaign Generation Functions
 *
 * Scheduled functions that generate campaign content using Gemini
 * and save to Firestore for admin review.
 *
 * Part of the Automated Engagement System - Part A
 */

import * as functions from "firebase-functions/v1";
import { getDb } from "../utils/firebase";
import { Timestamp } from "firebase-admin/firestore"
import { Resend } from "resend";
import {
  generatePushContent,
  generateInAppContent,
  generateEmailContent,
  determineContentCategory,
  determineTone,
  checkSpecialOccasion,
  ContentContext,
  PushContent,
  InAppContent,
  EmailContent,
} from "./helpers/claudeApi";
import { gatherCampaignContent, getBestFeaturedImage } from "./helpers/contentGathering";
import { getEnterpriseBusinessesToFeature } from "./helpers/enterpriseRotation";

// ============================================================================
// Admin Notification
// ============================================================================

const ADMIN_EMAIL = "jonathan@heroescolombia.com";
const EMAIL_FROM = "Heroes Colombia <noreply@heroescolombia.com>";

async function sendCampaignApprovalEmail(
  campaignId: string,
  campaignType: "push" | "inapp" | "email",
  category: string,
  tone: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping approval email");
    return;
  }

  const typeLabels: Record<string, string> = {
    push: "Push Notification",
    inapp: "In-App Message",
    email: "Email",
  };

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: `[Heroes Colombia] Nueva campaña lista para aprobar: ${typeLabels[campaignType]}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #032291;">Nueva campaña generada ✅</h2>
        <p>Se generó automáticamente una nueva campaña y está esperando tu aprobación.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #6b7280;">Tipo</td>
            <td style="padding: 8px;">${typeLabels[campaignType]}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #6b7280;">Categoría</td>
            <td style="padding: 8px;">${category}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #6b7280;">Tono</td>
            <td style="padding: 8px;">${tone}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #6b7280;">ID de campaña</td>
            <td style="padding: 8px; font-family: monospace;">${campaignId}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">
          Revisa la campaña en el panel de administración y apruébala para que se envíe.
        </p>
      </div>
    `,
  });

  console.log(`Campaign approval email sent for campaign ${campaignId}`);
}

// ============================================================================
// Types
// ============================================================================

type CampaignType = "push" | "inapp" | "email";
type CampaignStatus = "draft" | "pending_review" | "approved" | "sending" | "sent" | "failed" | "cancelled";
type ContentCategory = "promotional" | "thematic" | "news" | "tips";
type Tone = "professional_patriotic" | "friendly" | "urgency" | "celebratory";

interface CampaignDocument {
  campaign_type: CampaignType;
  content_category: ContentCategory;
  status: CampaignStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  scheduled_for: Timestamp;
  content_sources: {
    top_promotions: string[];
    under_promoted: string[];
    enterprise_businesses: string[];
    new_businesses: string[];
    rotation_businesses: string[];
    categories: string[];
  };
  gemini_model: string;
  tone: Tone;
  generation_prompt?: string;
  push_content?: PushContent;
  inapp_content?: InAppContent;
  email_content?: EmailContent;
  target_audience: "all_active";
  analytics: {
    total_recipients: number;
    push_sent: number;
    email_sent: number;
    inapp_configured: boolean;
  };
  approval: {
    reviewed_by?: string;
    approved_by?: string;
    rejected_by?: string;
    rejection_reason?: string;
    edits_made: boolean;
    original_content?: object;
  };
}

// ============================================================================
// Scheduled Functions
// ============================================================================

/**
 * Generate Push Notification Campaign
 * Schedule: Every 3 days at 1 AM Colombia time (for 10-11 AM send after approval)
 * Cron: 0 1 *\/3 * * (every 3 days)
 */
export const generatePushCampaign = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .pubsub.schedule("0 1 */3 * *")
  .timeZone("America/Bogota")
  .onRun(async (_context) => {
    console.log("Starting push campaign generation...");

    // Gather content from Firestore
    const content = await gatherCampaignContent();
    const date = new Date();
    const specialOccasion = checkSpecialOccasion(date);
    const category = determineContentCategory(date);
    const tone = determineTone(date, specialOccasion);

    // Add special occasion to context if exists
    const contextWithOccasion: ContentContext = {
      ...content,
      specialOccasion,
    };

    // Get enterprise businesses to feature
    const enterpriseBusinesses = await getEnterpriseBusinessesToFeature(3);

    // Base campaign data (without content - added after generation attempt)
    const baseCampaignData = {
      campaign_type: "push" as const,
      content_category: category,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      scheduled_for: (() => {
        // Schedule for 10:00 AM Colombia Time (UTC-5)
        const scheduled = new Date(date);
        scheduled.setUTCHours(15, 0, 0, 0); // 10:00 AM COT = 15:00 UTC
        // If that time has already passed today, schedule for tomorrow
        if (scheduled <= date) {
          scheduled.setUTCDate(scheduled.getUTCDate() + 1);
        }
        return Timestamp.fromDate(scheduled);
      })(),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        rotation_businesses: content.rotationBusinesses.map((b) => b.id),
        categories: [],
      },
      gemini_model: "gemini-2.5-flash-lite",
      tone,
      target_audience: "all_active" as const,
      analytics: {
        total_recipients: 0,
        push_sent: 0,
        email_sent: 0,
        inapp_configured: false,
      },
      approval: {
        edits_made: false,
      },
    };

    try {
      // Generate content with Gemini
      const pushContent = await generatePushContent(contextWithOccasion, category, tone);

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        push_content: pushContent,
      };

      // Save to Firestore
      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`Push campaign created: ${campaignRef.id}`);

      await sendCampaignApprovalEmail(campaignRef.id, "push", category, tone);

      return null;
    } catch (error) {
      console.error("Error generating push content with Gemini:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: Timestamp.now(),
      };

      const campaignRef = await getDb().collection("campaigns").add(failedCampaignData);
      console.log(`Failed push campaign created for review: ${campaignRef.id}`);

      throw error;
    }
  });

/**
 * Generate In-App Messaging Campaign
 * Schedule: Every Friday at 1 AM Colombia time
 * Cron: 0 1 * * 5
 */
export const generateInAppCampaign = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .pubsub.schedule("0 1 * * 5")
  .timeZone("America/Bogota")
  .onRun(async (_context) => {
    console.log("Starting in-app campaign generation...");

    // Gather content from Firestore
    const content = await gatherCampaignContent();
    const date = new Date();
    const specialOccasion = checkSpecialOccasion(date);
    const category = determineContentCategory(date);
    const tone = determineTone(date, specialOccasion);

    const contextWithOccasion: ContentContext = {
      ...content,
      specialOccasion,
    };

    // Get enterprise businesses to feature
    const enterpriseBusinesses = await getEnterpriseBusinessesToFeature(3);

    // Get featured image from top promotion
    const featuredImage = await getBestFeaturedImage(content);

    // Base campaign data
    const baseCampaignData = {
      campaign_type: "inapp" as const,
      content_category: category,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      scheduled_for: (() => {
        // Schedule for 10:00 AM Colombia Time (UTC-5)
        const scheduled = new Date(date);
        scheduled.setUTCHours(15, 0, 0, 0); // 10:00 AM COT = 15:00 UTC
        // If that time has already passed today, schedule for tomorrow
        if (scheduled <= date) {
          scheduled.setUTCDate(scheduled.getUTCDate() + 1);
        }
        return Timestamp.fromDate(scheduled);
      })(),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        rotation_businesses: content.rotationBusinesses.map((b) => b.id),
        categories: [],
      },
      gemini_model: "gemini-2.5-flash-lite",
      tone,
      target_audience: "all_active" as const,
      analytics: {
        total_recipients: 0,
        push_sent: 0,
        email_sent: 0,
        inapp_configured: false,
      },
      approval: {
        edits_made: false,
      },
    };

    try {
      // Generate content with Gemini
      const inappContent = await generateInAppContent(contextWithOccasion, category, tone);

      // Add featured image if available
      if (featuredImage) {
        inappContent.image_url = featuredImage;
      }

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        inapp_content: inappContent,
      };

      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`In-app campaign created: ${campaignRef.id}`);

      await sendCampaignApprovalEmail(campaignRef.id, "inapp", category, tone);

      return null;
    } catch (error) {
      console.error("Error generating in-app content with Gemini:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: Timestamp.now(),
      };

      const campaignRef = await getDb().collection("campaigns").add(failedCampaignData);
      console.log(`Failed in-app campaign created for review: ${campaignRef.id}`);

      throw error;
    }
  });

/**
 * Generate Email Campaign
 * Schedule: 1st of each month at 1 AM Colombia time
 * Cron: 0 1 1 * *
 */
export const generateEmailCampaign = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .pubsub.schedule("0 1 1 * *")
  .timeZone("America/Bogota")
  .onRun(async (_context) => {
    console.log("Starting email campaign generation...");

    // Gather content from Firestore
    const content = await gatherCampaignContent();
    const date = new Date();
    const specialOccasion = checkSpecialOccasion(date);
    const category = determineContentCategory(date);
    const tone = determineTone(date, specialOccasion);

    const contextWithOccasion: ContentContext = {
      ...content,
      specialOccasion,
    };

    // Get enterprise businesses to feature
    const enterpriseBusinesses = await getEnterpriseBusinessesToFeature(5);

    // Base campaign data
    const baseCampaignData = {
      campaign_type: "email" as const,
      content_category: category,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      scheduled_for: (() => {
        // Schedule for 10:00 AM Colombia Time (UTC-5)
        const scheduled = new Date(date);
        scheduled.setUTCHours(15, 0, 0, 0); // 10:00 AM COT = 15:00 UTC
        // If that time has already passed today, schedule for tomorrow
        if (scheduled <= date) {
          scheduled.setUTCDate(scheduled.getUTCDate() + 1);
        }
        return Timestamp.fromDate(scheduled);
      })(),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        rotation_businesses: content.rotationBusinesses.map((b) => b.id),
        categories: [],
      },
      gemini_model: "gemini-2.5-flash-lite",
      tone,
      target_audience: "all_active" as const,
      analytics: {
        total_recipients: 0,
        push_sent: 0,
        email_sent: 0,
        inapp_configured: false,
      },
      approval: {
        edits_made: false,
      },
    };

    try {
      // Generate content with Gemini
      const emailContent = await generateEmailContent(contextWithOccasion, category, tone);

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        email_content: emailContent,
      };

      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`Email campaign created: ${campaignRef.id}`);

      await sendCampaignApprovalEmail(campaignRef.id, "email", category, tone);

      return null;
    } catch (error) {
      console.error("Error generating email content with Gemini:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: Timestamp.now(),
      };

      const campaignRef = await getDb().collection("campaigns").add(failedCampaignData);
      console.log(`Failed email campaign created for review: ${campaignRef.id}`);

      throw error;
    }
  });

// ============================================================================
// Manual Generation (for testing)
// ============================================================================

/**
 * Manually trigger campaign generation (for testing)
 * Called via HTTP endpoint
 */
export async function manuallyGenerateCampaign(
  campaignType: CampaignType
): Promise<string> {
  console.log(`Manually generating ${campaignType} campaign...`);

  try {
    const content = await gatherCampaignContent();
    const date = new Date();
    const specialOccasion = checkSpecialOccasion(date);
    const category = determineContentCategory(date);
    const tone = determineTone(date, specialOccasion);

    const contextWithOccasion: ContentContext = {
      ...content,
      specialOccasion,
    };

    let generatedContent: PushContent | InAppContent | EmailContent;

    switch (campaignType) {
      case "push":
        generatedContent = await generatePushContent(contextWithOccasion, category, tone);
        break;
      case "inapp":
        generatedContent = await generateInAppContent(contextWithOccasion, category, tone);
        const featuredImage = await getBestFeaturedImage(content);
        if (featuredImage && "image_url" in generatedContent) {
          generatedContent.image_url = featuredImage;
        }
        break;
      case "email":
        generatedContent = await generateEmailContent(contextWithOccasion, category, tone);
        break;
    }

    const enterpriseBusinesses = await getEnterpriseBusinessesToFeature(3);

    const campaignData: CampaignDocument = {
      campaign_type: campaignType,
      content_category: category,
      status: "pending_review",
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      scheduled_for: Timestamp.fromDate(
        new Date(date.getTime() + 2 * 60 * 60 * 1000)
      ),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        rotation_businesses: content.rotationBusinesses.map((b) => b.id),
        categories: [],
      },
      gemini_model: "gemini-2.5-flash-lite",
      tone,
      [`${campaignType}_content`]: generatedContent,
      target_audience: "all_active",
      analytics: {
        total_recipients: 0,
        push_sent: 0,
        email_sent: 0,
        inapp_configured: false,
      },
      approval: {
        edits_made: false,
      },
    };

    const campaignRef = await getDb().collection("campaigns").add(campaignData);
    console.log(`${campaignType} campaign created manually: ${campaignRef.id}`);

    return campaignRef.id;
  } catch (error) {
    console.error(`Error manually generating ${campaignType} campaign:`, error);
    throw error;
  }
}
