import { onRequest } from "firebase-functions/v1/https";

// Initialize Firebase Admin first (before any other imports that use it)
import { admin } from "./utils/firebase";

import { setGlobalOptions } from "firebase-functions/v2/options";

import express, { Express } from "express";
import cors from "cors";

// New subscription expiration functions (Week 5)
import {
  expireTrialSubscriptions,
  sendTrialExpiringWarnings,
  expireOverdueTrials,
  sendExpiringWarnings,
} from "./scheduler/expireTrialSubscriptions";

// Analytics Functions - Automated Engagement System
import {
  updateViewsCount,
  updateSavesCount,
} from "./analytics/updatePromotionCounts";
import {
  backfillViewsCounts,
  backfillSavesCounts,
  backfillRedemptionsCounts,
  backfillAllCounts,
  initializePromotionCounts,
} from "./analytics/backfillScripts";

// Campaign Generation Functions - Automated Engagement System
import {
  generatePushCampaign,
  generateInAppCampaign,
  generateEmailCampaign,
  manuallyGenerateCampaign,
} from "./campaigns/generateCampaigns";

// Campaign Sending Functions - Automated Engagement System (Phase 4)
import { onCampaignApproved } from "./campaigns/sendApprovedCampaign";
import campaignApiRouter from "./campaigns/campaignApi";

// Business Notifications Functions - Automated Engagement System (Phase 5)
import {
  checkExpiredPromotions,
  checkNoActivePromotions,
  checkIncompleteProfiles,
  sendMonthlyReports,
  sendWeeklyReports,
  onNewFavourite,
  onCtaClick,
  checkCtaClicks,
  manualCheckExpiredPromotions,
  sendWeeklyReportToBusiness,
  sendMonthlyReportToBusiness,
  checkBusinessNotifications,
} from "./business-notifications";

setGlobalOptions({ maxInstances: 10 }); // set it here

const app: Express = express();
app.use(cors());
app.use(express.json());

app.get("/cloudFunctionStatus", async (request, response) => {
  //Shows a log to the cloud console
  console.error("Cloud functions working 200");
  response.status(200).send("Cloud functions working");
});

