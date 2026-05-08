/**
 * Enterprise Business Rotation Helper
 *
 * Ensures all enterprise businesses get fair featuring in campaigns.
 * Tracks last_featured_at and rotates through businesses.
 *
 * Part of the Automated Engagement System - Part A
 */

import { getDb } from "../../utils/firebase";
import { Timestamp } from "firebase-admin/firestore"

// ============================================================================
// Types
// ============================================================================

interface EnterpriseRotationData {
  businesses: {
    [businessId: string]: {
      last_featured_at: Timestamp | null;
      feature_count: number;
      last_campaign_id: string | null;
    };
  };
  updated_at: Timestamp;
}

interface BusinessForRotation {
  id: string;
  name: string;
  categories: string[];
  last_featured_at: Date | null;
  feature_count: number;
}

// ============================================================================
// Rotation Functions
// ============================================================================

/**
 * Get enterprise businesses to feature, prioritizing those not featured recently
 */
export async function getEnterpriseBusinessesToFeature(
  count: number = 3
): Promise<BusinessForRotation[]> {
  try {
    // Get rotation metadata
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("enterprise_rotation");
    const rotationDoc = await rotationRef.get();

    let rotationData: EnterpriseRotationData["businesses"] = {};
    if (rotationDoc.exists) {
      rotationData = (rotationDoc.data() as EnterpriseRotationData).businesses || {};
    }

    // Get all active enterprise businesses
    const enterpriseBusinesses = await getDb()
      .collection("businesses")
      .where("plan", "==", "enterprise")
      .where("status", "==", "active")
      .get();

    if (enterpriseBusinesses.empty) {
      console.log("No enterprise businesses found");
      return [];
    }

    // Map businesses with their rotation data
    const businessesWithRotation: BusinessForRotation[] = enterpriseBusinesses.docs.map(
      (doc) => {
        const data = doc.data();
        const rotationInfo = rotationData[doc.id];

        return {
          id: doc.id,
          name: data.name,
          categories: data.categories || [],
          last_featured_at: rotationInfo?.last_featured_at?.toDate() || null,
          feature_count: rotationInfo?.feature_count || 0,
        };
      }
    );

    // Sort by: null dates first (never featured), then oldest featured date
    businessesWithRotation.sort((a, b) => {
      // Never featured businesses go first
      if (a.last_featured_at === null && b.last_featured_at !== null) return -1;
      if (a.last_featured_at !== null && b.last_featured_at === null) return 1;
      if (a.last_featured_at === null && b.last_featured_at === null) {
        // Both never featured - sort by feature_count (lower first)
        return a.feature_count - b.feature_count;
      }

      // Both have been featured - oldest first
      return a.last_featured_at!.getTime() - b.last_featured_at!.getTime();
    });

    // Return top N businesses
    return businessesWithRotation.slice(0, count);
  } catch (error) {
    console.error("Error getting enterprise businesses for rotation:", error);
    return [];
  }
}

/**
 * Update rotation data after featuring businesses in a campaign
 */
export async function updateEnterpriseRotation(
  businessIds: string[],
  campaignId: string
): Promise<void> {
  if (businessIds.length === 0) return;

  try {
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("enterprise_rotation");
    const rotationDoc = await rotationRef.get();

    let rotationData: EnterpriseRotationData["businesses"] = {};
    if (rotationDoc.exists) {
      rotationData = (rotationDoc.data() as EnterpriseRotationData).businesses || {};
    }

    const now = Timestamp.now();

    // Update each featured business
    for (const businessId of businessIds) {
      const existing = rotationData[businessId] || {
        last_featured_at: null,
        feature_count: 0,
        last_campaign_id: null,
      };

      rotationData[businessId] = {
        last_featured_at: now,
        feature_count: existing.feature_count + 1,
        last_campaign_id: campaignId,
      };
    }

    // Save updated rotation data
    await rotationRef.set(
      {
        businesses: rotationData,
        updated_at: now,
      },
      { merge: true }
    );

    console.log(
      `Updated enterprise rotation for ${businessIds.length} businesses in campaign ${campaignId}`
    );
  } catch (error) {
    console.error("Error updating enterprise rotation:", error);
    throw error;
  }
}

/**
 * Get rotation statistics for admin dashboard
 */
