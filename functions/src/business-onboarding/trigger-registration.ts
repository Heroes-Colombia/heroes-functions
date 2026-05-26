import * as functions from "firebase-functions/v1";
import { getOnboardingBusinessInfo, sendOnboardingEmail } from "./helpers";
import { getBusinessWelcomeEmail } from "./email-welcome";

export const onBusinessRegistration = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("businesses/{businessId}")
  .onCreate(async (snap, context) => {
    const businessId = context.params.businessId;
    const data = snap.data();

    // Only process businesses pending payment (all new registrations)
    if (data.subscription?.status !== "pending_payment") {
      console.log(`Skipping welcome email for business ${businessId}: unexpected status ${data.subscription?.status}`);
      return null;
    }

    const business = await getOnboardingBusinessInfo(businessId);
    if (!business) {
      console.log(`No valid business info found for ${businessId}`);
      return null;
    }

    console.log(`Sending welcome email to new business: ${businessId} (${business.name})`);

    try {
      const emailContent = getBusinessWelcomeEmail(business);
      const result = await sendOnboardingEmail(business, "business_welcome", emailContent);

      if (result.success) {
        console.log(`Welcome email sent to ${business.owner_email} for business: ${businessId}`);
      } else {
        console.error(`Failed to send welcome email for ${businessId}: ${result.error}`);
      }

      return null;
    } catch (error) {
      console.error(`Error sending welcome email for business ${businessId}:`, error);
      return null;
    }
  });
