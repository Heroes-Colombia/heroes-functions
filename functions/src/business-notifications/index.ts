/**
 * Business Notifications Module
 *
 * Exports all business notification functions for the Automated Engagement System.
 *
 * Part of the Automated Engagement System - Part B (Phase 5)
 */

// Scheduled Checks
export {
  checkExpiredPromotions,
  checkNoActivePromotions,
  checkIncompleteProfiles,
  manualCheckExpiredPromotions,
  checkBusinessNotifications,
} from "./scheduledChecks";

// Weekly/Monthly Reports
export {
  sendWeeklyReports,
  sendMonthlyReports,
  sendWeeklyReportToBusiness,
  sendMonthlyReportToBusiness,
} from "./reports";

// Event Triggers
export {
  onNewFavourite,
  onCtaClick,
  checkNewFavourites,
  checkCtaClicks,
} from "./eventTriggers";

// Email Templates (for external use if needed)
export {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  JONATHAN_SIGNATURE_HTML,
  BusinessNotificationType,
} from "./emailTemplates";

// Email Sender Utilities (for external use if needed)
export {
  sendBusinessNotification,
  getBusinessInfo,
  wasRecentlySent,
  isEmailNotificationEnabled,
  getActiveBusinesses,
  getBusinessStats,
} from "./emailSender";