export async function getRotationStats(): Promise<{
  totalEnterprise: number;
  featuredAtLeastOnce: number;
  neverFeatured: number;
  averageFeatureCount: number;
  lastUpdated: Date | null;
}> {
  try {
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("enterprise_rotation");
    const rotationDoc = await rotationRef.get();

    // Get total enterprise count
    const enterpriseCount = await getDb()
      .collection("businesses")
      .where("plan", "==", "enterprise")
      .where("status", "==", "active")
      .count()
      .get();

    if (!rotationDoc.exists) {
      return {
        totalEnterprise: enterpriseCount.data().count,
        featuredAtLeastOnce: 0,
        neverFeatured: enterpriseCount.data().count,
        averageFeatureCount: 0,
        lastUpdated: null,
      };
    }

    const data = rotationDoc.data() as EnterpriseRotationData;
    const businesses = Object.values(data.businesses);

    const featuredAtLeastOnce = businesses.filter(
      (b) => b.feature_count > 0
    ).length;
    const totalFeatures = businesses.reduce((sum, b) => sum + b.feature_count, 0);

    return {
      totalEnterprise: enterpriseCount.data().count,
      featuredAtLeastOnce,
      neverFeatured: enterpriseCount.data().count - featuredAtLeastOnce,
      averageFeatureCount:
        featuredAtLeastOnce > 0 ? totalFeatures / featuredAtLeastOnce : 0,
      lastUpdated: data.updated_at?.toDate() || null,
    };
  } catch (error) {
    console.error("Error getting rotation stats:", error);
    throw error;
  }
}

// ============================================================================
// General Business Rotation (all plans, not just enterprise)
// ============================================================================

interface GeneralRotationData {
  businesses: {
    [businessId: string]: {
      last_featured_at: Timestamp | null;
      feature_count: number;
    };
  };
  updated_at: Timestamp;
}

/**
 * Get non-enterprise businesses to feature, prioritising those least recently shown.
 * New businesses (never featured) always come first.
 */
export async function getGeneralBusinessesToFeature(
  count: number = 3
): Promise<BusinessForRotation[]> {
  try {
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("general_rotation");
    const rotationDoc = await rotationRef.get();

    const rotationData: GeneralRotationData["businesses"] = rotationDoc.exists
      ? ((rotationDoc.data() as GeneralRotationData).businesses ?? {})
      : {};

    const snapshot = await getDb()
      .collection("businesses")
      .where("status", "==", "active")
      .get();

    if (snapshot.empty) return [];

    const businesses: BusinessForRotation[] = snapshot.docs
      .filter((doc) => doc.data().plan !== "enterprise")
      .map((doc) => {
        const data = doc.data();
        const info = rotationData[doc.id];
        return {
          id: doc.id,
          name: data.name,
          categories: data.categories || [],
          last_featured_at: info?.last_featured_at?.toDate() ?? null,
          feature_count: info?.feature_count ?? 0,
        };
      });

    // Never-featured first, then oldest-featured
    businesses.sort((a, b) => {
      if (!a.last_featured_at && b.last_featured_at) return -1;
      if (a.last_featured_at && !b.last_featured_at) return 1;
      if (!a.last_featured_at && !b.last_featured_at) return a.feature_count - b.feature_count;
      return a.last_featured_at!.getTime() - b.last_featured_at!.getTime();
    });

    return businesses.slice(0, count);
  } catch (error) {
    console.error("Error getting general businesses for rotation:", error);
    return [];
  }
}

/**
 * Update general rotation tracking after a campaign is sent.
 */
export async function updateGeneralRotation(
  businessIds: string[],
  campaignId: string
): Promise<void> {
  if (businessIds.length === 0) return;

  try {
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("general_rotation");
    const rotationDoc = await rotationRef.get();

    const rotationData: GeneralRotationData["businesses"] = rotationDoc.exists
      ? ((rotationDoc.data() as GeneralRotationData).businesses ?? {})
      : {};

    const now = Timestamp.now();
    for (const id of businessIds) {
      const existing = rotationData[id] ?? { last_featured_at: null, feature_count: 0 };
      rotationData[id] = {
        last_featured_at: now,
        feature_count: existing.feature_count + 1,
      };
    }

    await rotationRef.set({ businesses: rotationData, updated_at: now }, { merge: true });
    console.log(`Updated general rotation for ${businessIds.length} businesses in campaign ${campaignId}`);
  } catch (error) {
    console.error("Error updating general rotation:", error);
    throw error;
  }
}

/**
 * Reset rotation data (admin function)
 */
export async function resetRotationData(): Promise<void> {
  try {
    const rotationRef = getDb()
      .collection("campaigns_metadata")
      .doc("enterprise_rotation");

    await rotationRef.set({
      businesses: {},
      updated_at: Timestamp.now(),
    });

    console.log("Enterprise rotation data reset");
  } catch (error) {
    console.error("Error resetting rotation data:", error);
    throw error;
  }
}
