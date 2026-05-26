import * as functions from "firebase-functions/v1";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../utils/firebase";
import {
  getOnboardingBusinessInfo,
  sendOnboardingEmail,
  wasEverSent,
  OnboardingNotificationType,
  BusinessInfo,
} from "./helpers";
import {
  getPrePayDripDay1Email,
  getPrePayDripDay2Email,
  getPrePayDripDay5Email,
  getPrePayDripDay7Email,
} from "./email-drip-prepay";
import {
  getOnboardingDay1Email,
  getOnboardingDay3Email,
  getOnboardingDay7Email,
  getOnboardingDay14Email,
  getOnboardingDay30Email,
  getOnboardingDay45Email,
} from "./email-drip-onboard";
import {
  getReengagementDay3Email,
  getReengagementDay10Email,
  getReengagementDay20Email,
} from "./email-drip-reengagement";

const BATCH_SIZE = 10;

// ============================================================================
// Pre-payment drip schedule
// ============================================================================

interface DripStep {
  day: number;
  type: OnboardingNotificationType;
  getEmail: (business: BusinessInfo) => { subject: string; html: string };
}

const PRE_PAY_SCHEDULE: DripStep[] = [
  { day: 1, type: "drip_prepay_day1", getEmail: getPrePayDripDay1Email },
  { day: 2, type: "drip_prepay_day2", getEmail: getPrePayDripDay2Email },
  { day: 5, type: "drip_prepay_day5", getEmail: getPrePayDripDay5Email },
  { day: 7, type: "drip_prepay_day7", getEmail: getPrePayDripDay7Email },
];

const ONBOARDING_SCHEDULE: DripStep[] = [
  { day: 1,  type: "drip_onboard_day1",  getEmail: getOnboardingDay1Email },
  { day: 3,  type: "drip_onboard_day3",  getEmail: getOnboardingDay3Email },
  { day: 7,  type: "drip_onboard_day7",  getEmail: getOnboardingDay7Email },
  { day: 14, type: "drip_onboard_day14", getEmail: getOnboardingDay14Email },
  { day: 30, type: "drip_onboard_day30", getEmail: getOnboardingDay30Email },
  { day: 45, type: "drip_onboard_day45", getEmail: getOnboardingDay45Email },
];

const REENGAGEMENT_SCHEDULE: DripStep[] = [
  { day: 3,  type: "drip_reengagement_day3",  getEmail: getReengagementDay3Email },
  { day: 10, type: "drip_reengagement_day10", getEmail: getReengagementDay10Email },
  { day: 20, type: "drip_reengagement_day20", getEmail: getReengagementDay20Email },
];

function daysSince(timestamp: Timestamp): number {
  const ms = Date.now() - timestamp.toMillis();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function processStep(
  business: BusinessInfo,
  step: DripStep
): Promise<"sent" | "skipped" | "error"> {
  try {
    if (await wasEverSent(business.id, step.type)) {
      return "skipped";
    }
    const emailContent = step.getEmail(business);
    const result = await sendOnboardingEmail(business, step.type, emailContent);
    return result.success ? "sent" : "error";
  } catch (err) {
    console.error(`Error processing ${step.type} for business ${business.id}:`, err);
    return "error";
  }
}

async function processBatch(
  businessIds: string[],
  getStep: (id: string, data: FirebaseFirestore.DocumentData) => Promise<DripStep | null>,
  docs: Map<string, FirebaseFirestore.DocumentData>
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;

  for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
    const batch = businessIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (businessId) => {
        const data = docs.get(businessId)!;
        const step = await getStep(businessId, data);
        if (!step) return "skipped";

        const business = await getOnboardingBusinessInfo(businessId);
        if (!business) return "skipped";

        return processStep(business, step);
      })
    );

    for (const status of results) {
      if (status === "sent") sent++;
      else if (status === "error") errors++;
      else skipped++;
    }

    // Rate-limit between batches
    if (i + BATCH_SIZE < businessIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent, skipped, errors };
}

// ============================================================================
// Main scheduled function
// ============================================================================