app.post("/singleUserNotification", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.deviceNotificationToken ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      token: request.body.deviceNotificationToken,
    };

    await admin.messaging().send(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

app.post("/multipleUsersNotification", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.deviceNotificationTokens ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      tokens: request.body.deviceNotificationTokens,
    };

    await admin.messaging().sendEachForMulticast(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

app.post("/multipleUsersNotificationsWithTopic", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.topic ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      topic: request.body.topic,
    };

    await admin.messaging().send(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

// ============================================================================
// Backfill Endpoints (One-time use for migrating existing data)
// ============================================================================

app.get("/backfill/views", backfillViewsCounts);
app.get("/backfill/saves", backfillSavesCounts);
app.get("/backfill/redemptions", backfillRedemptionsCounts);
app.get("/backfill/all", backfillAllCounts);
app.get("/backfill/initialize", initializePromotionCounts);

// ============================================================================
// Campaign API Routes (Phase 4 - Campaign Management)
// ============================================================================

// Mount campaign API router with full CRUD + approval workflow
app.use("/campaigns", campaignApiRouter);

// Legacy endpoint kept for backwards compatibility
app.post("/campaigns/generate-legacy", async (request, response) => {
  try {
    const { campaignType } = request.body;
    if (!campaignType || !["push", "inapp", "email"].includes(campaignType)) {
      response.status(400).send("Invalid campaign type. Use: push, inapp, or email");
      return;
    }

    const campaignId = await manuallyGenerateCampaign(campaignType);
    response.status(201).json({
      success: true,
      message: `${campaignType} campaign generated`,
      campaignId,
    });
  } catch (error) {
    console.error("Error generating campaign:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// ============================================================================
// Admin Authentication Middleware
// ============================================================================

/**
 * Middleware to verify admin access for sensitive endpoints
 */
async function requireAdminAuth(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verify Firebase ID token properly
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Check if user is admin
    const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.permission !== "admin") {
      response.status(403).json({ error: "Admin access required" });
      return;
    }

    // Attach user info to request
    (request as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    response.status(401).json({ error: "Invalid authorization token" });
  }
}

// ============================================================================
// Business Notifications API Endpoints (Phase 5 - Testing)
// Protected with admin authentication
// ============================================================================

// Manual trigger for expired promotions check
app.post("/business-notifications/check-expired", requireAdminAuth, async (request, response) => {
  try {
    const result = await manualCheckExpiredPromotions();
    response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error checking expired promotions:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// Check notifications status for a specific business
app.get("/business-notifications/check/:businessId", requireAdminAuth, async (request, response) => {
  try {
    const businessId = request.params.businessId as string;
    const result = await checkBusinessNotifications(businessId);
    response.status(200).json({
      success: true,
      businessId,
      ...result,
    });
  } catch (error) {
    console.error("Error checking business notifications:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// Send weekly report to a specific business (for testing)
app.post("/business-notifications/weekly-report/:businessId", requireAdminAuth, async (request, response) => {
  try {
    const businessId = request.params.businessId as string;
    const result = await sendWeeklyReportToBusiness(businessId);
    response.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error sending weekly report:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// Send monthly report to a specific business (for testing)
app.post("/business-notifications/monthly-report/:businessId", requireAdminAuth, async (request, response) => {
  try {
    const businessId = request.params.businessId as string;
    const result = await sendMonthlyReportToBusiness(businessId);
    response.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error sending monthly report:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// ============================================================================
// Subscription Expiration API Endpoints (Week 5 - Testing)
// Protected with admin authentication
// ============================================================================

// Manual trigger for expiring overdue trials
app.post("/subscriptions/expire-trials", requireAdminAuth, async (request, response) => {
  try {
    const result = await expireOverdueTrials();
    response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error expiring trials:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// Manual trigger for sending expiring warnings
app.post("/subscriptions/send-warnings", requireAdminAuth, async (request, response) => {
  try {
    const result = await sendExpiringWarnings();
    response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error sending expiring warnings:", error);
    response.status(500).send(`Error: ${error}`);
  }
});

// ============================================================================
// Firestore Triggers - Analytics (Automated Engagement System)
// ============================================================================

// Update views_count when a view event is created
exports.updatePromotionViewsCount = updateViewsCount;

// Update saves_count when a save event is created
exports.updatePromotionSavesCount = updateSavesCount;

// ============================================================================
// Scheduled Functions - Campaign Generation (Automated Engagement System)
// ============================================================================

// Generate push campaign every 2 days at 8 AM Colombia time
exports.generatePushCampaign = generatePushCampaign;

// Generate in-app campaign every Friday at 8 AM Colombia time
exports.generateInAppCampaign = generateInAppCampaign;

// Generate email campaign on 1st and 15th at 8 AM Colombia time
exports.generateEmailCampaign = generateEmailCampaign;

// ============================================================================
// Firestore Triggers - Campaign Sending (Automated Engagement System Phase 4)
// ============================================================================

// Send campaign when status changes to "approved"
exports.onCampaignApproved = onCampaignApproved;

// ============================================================================
// Scheduled Functions - Business Notifications (Automated Engagement System Phase 5)
// ============================================================================

// Check for expired promotions daily at 9 AM Colombia time
exports.checkExpiredPromotions = checkExpiredPromotions;

// Check for businesses with no active promotions every Monday at 11 AM
exports.checkNoActivePromotions = checkNoActivePromotions;

// Check for incomplete business profiles every Wednesday at 11 AM
exports.checkIncompleteProfiles = checkIncompleteProfiles;

// Send weekly reports to all businesses every Monday at 10 AM
exports.sendWeeklyReports = sendWeeklyReports;

// Send monthly reports to businesses on 1st of month at 10 AM
exports.sendMonthlyReports = sendMonthlyReports;

exports.checkCtaClicks = checkCtaClicks;

// ============================================================================
// Firestore Triggers - Business Notifications (Automated Engagement System Phase 5)
// ============================================================================

// Send notification when a user adds a business to favourites
exports.onNewFavourite = onNewFavourite;

// Send notification when a user clicks on a business CTA
exports.onCtaClick = onCtaClick;

// ============================================================================
// Scheduled Functions - Trial Subscription Expiration (Week 5)
// ============================================================================

// Expire trial subscriptions daily at midnight (America/Bogota)
exports.expireTrialSubscriptions = expireTrialSubscriptions;

// Send warning emails for trials expiring in 7 days, daily at 9 AM
exports.sendTrialExpiringWarnings = sendTrialExpiringWarnings;

// ============================================================================
// Express App Export
// ============================================================================

//Export the express app
exports.widgets = onRequest(app);