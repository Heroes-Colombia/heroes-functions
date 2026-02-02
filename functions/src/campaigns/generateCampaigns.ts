/**
 * Campaign Generation Functions
 *
 * Scheduled functions that generate campaign content using Claude API
 * and save to Firestore for admin review.
 *
 * Part of the Automated Engagement System - Part A
 */

import * as functions from "firebase-functions/v1";
import { admin, getDb } from "../utils/firebase";
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
  created_at: admin.firestore.Timestamp;
  updated_at: admin.firestore.Timestamp;
  scheduled_for: admin.firestore.Timestamp;
  content_sources: {
    top_promotions: string[];
    under_promoted: string[];
    enterprise_businesses: string[];
    new_businesses: string[];
    categories: string[];
  };
  generated_by: "claude" | "manual";
  claude_model: string;
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
 * Schedule: Every 2 days at 8 AM Colombia time (for 10-11 AM send after approval)
 * Cron: 0 8 *\/2 * * (every 2 days)
 */
export const generatePushCampaign = functions
  .runWith({ secrets: ["CLAUDE_API_KEY"] })
  .pubsub.schedule("0 8 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31 * *")
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
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      scheduled_for: admin.firestore.Timestamp.fromDate(
        new Date(date.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
      ),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        categories: [],
      },
      claude_model: "claude-sonnet-4-20250514",
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
      // Generate content with Claude
      const pushContent = await generatePushContent(contextWithOccasion, category, tone);

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        generated_by: "claude",
        push_content: pushContent,
      };

      // Save to Firestore
      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`Push campaign created: ${campaignRef.id}`);

      return null;
    } catch (error) {
      console.error("Error generating push content with Claude:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        generated_by: "claude" as const,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: admin.firestore.Timestamp.now(),
      };

      const campaignRef = await getDb().collection("campaigns").add(failedCampaignData);
      console.log(`Failed push campaign created for review: ${campaignRef.id}`);

      throw error;
    }
  });

/**
 * Generate In-App Messaging Campaign
 * Schedule: Every Friday at 8 AM Colombia time
 * Cron: 0 8 * * 5
 */
export const generateInAppCampaign = functions
  .runWith({ secrets: ["CLAUDE_API_KEY"] })
  .pubsub.schedule("0 8 * * 5")
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
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      scheduled_for: admin.firestore.Timestamp.fromDate(
        new Date(date.getTime() + 2 * 60 * 60 * 1000)
      ),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        categories: [],
      },
      claude_model: "claude-sonnet-4-20250514",
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
      // Generate content with Claude
      const inappContent = await generateInAppContent(contextWithOccasion, category, tone);

      // Add featured image if available
      if (featuredImage) {
        inappContent.image_url = featuredImage;
      }

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        generated_by: "claude",
        inapp_content: inappContent,
      };

      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`In-app campaign created: ${campaignRef.id}`);

      return null;
    } catch (error) {
      console.error("Error generating in-app content with Claude:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        generated_by: "claude" as const,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: admin.firestore.Timestamp.now(),
      };

      const campaignRef = await getDb().collection("campaigns").add(failedCampaignData);
      console.log(`Failed in-app campaign created for review: ${campaignRef.id}`);

      throw error;
    }
  });

/**
 * Generate Email Campaign
 * Schedule: 1st and 15th of each month at 8 AM Colombia time
 * Cron: 0 8 1,15 * *
 */
export const generateEmailCampaign = functions
  .runWith({ secrets: ["CLAUDE_API_KEY"] })
  .pubsub.schedule("0 8 1,15 * *")
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
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      scheduled_for: admin.firestore.Timestamp.fromDate(
        new Date(date.getTime() + 2 * 60 * 60 * 1000)
      ),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        categories: [],
      },
      claude_model: "claude-sonnet-4-20250514",
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
      // Generate content with Claude
      const emailContent = await generateEmailContent(contextWithOccasion, category, tone);

      // Create campaign document with generated content
      const campaignData: CampaignDocument = {
        ...baseCampaignData,
        status: "pending_review",
        generated_by: "claude",
        email_content: emailContent,
      };

      const campaignRef = await getDb().collection("campaigns").add(campaignData);
      console.log(`Email campaign created: ${campaignRef.id}`);

      return null;
    } catch (error) {
      console.error("Error generating email content with Claude:", error);

      // Create failed campaign document for admin visibility
      const failedCampaignData = {
        ...baseCampaignData,
        status: "failed" as CampaignStatus,
        generated_by: "claude" as const,
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: admin.firestore.Timestamp.now(),
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
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      scheduled_for: admin.firestore.Timestamp.fromDate(
        new Date(date.getTime() + 2 * 60 * 60 * 1000)
      ),
      content_sources: {
        top_promotions: content.topPromotions.map((p) => p.id),
        under_promoted: content.underPromoted.map((p) => p.id),
        enterprise_businesses: enterpriseBusinesses.map((b) => b.id),
        new_businesses: content.newBusinesses.map((b) => b.id),
        categories: [],
      },
      generated_by: "claude",
      claude_model: "claude-sonnet-4-20250514",
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