export const businessDripSequence = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 300 })
  .pubsub.schedule("0 10 * * *")
  .timeZone("America/Bogota")
  .onRun(async () => {
    console.log("Starting businessDripSequence...");
    const db = getDb();

    // -------------------------------------------------------------------------
    // Phase 1: Pre-payment drip
    // -------------------------------------------------------------------------
    const pendingSnap = await db
      .collection("businesses")
      .where("subscription.status", "==", "pending_payment")
      .get();

    const pendingDocs = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of pendingSnap.docs) {
      pendingDocs.set(doc.id, doc.data());
    }

    const phase1 = await processBatch(
      Array.from(pendingDocs.keys()),
      async (businessId, data) => {
        const createdAt: Timestamp | undefined = data.created_at;
        if (!createdAt) return null;

        const days = daysSince(createdAt);
        // Window approach: each step is only active between its day and the next step's day
        const currentStep = PRE_PAY_SCHEDULE.find((s, i) => {
          const next = PRE_PAY_SCHEDULE[i + 1];
          return days >= s.day && (!next || days < next.day);
        });
        if (!currentStep) return null;
        if (await wasEverSent(businessId, currentStep.type)) return null;
        return currentStep;
      },
      pendingDocs
    );

    console.log(`Phase 1 (pre-pay): sent=${phase1.sent}, skipped=${phase1.skipped}, errors=${phase1.errors}`);

    // -------------------------------------------------------------------------
    // Phase 2: Post-payment onboarding
    // -------------------------------------------------------------------------
    const activeSnap = await db
      .collection("businesses")
      .where("subscription.status", "in", ["trial", "active"])
      .get();

    const activeDocs = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of activeSnap.docs) {
      const data = doc.data();
      // Only include businesses that have a start_date (payment confirmed)
      if (data.subscription?.start_date) {
        activeDocs.set(doc.id, data);
      }
    }

    const phase2 = await processBatch(
      Array.from(activeDocs.keys()),
      async (businessId, data) => {
        const startDate: Timestamp | undefined = data.subscription?.start_date;
        if (!startDate) return null;

        const days = daysSince(startDate);
        // Window approach: each step is only active between its day and the next step's day
        const currentStep = ONBOARDING_SCHEDULE.find((s, i) => {
          const next = ONBOARDING_SCHEDULE[i + 1];
          return days >= s.day && (!next || days < next.day);
        });
        if (!currentStep) return null;
        if (await wasEverSent(businessId, currentStep.type)) return null;
        return currentStep;
      },
      activeDocs
    );

    console.log(`Phase 2 (onboarding): sent=${phase2.sent}, skipped=${phase2.skipped}, errors=${phase2.errors}`);

    // -------------------------------------------------------------------------
    // Phase 3: Re-engagement drip for expired businesses
    // -------------------------------------------------------------------------
    const expiredSnap = await db
      .collection("businesses")
      .where("subscription.status", "==", "expired")
      .get();

    const expiredDocs = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of expiredSnap.docs) {
      const data = doc.data();
      if (data.subscription?.updated_at) {
        expiredDocs.set(doc.id, data);
      }
    }

    const phase3 = await processBatch(
      Array.from(expiredDocs.keys()),
      async (businessId, data) => {
        // Hard stop: skip if they've renewed since this batch started
        const fresh = await db.collection("businesses").doc(businessId).get();
        if (fresh.data()?.subscription?.status !== "expired") return null;

        const expiredAt: Timestamp | undefined = data.subscription?.updated_at;
        if (!expiredAt) return null;

        const days = daysSince(expiredAt);
        // Window approach: each step is only active between its day and the next step's day
        const currentStep = REENGAGEMENT_SCHEDULE.find((s, i) => {
          const next = REENGAGEMENT_SCHEDULE[i + 1];
          return days >= s.day && (!next || days < next.day);
        });
        if (!currentStep) return null;
        if (await wasEverSent(businessId, currentStep.type)) return null;
        return currentStep;
      },
      expiredDocs
    );

    console.log(`Phase 3 (re-engagement): sent=${phase3.sent}, skipped=${phase3.skipped}, errors=${phase3.errors}`);
    console.log("businessDripSequence complete.");
    return null;
  });
