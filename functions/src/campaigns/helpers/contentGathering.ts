/**
 * Content Gathering Helpers for Campaign Generation
 *
 * These functions query Firestore to gather data needed for
 * generating campaign content with Claude.
 *
 * Part of the Automated Engagement System - Part A
 */

import { admin, getDb } from "../../utils/firebase";
import { ContentContext } from "./claudeApi";

// ============================================================================
// Types
// ============================================================================

interface PromotionData {
  id: string;
  title: string;
  percentage: number;
  business_id: string;
  business_name?: string;
  category?: string;
  featured_image?: string;
  views_count?: number;
  saves_count?: number;
}

interface BusinessData {
  id: string;
  name: string;
  categories: string[];
  plan: string;
  created_at: admin.firestore.Timestamp;
}

// ============================================================================
// Main Content Gathering Function
// ============================================================================

/**
 * Gather all content needed for campaign generation
 */
export async function gatherCampaignContent(): Promise<ContentContext> {
  const [topPromotions, underPromoted, enterpriseBusinesses, newBusinesses] =
    await Promise.all([
      getTopPromotionsByViews(20),
      getUnderPromotedPromotions(10),
      getEnterpriseBusinesses(),
      getNewBusinesses(7), // Last 7 days
    ]);

  return {
    topPromotions: topPromotions.map((p) => ({
      id: p.id,
      title: p.title,
      percentage: p.percentage,
      business_name: p.business_name || "Negocio",
      category: p.category || "general",
    })),
    underPromoted: underPromoted.map((p) => ({
      id: p.id,
      title: p.title,
      percentage: p.percentage,
      business_name: p.business_name || "Negocio",
    })),
    enterpriseBusinesses: enterpriseBusinesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.categories[0] || "general",
    })),
    newBusinesses: newBusinesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.categories[0] || "general",
    })),
    currentDate: new Date().toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

// ============================================================================
// Promotion Queries
// ============================================================================

/**
 * Get top N promotions by view count from analytics_events
 * (Query analytics_events, NOT promotions.views_count as per plan)
 */
async function getTopPromotionsByViews(limit: number): Promise<PromotionData[]> {
  try {
    // Get view events from the last 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const viewEvents = await getDb()
      .collection("analytics_events")
      .where("event_type", "==", "view")
      .where("entity_type", "==", "promotion")
      .where("timestamp", ">", admin.firestore.Timestamp.fromDate(twoDaysAgo))
      .get();

    // Aggregate views by promotion_id
    const viewCounts = new Map<string, number>();
    viewEvents.docs.forEach((doc) => {
      const promotionId = doc.data().promotion_id;
      if (promotionId) {
        viewCounts.set(promotionId, (viewCounts.get(promotionId) || 0) + 1);
      }
    });

    // Sort by view count and take top N
    const topPromotionIds = [...viewCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topPromotionIds.length === 0) {
      // Fallback: get any active promotions
      return getActivePromotions(limit);
    }

    // Fetch promotion details
    const promotions = await fetchPromotionsWithBusinessInfo(topPromotionIds);
    return promotions;
  } catch (error) {
    console.error("Error getting top promotions by views:", error);
    return getActivePromotions(limit);
  }
}

/**
 * Get under-promoted promotions (low view counts)
 */
async function getUnderPromotedPromotions(limit: number): Promise<PromotionData[]> {
  try {
    // Get all active promotions
    const activePromotions = await getDb()
      .collection("promotions")
      .where("status", "==", "active")
      .get();

    // Get view counts from analytics for the last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const viewEvents = await getDb()
      .collection("analytics_events")
      .where("event_type", "==", "view")
      .where("entity_type", "==", "promotion")
      .where("timestamp", ">", admin.firestore.Timestamp.fromDate(oneWeekAgo))
      .get();

    const viewCounts = new Map<string, number>();
    viewEvents.docs.forEach((doc) => {
      const promotionId = doc.data().promotion_id;
      if (promotionId) {
        viewCounts.set(promotionId, (viewCounts.get(promotionId) || 0) + 1);
      }
    });

    // Find promotions with low views (< 50)
    const underPromoted = activePromotions.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        viewCount: viewCounts.get(doc.id) || 0,
      }))
      .filter((p) => p.viewCount < 50)
      .sort((a, b) => a.viewCount - b.viewCount)
      .slice(0, limit);

    // Fetch business info
    const promotionIds = underPromoted.map((p) => p.id);
    return fetchPromotionsWithBusinessInfo(promotionIds);
  } catch (error) {
    console.error("Error getting under-promoted promotions:", error);
    return [];
  }
}

/**
 * Get any active promotions (fallback)
 */
async function getActivePromotions(limit: number): Promise<PromotionData[]> {
  try {
    const promotions = await getDb()
      .collection("promotions")
      .where("status", "==", "active")
      .limit(limit)
      .get();

    const promotionIds = promotions.docs.map((doc) => doc.id);
    return fetchPromotionsWithBusinessInfo(promotionIds);
  } catch (error) {
    console.error("Error getting active promotions:", error);
    return [];
  }
}

