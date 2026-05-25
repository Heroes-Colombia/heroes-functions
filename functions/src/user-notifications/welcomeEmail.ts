import * as functions from "firebase-functions/v1";
import { Resend } from "resend";
import { EMAIL_FROM, EMAIL_REPLY_TO, getWelcomeEmailTemplate } from "./emailTemplates";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

export const onUserSignup = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .firestore.document("users/{userId}")
  .onCreate(async (snap, context) => {
    const user = snap.data();
    const userId = context.params.userId;

    // Skip admin accounts
    if (user.permission === "admin") {
      console.log(`Skipping welcome email for admin user: ${userId}`);
      return null;
    }

    const email: string = user.email;
    const firstName: string = user.first_name || "Héroe";
    const rank: string = user.rank || "";

    if (!email) {
      console.log(`No email found for user: ${userId}`);
      return null;
    }

    console.log(`Sending welcome email to new user: ${userId}`);

    try {
      const resend = getResendClient();
      const emailContent = getWelcomeEmailTemplate(firstName, rank);

      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        replyTo: EMAIL_REPLY_TO,
        subject: emailContent.subject,
        html: emailContent.html,
      });

      console.log(`Welcome email sent to ${email} for user: ${userId}`);
      return null;
    } catch (error) {
      console.error(`Failed to send welcome email for user ${userId}:`, error);
      return null;
    }
  });
