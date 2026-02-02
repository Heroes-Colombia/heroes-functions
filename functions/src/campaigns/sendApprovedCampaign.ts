/**
 * Firestore Trigger: Send Approved Campaigns
 *
 * Automatically sends campaigns when their status changes to "approved".
 * Updates analytics and handles errors.
 *
 * Part of the Automated Engagement System - Part A (Phase 4)
 */

import * as functions from "firebase-functions/v1";
import { admin, getDb } from "../utils/firebase";
import {
  sendCampaign,
  cleanupInvalidTokens,
  SendResult,
} from "./helpers/batchSending";
import { updateEnterpriseRotation } from "./helpers/enterpriseRotation";
import { PushContent, EmailContent, InAppContent } from "./helpers/claudeApi";

// ============================================================================
// Types
// ============================================================================

type CampaignStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

interface CampaignDocument {
  campaign_type: "push" | "inapp" | "email";
  status: CampaignStatus;
  push_content?: PushContent;
  inapp_content?: InAppContent;
  email_content?: EmailContent;
  content_sources: {
    enterprise_businesses: string[];
  };
  analytics: {
    total_recipients: number;
    push_sent: number;
    email_sent: number;
    inapp_configured: boolean;
  };
}

// ============================================================================
// Firestore Trigger
// ============================================================================

/**
 * Firestore trigger that fires when a campaign document is updated.
 * If the status changes to "approved", it sends the campaign.
 */
export const onCampaignApproved = functions
  .runWith({
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 540, // 9 minutes for large sends
    memory: "512MB",
  })
  .firestore.document("campaigns/{campaignId}")
  .onUpdate(async (change, context) => {
    const campaignId = context.params.campaignId;
    const before = change.before.data() as CampaignDocument;
    const after = change.after.data() as CampaignDocument;

    // Only proceed if status changed TO "approved"
    if (before.status === after.status || after.status !== "approved") {
      return null;
    }

    console.log(`Campaign ${campaignId} approved - starting send process...`);

    const campaignRef = getDb().collection("campaigns").doc(campaignId);

    try {
      // Update status to "sending"
      await campaignRef.update({
        status: "sending",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        sending_started_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Get the appropriate content based on campaign type
      const content = getCampaignContent(after);

      if (!content) {
        throw new Error(`No content found for ${after.campaign_type} campaign`);
      }

      // Send the campaign
      const result = await sendCampaign(
        campaignId,
        after.campaign_type,
        content
      );

      // Update campaign with results
      await updateCampaignWithResults(campaignRef, after, result);

      // Update enterprise rotation if applicable
      if (
        after.content_sources.enterprise_businesses &&
        after.content_sources.enterprise_businesses.length > 0
      ) {
        await updateEnterpriseRotation(
          after.content_sources.enterprise_businesses,
          campaignId
        );
      }

      // Cleanup invalid tokens
      if (result.failed_tokens.length > 0) {
        await cleanupInvalidTokens(result.failed_tokens);
      }

      console.log(`Campaign ${campaignId} sent successfully`);
      return null;
    } catch (error) {
      console.error(`Error sending campaign ${campaignId}:`, error);

      // Update status to failed
      await campaignRef.update({
        status: "failed",
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        error_message: error instanceof Error ? error.message : String(error),
        failed_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the content object based on campaign type
 */
function getCampaignContent(
  campaign: CampaignDocument
): PushContent | InAppContent | EmailContent | null {
  switch (campaign.campaign_type) {
    case "push":
      return campaign.push_content || null;
    case "inapp":
      return campaign.inapp_content || null;
    case "email":
      return campaign.email_content || null;
    default:
      return null;
  }
}

/**
 * Update campaign document with send results
 */
async function updateCampaignWithResults(
  campaignRef: admin.firestore.DocumentReference,
  campaign: CampaignDocument,
  result: SendResult
): Promise<void> {
  const updateData: Record<string, any> = {
    status: "sent",
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
    "analytics.total_recipients": result.total_recipients,
  };

  switch (campaign.campaign_type) {
    case "push":
      updateData["analytics.push_sent"] = result.push_sent;
      updateData["analytics.push_failed"] = result.push_failed;
      break;

    case "email":
      updateData["analytics.email_sent"] = result.email_sent;
      updateData["analytics.email_failed"] = result.email_failed;
      break;

    case "inapp":
      updateData["analytics.inapp_configured"] = true;
      break;
  }

  await campaignRef.update(updateData);
}

// ============================================================================
// Manual Trigger (for testing or retrying failed campaigns)
// ============================================================================

/**
 * Manually trigger campaign sending
 * Can be called via REST API for testing or retrying failed campaigns
 */
export async function manuallySendCampaign(campaignId: string): Promise<{
  success: boolean;
  result?: SendResult;
  error?: string;
}> {
  const campaignRef = getDb().collection("campaigns").doc(campaignId);
  const campaignDoc = await campaignRef.get();

  if (!campaignDoc.exists) {
    return { success: false, error: "Campaign not found" };
  }

  const campaign = campaignDoc.data() as CampaignDocument;

  // Allow sending if status is approved, failed (retry), or pending_review (force send)
  if (!["approved", "failed", "pending_review"].includes(campaign.status)) {
    return {
      success: false,
      error: `Campaign status is "${campaign.status}", expected "approved" or "failed"`,
    };
  }

  try {
    // Update status to sending
    await campaignRef.update({
      status: "sending",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      sending_started_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const content = getCampaignContent(campaign);

    if (!content) {
      throw new Error(`No content found for ${campaign.campaign_type} campaign`);
    }

    // Send the campaign
    const result = await sendCampaign(
      campaignId,
      campaign.campaign_type,
      content
    );

    // Update with results
    await updateCampaignWithResults(campaignRef, campaign, result);

    // Update enterprise rotation
    if (
      campaign.content_sources.enterprise_businesses &&
      campaign.content_sources.enterprise_businesses.length > 0
    ) {
      await updateEnterpriseRotation(
        campaign.content_sources.enterprise_businesses,
        campaignId
      );
    }

    // Cleanup invalid tokens
    if (result.failed_tokens.length > 0) {
      await cleanupInvalidTokens(result.failed_tokens);
    }

    return { success: true, result };
  } catch (error) {
    console.error(`Error manually sending campaign ${campaignId}:`, error);

    await campaignRef.update({
      status: "failed",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      error_message: error instanceof Error ? error.message : String(error),
      failed_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
