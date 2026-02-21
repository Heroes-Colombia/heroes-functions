/**
 * Analytics Triggers for Promotion Views and Saves Counts
 *
 * These Cloud Functions automatically update views_count and saves_count
 * on promotions when analytics events are created.
 *
 * Part of the Automated Engagement System - Enhancement
 */

import * as functions from "firebase-functions/v1";
import { admin, getDb } from "../utils/firebase";

/**
 * Updates views_count on a promotion when a "view" analytics event is created
 *
 * Triggered by: analytics_events collection document creation
 * Condition: event_type === "view" AND entity_type === "promotion"
 */
export const updateViewsCount = functions.firestore
  .document("analytics_events/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();

    // Only process promotion view events
    if (event.event_type !== "view" || event.entity_type !== "promotion") {
      return null;
    }

    const promotionId = event.entity_id;
    if (!promotionId) {
      console.warn("View event missing promotion_id:", context.params.eventId);
      return null;
    }

    try {
      const promotionRef = getDb().collection("promotions").doc(promotionId);

      // Check if promotion exists before updating
      const promotionDoc = await promotionRef.get();
      if (!promotionDoc.exists) {
        console.warn("Promotion not found for view event:", promotionId);
        return null;
      }

      await promotionRef.update({
        views_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Updated views_count for promotion: ${promotionId}`);
      return null;
    } catch (error) {
      console.error("Error updating views_count:", error);
      return null;
    }
  });

/**
 * Updates saves_count on a promotion when a "save" analytics event is created
 *
 * Triggered by: analytics_events collection document creation
 * Condition: event_type === "save" AND entity_type === "promotion"
 */
export const updateSavesCount = functions.firestore
  .document("analytics_events/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();

    // Only process promotion save events
    if (event.event_type !== "save" || event.entity_type !== "promotion") {
      return null;
    }

    const promotionId = event.entity_id;
    if (!promotionId) {
      console.warn("Save event missing promotion_id:", context.params.eventId);
      return null;
    }

    try {
      const promotionRef = getDb().collection("promotions").doc(promotionId);

      // Check if promotion exists before updating
      const promotionDoc = await promotionRef.get();
      if (!promotionDoc.exists) {
        console.warn("Promotion not found for save event:", promotionId);
        return null;
      }

      await promotionRef.update({
        saves_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Updated saves_count for promotion: ${promotionId}`);
      return null;
    } catch (error) {
      console.error("Error updating saves_count:", error);
      return null;
    }
  });
