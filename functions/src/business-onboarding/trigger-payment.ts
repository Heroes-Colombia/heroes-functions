import * as functions from "firebase-functions/v1";
import {
  getOnboardingBusinessInfo,
  sendOnboardingEmail,
  wasEverSent,
} from "./helpers";
import { getBusinessPaymentConfirmedEmail } from "./email-payment-confirmed";
import { getAnnualUpgradeEmail } from "./email-annual-upgrade";

export const onBusinessPaymentConfirmed = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("businesses/{businessId}")
  .onUpdate(async (change, context) => {
    const businessId = context.params.businessId;
    const before = change.before.data();
    const after = change.after.data();

    const wasPaymentPending = before.subscription?.status === "pending_payment";
    const isNowActive = ["trial", "active"].includes(after.subscription?.status);

    if (!wasPaymentPending || !isNowActive) {
      return null;
    }

    // Guard against duplicate sends (e.g., if the document is updated twice)
    if (await wasEverSent(businessId, "business_payment_confirmed")) {
      console.log(`Payment confirmed email already sent for business: ${businessId}`);
      return null;
    }

    const business = await getOnboardingBusinessInfo(businessId);
    if (!business) {
      console.log(`No valid business info found for ${businessId}`);
      return null;
    }

    console.log(`Sending payment confirmed email for business: ${businessId} (${business.name})`);

    try {
      const emailContent = getBusinessPaymentConfirmedEmail(business);
      const result = await sendOnboardingEmail(business, "business_payment_confirmed", emailContent);

      if (result.success) {
        console.log(`Payment confirmed email sent to ${business.owner_email} for business: ${businessId}`);
      } else {
        console.error(`Failed to send payment confirmed email for ${businessId}: ${result.error}`);
      }

      return null;
    } catch (error) {
      console.error(`Error sending payment confirmed email for business ${businessId}:`, error);
      return null;
    }
  });

/**
 * Fires when a business upgrades from trial to annual plan (trial → active).
 * Sends a thank-you email — they've already been onboarded, this is about the trust.
 */
export const onBusinessAnnualUpgrade = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("businesses/{businessId}")
  .onUpdate(async (change, context) => {
    const businessId = context.params.businessId;
    const before = change.before.data();
    const after = change.after.data();

    const wasOnTrial = before.subscription?.status === "trial";
    const isNowActive = after.subscription?.status === "active";

    if (!wasOnTrial || !isNowActive) {
      return null;
    }

    if (await wasEverSent(businessId, "business_annual_upgrade")) {
      console.log(`Annual upgrade email already sent for business: ${businessId}`);
      return null;
    }

    const business = await getOnboardingBusinessInfo(businessId);
    if (!business) {
      console.log(`No valid business info found for ${businessId}`);
      return null;
    }

    console.log(`Sending annual upgrade email for business: ${businessId} (${business.name})`);

    try {
      const emailContent = getAnnualUpgradeEmail(business);
      const result = await sendOnboardingEmail(business, "business_annual_upgrade", emailContent);

      if (result.success) {
        console.log(`Annual upgrade email sent to ${business.owner_email} for business: ${businessId}`);
      } else {
        console.error(`Failed to send annual upgrade email for ${businessId}: ${result.error}`);
      }

      return null;
    } catch (error) {
      console.error(`Error sending annual upgrade email for business ${businessId}:`, error);
      return null;
    }
  });
