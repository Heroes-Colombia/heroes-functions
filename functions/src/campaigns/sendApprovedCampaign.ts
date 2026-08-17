/**
 * Firestore Trigger: Send Approved Campaigns
 *
 * Automatically sends campaigns when their status changes to "approved".
 * If scheduled_for is in the future, a Cloud Task is created to send at
 * the right time. Otherwise the campaign is sent immediately.
 * Updates analytics and handles errors.
 *
 * Part of the Automated Engagement System - Part A (Phase 4)
 */

import * as functions from "firebase-functions/v1";
import { CloudTasksClient } from "@google-cloud/tasks";
import { admin, getDb } from "../utils/firebase";
import {
  sendCampaign,
  cleanupInvalidTokens,
  SendResult,
} from "./helpers/batchSending";
import { updateBusinessRotation } from "./helpers/enterpriseRotation";
import { PushContent, EmailContent, InAppContent } from "./helpers/claudeApi";

// ============================================================================
// Constants
// ============================================================================

const FIREBASE_PROJECT = "heroes-cd74a";
const TASKS_LOCATION = "us-central1";
const TASKS_QUEUE = "campaign-sends";
// If scheduled_for is within this many seconds from now, send immediately
// instead of creating a Cloud Task (avoids unnecessary scheduling overhead)
const SCHEDULE_BUFFER_SECONDS = 60;

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
  scheduled_for?: admin.firestore.Timestamp;
  push_content?: PushContent;
  inapp_content?: InAppContent;
  email_content?: EmailContent;
  content_sources: {
    enterprise_businesses: string[];
    new_businesses?: string[];
    rotation_businesses?: string[];
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
 * If the status changes to "approved":
 *   - Future campaigns: creates a Cloud Task scheduled for scheduled_for
 *   - Past/immediate campaigns: sends right away
 */
export const onCampaignApproved = functions
  .runWith({
    secrets: ["RESEND_API_KEY", "CLOUD_TASKS_SECRET"],
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

    const campaignRef = getDb().collection("campaigns").doc(campaignId);
    const scheduledFor = after.scheduled_for?.toDate();
    const now = new Date();
    const bufferMs = SCHEDULE_BUFFER_SECONDS * 1000;

    if (scheduledFor && scheduledFor.getTime() > now.getTime() + bufferMs) {
      // Campaign is set for a future time — schedule via Cloud Tasks
      console.log(
        `Campaign ${campaignId} approved - scheduling for ${scheduledFor.toISOString()}`
      );
      try {
        const taskName = await scheduleViaCloudTasks(campaignId, scheduledFor);
        await campaignRef.update({
          cloud_task_name: taskName,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Campaign ${campaignId} scheduled via Cloud Tasks`);
      } catch (error) {
        console.error(
          `Failed to create Cloud Task for campaign ${campaignId}, sending immediately:`,
          error
        );
        // Fall back to immediate send if task creation fails
        await executeSend(campaignId, campaignRef, after);
      }
      return null;
    }

    // scheduled_for is in the past or not set — send immediately
    console.log(`Campaign ${campaignId} approved - sending immediately`);
    await executeSend(campaignId, campaignRef, after);
    return null;
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a Cloud Task that will POST to the execute-send endpoint
 * at the given scheduled time.
 * Returns the created task's full resource name.
 */
async function scheduleViaCloudTasks(
  campaignId: string,
  scheduledFor: Date
): Promise<string> {
  const client = new CloudTasksClient();
  const parent = client.queuePath(FIREBASE_PROJECT, TASKS_LOCATION, TASKS_QUEUE);

  const functionUrl = `https://${TASKS_LOCATION}-${FIREBASE_PROJECT}.cloudfunctions.net/widgets/campaigns/internal/execute-send`;

  const [task] = await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: "POST",
        url: functionUrl,
        headers: {
          "Content-Type": "application/json",
          "X-Tasks-Secret": process.env.CLOUD_TASKS_SECRET || "",
        },
        body: Buffer.from(JSON.stringify({ campaignId })),
      },
      scheduleTime: {
        seconds: Math.floor(scheduledFor.getTime() / 1000),
      },
    },
  });

  return task.name || "";
}

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
 * Core send logic shared by the Firestore trigger (immediate path)
 * and the manuallySendCampaign function (manual / Cloud Task path).
 */
async function executeSend(
  campaignId: string,
  campaignRef: admin.firestore.DocumentReference,
  campaign: CampaignDocument
): Promise<void> {
  try {
    await campaignRef.update({
      status: "sending",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      sending_started_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const content = getCampaignContent(campaign);

    if (!content) {
      throw new Error(`No content found for ${campaign.campaign_type} campaign`);
    }

    const result = await sendCampaign(campaignId, campaign.campaign_type, content);

    await updateCampaignWithResults(campaignRef, campaign, result);

    const rotationBusinesses = [
      ...(campaign.content_sources.rotation_businesses ?? []),
      ...(campaign.content_sources.new_businesses ?? []),
    ];
    if (rotationBusinesses.length > 0) {
      // Non-critical bookkeeping — must never overwrite the "sent" status
      // already committed above if this fails.
      try {
        await updateBusinessRotation(rotationBusinesses, campaignId);
      } catch (error) {
        console.error(
          `Campaign ${campaignId} sent successfully but business rotation update failed:`,
          error
        );
      }
    }

    if (result.failed_tokens.length > 0) {
      await cleanupInvalidTokens(result.failed_tokens);
    }

    console.log(`Campaign ${campaignId} sent successfully`);
  } catch (error) {
    console.error(`Error sending campaign ${campaignId}:`, error);
    await campaignRef.update({
      status: "failed",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      error_message: error instanceof Error ? error.message : String(error),
      failed_at: admin.firestore.FieldValue.serverTimestamp(),
    });
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
 * Manually trigger campaign sending.
 * Called by the Cloud Task execute-send endpoint and the campaign API's
 * /send route for testing or retrying failed campaigns.
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
    await executeSend(campaignId, campaignRef, campaign);
    // Re-fetch to get updated analytics for the response
    const updated = await campaignRef.get();
    return { success: true, result: updated.data()?.analytics };
  } catch (error) {
    console.error(`Error manually sending campaign ${campaignId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
