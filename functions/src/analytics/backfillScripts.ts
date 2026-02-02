/**
 * Backfill Scripts for Promotion Views, Saves, and Redemptions Counts
 *
 * These scripts scan all analytics_events and update the corresponding
 * counts on promotions. Run once via HTTP endpoint to backfill existing data.
 *
 * Part of the Automated Engagement System - Enhancement
 *
 * Usage:
 * - GET /backfill/views - Backfill views_count for all promotions
 * - GET /backfill/saves - Backfill saves_count for all promotions
 * - GET /backfill/redemptions - Backfill redemptions_count for all promotions
 * - GET /backfill/all - Backfill all counts for all promotions
 */

import { admin, getDb } from "../utils/firebase";
import { Request, Response } from "express";

/**
 * Aggregate event counts from analytics_events collection
 */
async function aggregateEventCounts(
  eventType: "view" | "save" | "redemption"
): Promise<Map<string, number>> {
  console.log(`Aggregating ${eventType} events...`);

  const events = await getDb()
    .collection("analytics_events")
    .where("event_type", "==", eventType)
    .where("entity_type", "==", "promotion")
    .get();

  const counts = new Map<string, number>();

  events.docs.forEach((doc) => {
    const promotionId = doc.data().promotion_id;
    if (promotionId) {
      counts.set(promotionId, (counts.get(promotionId) || 0) + 1);
    }
  });

  console.log(`Found ${events.docs.length} ${eventType} events for ${counts.size} promotions`);
  return counts;
}

/**
 * Update promotions in batches (Firestore limit is 500 per batch)
 * Uses set with merge to avoid race conditions and handle non-existent documents safely
 */
async function batchUpdatePromotions(
  counts: Map<string, number>,
  fieldName: string
): Promise<number> {
  const entries = [...counts.entries()];
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += 500) {
    const batch = getDb().batch();
    const chunk = entries.slice(i, i + 500);

    // Fetch all documents in the chunk at once to check existence
    const refs = chunk.map(([promotionId]) => getDb().collection("promotions").doc(promotionId));
    const docs = await getDb().getAll(...refs);

    for (let j = 0; j < docs.length; j++) {
      const doc = docs[j];
      const [promotionId, count] = chunk[j];

      if (doc.exists) {
        // Use set with merge to safely update even if document changes between read and write
        batch.set(
          doc.ref,
          {
            [fieldName]: count,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        updatedCount++;
      } else {
        console.warn(`Promotion ${promotionId} not found, skipping`);
      }
    }

    await batch.commit();
    console.log(`Updated batch ${Math.floor(i / 500) + 1} (${chunk.length} promotions)`);
  }

  return updatedCount;
}

/**
 * Backfill views_count for all promotions
 */
export async function backfillViewsCounts(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Starting views count backfill...");

    const counts = await aggregateEventCounts("view");
    const updatedCount = await batchUpdatePromotions(counts, "views_count");

    const message = `Views count backfill complete! Updated ${updatedCount} promotions.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in views backfill:", error);
    res.status(500).send(`Error: ${error}`);
  }
}

/**
 * Backfill saves_count for all promotions
 */
export async function backfillSavesCounts(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Starting saves count backfill...");

    const counts = await aggregateEventCounts("save");
    const updatedCount = await batchUpdatePromotions(counts, "saves_count");

    const message = `Saves count backfill complete! Updated ${updatedCount} promotions.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in saves backfill:", error);
    res.status(500).send(`Error: ${error}`);
  }
}

/**
 * Backfill redemptions_count for all promotions
 */
export async function backfillRedemptionsCounts(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Starting redemptions count backfill...");

    const counts = await aggregateEventCounts("redemption");
    const updatedCount = await batchUpdatePromotions(counts, "redemptions_count");

    const message = `Redemptions count backfill complete! Updated ${updatedCount} promotions.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in redemptions backfill:", error);
    res.status(500).send(`Error: ${error}`);
  }
}

/**
 * Backfill all counts for all promotions (views, saves, redemptions)
 */
export async function backfillAllCounts(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Starting full backfill (views, saves, redemptions)...");

    // Aggregate all event types
    const viewCounts = await aggregateEventCounts("view");
    const saveCounts = await aggregateEventCounts("save");
    const redemptionCounts = await aggregateEventCounts("redemption");

    // Get all unique promotion IDs
    const allPromotionIds = new Set([
      ...viewCounts.keys(),
      ...saveCounts.keys(),
      ...redemptionCounts.keys(),
    ]);

    console.log(`Updating ${allPromotionIds.size} unique promotions...`);

    // Update all promotions in batches
    const entries = [...allPromotionIds];
    let updatedCount = 0;

    for (let i = 0; i < entries.length; i += 500) {
      const batch = getDb().batch();
      const chunk = entries.slice(i, i + 500);

      // Fetch all documents in the chunk at once
      const refs = chunk.map((promotionId) => getDb().collection("promotions").doc(promotionId));
      const docs = await getDb().getAll(...refs);

      for (let j = 0; j < docs.length; j++) {
        const doc = docs[j];
        const promotionId = chunk[j];

        if (doc.exists) {
          // Use set with merge to safely update
          batch.set(
            doc.ref,
            {
              views_count: viewCounts.get(promotionId) || 0,
              saves_count: saveCounts.get(promotionId) || 0,
              redemptions_count: redemptionCounts.get(promotionId) || 0,
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          updatedCount++;
        } else {
          console.warn(`Promotion ${promotionId} not found, skipping`);
        }
      }

      await batch.commit();
      console.log(`Updated batch ${Math.floor(i / 500) + 1} (${chunk.length} promotions)`);
    }

    const message = `Full backfill complete! Updated ${updatedCount} promotions with views, saves, and redemptions counts.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in full backfill:", error);
    res.status(500).send(`Error: ${error}`);
  }
}

/**
 * Initialize promotions with zero counts if they don't have counts set
 * Useful for ensuring all promotions have the count fields
 */
export async function initializePromotionCounts(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log("Initializing promotion counts...");

    const promotions = await getDb().collection("promotions").get();
    let updatedCount = 0;

    for (let i = 0; i < promotions.docs.length; i += 500) {
      const batch = getDb().batch();
      const chunk = promotions.docs.slice(i, i + 500);

      for (const doc of chunk) {
        const data = doc.data();

        // Only update if counts are not set
        if (
          data.views_count === undefined ||
          data.saves_count === undefined ||
          data.redemptions_count === undefined
        ) {
          batch.update(doc.ref, {
            views_count: data.views_count ?? 0,
            saves_count: data.saves_count ?? 0,
            redemptions_count: data.redemptions_count ?? 0,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          updatedCount++;
        }
      }

      await batch.commit();
      console.log(`Processed batch ${Math.floor(i / 500) + 1}`);
    }

    const message = `Initialization complete! Updated ${updatedCount} promotions with default counts.`;
    console.log(message);
    res.status(200).send(message);
  } catch (error) {
    console.error("Error in initialization:", error);
    res.status(500).send(`Error: ${error}`);
  }
}
