import { Resend } from "resend";
import { getDb } from "../utils/firebase";
import { FieldValue } from "firebase-admin/firestore";
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
} from "../business-notifications/emailTemplates";

export { EMAIL_FROM, EMAIL_REPLY_TO };

// ============================================================================
// Types
// ============================================================================

export interface BusinessInfo {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
}

export type OnboardingNotificationType =
  | "business_welcome"
  | "business_payment_confirmed"
  | "drip_prepay_day1"
  | "drip_prepay_day2"
  | "drip_prepay_day5"
  | "drip_prepay_day7"
  | "drip_onboard_day1"
  | "drip_onboard_day3"
  | "drip_onboard_day7"
  | "drip_onboard_day14"
  | "drip_onboard_day30"
  | "drip_onboard_day45"
  | "drip_reengagement_day3"
  | "drip_reengagement_day10"
  | "drip_reengagement_day20"
  | "business_annual_upgrade";

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
// Business Info
// ============================================================================

export async function getOnboardingBusinessInfo(
  businessId: string
): Promise<BusinessInfo | null> {
  const doc = await getDb().collection("businesses").doc(businessId).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  const ownerEmail: string = data.email || "";
  const ownerName: string = data.owner_name || "";
  const name: string = data.name || "";

  if (!ownerEmail) return null;

  return { id: businessId, name, owner_name: ownerName, owner_email: ownerEmail };
}

// ============================================================================
// Deduplication
// ============================================================================

export async function wasEverSent(
  businessId: string,
  notificationType: OnboardingNotificationType
): Promise<boolean> {
  const snapshot = await getDb()
    .collection("business_notifications")
    .where("business_id", "==", businessId)
    .where("notification_type", "==", notificationType)
    .where("status", "==", "sent")
    .limit(1)
    .get();

  return !snapshot.empty;
}

// ============================================================================
// Send + Log
// ============================================================================

export async function sendOnboardingEmail(
  business: BusinessInfo,
  notificationType: OnboardingNotificationType,
  emailContent: { subject: string; html: string }
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  const record = {
    business_id: business.id,
    notification_type: notificationType,
    status: "pending",
    email_content: {
      subject: emailContent.subject,
      body_html: emailContent.html,
    },
    created_at: FieldValue.serverTimestamp(),
    recipient_email: business.owner_email,
    owner_name: business.owner_name,
    business_name: business.name,
  };

  const docRef = await db.collection("business_notifications").add(record);

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: EMAIL_FROM,
      to: business.owner_email,
      replyTo: EMAIL_REPLY_TO,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    await docRef.update({
      status: "sent",
      sent_at: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await docRef.update({
      status: "failed",
      error_message: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}