/**
 * Fetch promotions with their business information
 * Optimized to batch business queries and avoid N+1 queries
 */
async function fetchPromotionsWithBusinessInfo(
  promotionIds: string[]
): Promise<PromotionData[]> {
  if (promotionIds.length === 0) return [];

  const results: PromotionData[] = [];

  // Fetch promotions in batches of 10 (Firestore limitation)
  for (let i = 0; i < promotionIds.length; i += 10) {
    const batch = promotionIds.slice(i, i + 10);

    // Fetch all promotions in this batch
    const promotionRefs = batch.map((id) => getDb().collection("promotions").doc(id));
    const promotionDocs = await getDb().getAll(...promotionRefs);

    // Collect unique business IDs from promotions
    const businessIds = new Set<string>();
    for (const doc of promotionDocs) {
      if (doc.exists) {
        const businessId = doc.data()?.business_id;
        if (businessId) {
          businessIds.add(businessId);
        }
      }
    }

    // Fetch all businesses in one batch query
    const businesses = new Map<string, { name: string; category: string }>();
    if (businessIds.size > 0) {
      const businessRefs = Array.from(businessIds).map((id) =>
        getDb().collection("businesses").doc(id)
      );
      const businessDocs = await getDb().getAll(...businessRefs);

      for (const doc of businessDocs) {
        if (doc.exists) {
          const data = doc.data()!;
          businesses.set(doc.id, {
            name: data.name || "Negocio",
            category: data.categories?.[0] || "general",
          });
        }
      }
    }

    // Build results with business info from cache
    for (const doc of promotionDocs) {
      if (!doc.exists) continue;

      const data = doc.data()!;
      const businessInfo = data.business_id
        ? businesses.get(data.business_id)
        : null;

      results.push({
        id: doc.id,
        title: data.title,
        percentage: data.percentage || 0,
        business_id: data.business_id,
        business_name: businessInfo?.name || "Negocio",
        category: businessInfo?.category || "general",
        featured_image: data.featured_image,
        views_count: data.views_count,
        saves_count: data.saves_count,
      });
    }
  }

  return results;
}

// ============================================================================
// Business Queries
// ============================================================================

/**
 * Get enterprise businesses for featuring
 */
async function getEnterpriseBusinesses(): Promise<BusinessData[]> {
  try {
    const businesses = await getDb()
      .collection("businesses")
      .where("plan", "==", "enterprise")
      .where("status", "==", "active")
      .get();

    return businesses.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      categories: doc.data().categories || [],
      plan: doc.data().plan,
      created_at: doc.data().created_at,
    }));
  } catch (error) {
    console.error("Error getting enterprise businesses:", error);
    return [];
  }
}

/**
 * Get new businesses (joined in the last N days)
 */
async function getNewBusinesses(daysAgo: number): Promise<BusinessData[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    const businesses = await getDb()
      .collection("businesses")
      .where("status", "==", "active")
      .where("created_at", ">", admin.firestore.Timestamp.fromDate(cutoffDate))
      .orderBy("created_at", "desc")
      .limit(10)
      .get();

    return businesses.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      categories: doc.data().categories || [],
      plan: doc.data().plan,
      created_at: doc.data().created_at,
    }));
  } catch (error) {
    console.error("Error getting new businesses:", error);
    return [];
  }
}

// ============================================================================
// Featured Image Selection
// ============================================================================

/**
 * Get the best featured image for in-app messaging
 * Uses the top promotion's featured image
 */
export async function getBestFeaturedImage(
  context: ContentContext
): Promise<string | null> {
  if (context.topPromotions.length === 0) return null;

  try {
    const topPromotionId = context.topPromotions[0].id;
    const promotionDoc = await getDb()
      .collection("promotions")
      .doc(topPromotionId)
      .get();

    if (promotionDoc.exists) {
      return promotionDoc.data()?.featured_image || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting featured image:", error);
    return null;
  }
}

// ============================================================================
// Category Helpers
// ============================================================================

/**
 * Get category display name from category ID
 */
export async function getCategoryName(categoryId: string): Promise<string> {
  try {
    const categoryDoc = await getDb()
      .collection("business_categories")
      .doc(categoryId)
      .get();

    if (categoryDoc.exists) {
      return categoryDoc.data()?.name || categoryId;
    }
    return categoryId;
  } catch (error) {
    return categoryId;
  }
}

/**
 * Get all active categories
 */
export async function getActiveCategories(): Promise<
  Array<{ id: string; name: string }>
> {
  try {
    const categories = await getDb()
      .collection("business_categories")
      .where("status", "==", "active")
      .orderBy("sort_order")
      .get();

    return categories.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
    }));
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
}
