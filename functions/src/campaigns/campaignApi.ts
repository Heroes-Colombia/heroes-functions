/**
 * Campaign REST API
 *
 * Express router for campaign management from the admin dashboard.
 * Includes endpoints for listing, viewing, approving, rejecting,
 * and manually triggering campaigns.
 *
 * Part of the Automated Engagement System - Part A (Phase 4)
 */

import { Router, Request, Response, NextFunction } from "express";
import { admin, getDb } from "../utils/firebase";
import { manuallySendCampaign } from "./sendApprovedCampaign";
import { manuallyGenerateCampaign } from "./generateCampaigns";
const router = Router();

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiting middleware
 * Limits requests per IP to prevent abuse
 */
function rateLimit(
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = req.ip || (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || "unknown";
    const key = `${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    entry.count++;
    next();
  };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Apply rate limiting to all routes
router.use(rateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

// ============================================================================
// Types
// ============================================================================

type CampaignType = "push" | "inapp" | "email";
type CampaignStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

interface CampaignListQuery {
  status?: CampaignStatus;
  type?: CampaignType;
  limit?: string;
  startAfter?: string;
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Simple authentication check
 * In production, verify Firebase Auth token from Authorization header
 */
async function requireAuth(
  req: Request,
  res: Response,
  next: () => void
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Check if user is admin
    const userDoc = await getDb().collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    // Attach user info to request
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid authorization token" });
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /campaigns
 * List campaigns with optional filtering
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, type, limit, startAfter } =
      req.query as unknown as CampaignListQuery;

    let query: admin.firestore.Query = getDb()
      .collection("campaigns")
      .orderBy("created_at", "desc");

    // Apply filters
    if (status) {
      query = query.where("status", "==", status);
    }

    if (type) {
      query = query.where("campaign_type", "==", type);
    }

    // Pagination
    const pageLimit = Math.min(parseInt(limit || "20"), 100);
    query = query.limit(pageLimit);

    if (startAfter) {
      const startDoc = await getDb().collection("campaigns").doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();

    const campaigns = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString(),
      updated_at: doc.data().updated_at?.toDate?.()?.toISOString(),
      scheduled_for: doc.data().scheduled_for?.toDate?.()?.toISOString(),
      sent_at: doc.data().sent_at?.toDate?.()?.toISOString(),
      approved_at: doc.data().approved_at?.toDate?.()?.toISOString(),
    }));

    res.json({
      success: true,
      campaigns,
      hasMore: snapshot.docs.length === pageLimit,
      lastId:
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1].id
          : null,
    });
  } catch (error) {
    console.error("Error listing campaigns:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list campaigns",
    });
  }
});

/**
 * GET /campaigns/stats
 * Get campaign statistics
 */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const [
      pendingSnapshot,
      sentSnapshot,
      failedSnapshot,
      totalSnapshot,
    ] = await Promise.all([
      getDb().collection("campaigns").where("status", "==", "pending_review").get(),
      getDb().collection("campaigns").where("status", "==", "sent").get(),
      getDb().collection("campaigns").where("status", "==", "failed").get(),
      getDb().collection("campaigns").get(),
    ]);

    // Calculate totals from sent campaigns
    let totalPushSent = 0;
    let totalEmailSent = 0;

    sentSnapshot.docs.forEach((doc) => {
      const analytics = doc.data().analytics || {};
      totalPushSent += analytics.push_sent || 0;
      totalEmailSent += analytics.email_sent || 0;
    });

    res.json({
      success: true,
      stats: {
        pending_review: pendingSnapshot.size,
        sent: sentSnapshot.size,
        failed: failedSnapshot.size,
        total: totalSnapshot.size,
        total_push_sent: totalPushSent,
        total_email_sent: totalEmailSent,
      },
    });
  } catch (error) {
    console.error("Error getting campaign stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get campaign statistics",
    });
  }
});

/**
 * GET /campaigns/:id
 * Get campaign details
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const doc = await getDb().collection("campaigns").doc(id).get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const data = doc.data()!;

    res.json({
      success: true,
      campaign: {
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString(),
        updated_at: data.updated_at?.toDate?.()?.toISOString(),
        scheduled_for: data.scheduled_for?.toDate?.()?.toISOString(),
        sent_at: data.sent_at?.toDate?.()?.toISOString(),
        approved_at: data.approved_at?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get campaign",
    });
  }
});

/**
 * POST /campaigns/:id/approve
 * Approve a campaign for sending
 */
router.post("/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = (req as any).user;

    const campaignRef = getDb().collection("campaigns").doc(id);
    const doc = await campaignRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const campaign = doc.data()!;

    if (campaign.status !== "pending_review") {
      res.status(400).json({
        success: false,
        error: `Campaign status is "${campaign.status}", expected "pending_review"`,
      });
      return;
    }

    // Update status to approved
    // The Firestore trigger will handle sending
    await campaignRef.update({
      status: "approved",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      approved_at: admin.firestore.FieldValue.serverTimestamp(),
      "approval.approved_by": user.uid,
      "approval.reviewed_by": user.uid,
    });

    res.json({
      success: true,
      message: "Campaign approved and queued for sending",
      campaignId: id,
    });
  } catch (error) {
    console.error("Error approving campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve campaign",
    });
  }
});

/**
 * POST /campaigns/:id/reject
 * Reject a campaign
 */
router.post("/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const user = (req as any).user;

    if (!reason || typeof reason !== "string") {
      res.status(400).json({
        success: false,
        error: "Rejection reason is required",
      });
      return;
    }

    const campaignRef = getDb().collection("campaigns").doc(id);
    const doc = await campaignRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const campaign = doc.data()!;

    if (campaign.status !== "pending_review") {
      res.status(400).json({
        success: false,
        error: `Campaign status is "${campaign.status}", expected "pending_review"`,
      });
      return;
    }

    await campaignRef.update({
      status: "cancelled",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      "approval.rejected_by": user.uid,
      "approval.reviewed_by": user.uid,
      "approval.rejection_reason": reason,
    });

    res.json({
      success: true,
      message: "Campaign rejected",
      campaignId: id,
    });
  } catch (error) {
    console.error("Error rejecting campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject campaign",
    });
  }
});

/**
 * POST /campaigns/:id/cancel
 * Cancel a campaign (only if not yet sent)
 */
router.post("/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const campaignRef = getDb().collection("campaigns").doc(id);
    const doc = await campaignRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const campaign = doc.data()!;

    if (["sent", "sending"].includes(campaign.status)) {
      res.status(400).json({
        success: false,
        error: "Cannot cancel a campaign that is sending or already sent",
      });
      return;
    }

    await campaignRef.update({
      status: "cancelled",
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Campaign cancelled",
      campaignId: id,
    });
  } catch (error) {
    console.error("Error cancelling campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel campaign",
    });
  }
});

/**
 * POST /campaigns/:id/send
 * Manually trigger campaign sending (for testing or retrying)
 */
router.post("/:id/send", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const result = await manuallySendCampaign(id);

    if (result.success) {
      res.json({
        success: true,
        message: "Campaign sent successfully",
        campaignId: id,
        result: result.result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Error manually sending campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send campaign",
    });
  }
});

/**
 * PUT /campaigns/:id
 * Update campaign content (only if pending_review)
 */
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { push_content, inapp_content, email_content } = req.body;
    const user = (req as any).user;

    const campaignRef = getDb().collection("campaigns").doc(id);
    const doc = await campaignRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const campaign = doc.data()!;

    if (campaign.status !== "pending_review") {
      res.status(400).json({
        success: false,
        error: `Campaign status is "${campaign.status}", expected "pending_review"`,
      });
      return;
    }

    const updateData: Record<string, any> = {
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      "approval.edits_made": true,
      "approval.reviewed_by": user.uid,
    };

    // Store original content before editing
    if (!campaign.approval?.original_content) {
      updateData["approval.original_content"] = {
        push_content: campaign.push_content,
        inapp_content: campaign.inapp_content,
        email_content: campaign.email_content,
      };
    }

    // Update content based on campaign type
    if (push_content && campaign.campaign_type === "push") {
      updateData.push_content = push_content;
    }

    if (inapp_content && campaign.campaign_type === "inapp") {
      updateData.inapp_content = inapp_content;
    }

    if (email_content && campaign.campaign_type === "email") {
      updateData.email_content = email_content;
    }

    await campaignRef.update(updateData);

    res.json({
      success: true,
      message: "Campaign updated",
      campaignId: id,
    });
  } catch (error) {
    console.error("Error updating campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update campaign",
    });
  }
});

/**
 * POST /campaigns/generate
 * Manually generate a campaign (for testing)
 */
router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignType } = req.body;

    if (!campaignType || !["push", "inapp", "email"].includes(campaignType)) {
      res.status(400).json({
        success: false,
        error: "Invalid campaign type. Use: push, inapp, or email",
      });
      return;
    }

    const campaignId = await manuallyGenerateCampaign(campaignType);

    res.status(201).json({
      success: true,
      message: `${campaignType} campaign generated`,
      campaignId,
    });
  } catch (error) {
    console.error("Error generating campaign:", error);
    res.status(500).json({
      success: false,
      error: `Failed to generate campaign: ${error}`,
    });
  }
});

/**
 * DELETE /campaigns/:id
 * Delete a campaign (only if draft or cancelled)
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const campaignRef = getDb().collection("campaigns").doc(id);
    const doc = await campaignRef.get();

    if (!doc.exists) {
      res.status(404).json({
        success: false,
        error: "Campaign not found",
      });
      return;
    }

    const campaign = doc.data()!;

    if (!["draft", "cancelled"].includes(campaign.status)) {
      res.status(400).json({
        success: false,
        error: `Cannot delete campaign with status "${campaign.status}"`,
      });
      return;
    }

    await campaignRef.delete();

    res.json({
      success: true,
      message: "Campaign deleted",
      campaignId: id,
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete campaign",
    });
  }
});

export default router;
