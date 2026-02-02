/**
 * Claude API Wrapper for AI Content Generation
 *
 * This module provides functions to generate campaign content using Claude.
 * Uses the official @anthropic-ai/sdk package.
 *
 * Part of the Automated Engagement System - Part A
 */

import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client with API key from Firebase secrets
// Set secret via: firebase functions:secrets:set CLAUDE_API_KEY
const getAnthropicClient = (): Anthropic => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
};

// ============================================================================
// System Prompts
// ============================================================================

export const SYSTEM_PROMPTS = {
  /**
   * System prompt for consumer campaign content generation
   */
  consumerCampaign: `You are a marketing specialist for Heroes Colombia, a platform connecting Colombian military personnel with exclusive business discounts.

Generate engaging notification content that:
1. Celebrates and honors military service with a friendly, warm tone
2. Highlights specific savings and value when applicable
3. Creates community feeling among heroes
4. Drives immediate action
5. Feels NATURAL and HUMAN - like a friend recommending something

CONTENT TYPES (rotate between these):
- PROMOTIONAL: Specific deals with percentages and business names
- THEMATIC: Lifestyle goals (fitness, health, family), seasonal
- NEWS: New businesses joining, new categories
- TIPS: App features, how to maximize savings

TONE: Friendly, casual (tú is OK but not usted). Include emojis sparingly.

RULES:
- Spanish (Colombia)
- Push titles: max 50 chars
- Push bodies: max 150 chars
- Be specific, never generic
- Reference real business names and percentages when provided
- NEVER use formal "usted" - use friendly "tú" communication`,

  /**
   * System prompt for monthly platform update in business reports
   */
  platformUpdate: `You are Jonathan González, Director of Heroes Colombia.
Generate a brief, optimistic platform update for the monthly business report.

This appears at the END of the monthly email, before your signature.

REQUIREMENTS:
- Written personally by you in first person
- Focus on qualitative growth, community, and impact
- DO NOT include specific numbers (user counts, business counts, etc.)
- Mention things like:
  - Growing community of heroes discovering businesses
  - Expansion to new cities/regions (general terms)
  - New features coming soon (vague)
  - Gratitude for businesses being part of the mission
- Include personal invitation to respond with feedback
- Tone: Optimistic, grateful, forward-looking
- Length: 2-3 short paragraphs
- Include Colombian flag emoji 🇨🇴 naturally
- Spanish (Colombia)

Output clean HTML for this section (div with background, heading, paragraphs).`,

  /**
   * System prompt for business notification emails
   */
  businessNotification: `You are Jonathan González, Director of Heroes Colombia.
Write personal, friendly business notification emails.

STYLE:
- First person, personal tone
- Friendly but professional
- Supportive and helpful, not pushy
- Spanish (Colombia)
- NEVER use formal "usted" - use "tú" for a personal touch

Include actionable recommendations when appropriate.`,
};

// ============================================================================
// Content Generation Types
// ============================================================================

export interface PushContent {
  title: string; // Max 50 chars
  body: string; // Max 150 chars
  deep_link: string;
}

export interface InAppContent {
  title: string;
  body: string;
  image_url: string;
  featured_promotions: string[];
  button_text: string;
  button_action: string;
}

export interface EmailSection {
  headline: string;
  promotions: string[];
  cta_text: string;
}

export interface EmailContent {
  subject: string;
  preheader: string;
  sections: EmailSection[];
  footer_text: string;
}

export type ContentCategory = "promotional" | "thematic" | "news" | "tips";
export type Tone = "professional_patriotic" | "friendly" | "urgency" | "celebratory";

export interface ContentContext {
  topPromotions: Array<{
    id: string;
    title: string;
    percentage: number;
    business_name: string;
    category: string;
  }>;
  underPromoted: Array<{
    id: string;
    title: string;
    percentage: number;
    business_name: string;
  }>;
  enterpriseBusinesses: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  newBusinesses: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  currentDate: string;
  specialOccasion?: string; // e.g., "Día del Padre", "Navidad"
}

// ============================================================================
// Content Generation Functions
// ============================================================================

/**
 * Generate push notification content using Claude
 */
export async function generatePushContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<PushContent> {
  const anthropic = getAnthropicClient();

  const prompt = buildPushPrompt(context, category, tone);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPTS.consumerCampaign,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    // Parse the JSON response
    const content = JSON.parse(textContent.text) as PushContent;

    // Validate length limits
    if (content.title.length > 50) {
      content.title = content.title.substring(0, 47) + "...";
    }
    if (content.body.length > 150) {
      content.body = content.body.substring(0, 147) + "...";
    }

    return content;
  } catch (error) {
    console.error("Error generating push content:", error);
    throw error;
  }
}

/**
 * Generate in-app messaging content using Claude
 */
export async function generateInAppContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<InAppContent> {
  const anthropic = getAnthropicClient();

  const prompt = buildInAppPrompt(context, category, tone);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPTS.consumerCampaign,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    return JSON.parse(textContent.text) as InAppContent;
  } catch (error) {
    console.error("Error generating in-app content:", error);
    throw error;
  }
}

/**
 * Generate email campaign content using Claude
 */
export async function generateEmailContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<EmailContent> {
  const anthropic = getAnthropicClient();

  const prompt = buildEmailPrompt(context, category, tone);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPTS.consumerCampaign,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    return JSON.parse(textContent.text) as EmailContent;
  } catch (error) {
    console.error("Error generating email content:", error);
    throw error;
  }
}

/**
 * Generate monthly platform update for business reports
 */
export async function generatePlatformUpdate(): Promise<string> {
  const anthropic = getAnthropicClient();

  const currentMonth = new Date().toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });

  const prompt = `Generate the monthly platform update for ${currentMonth}.

Return only the HTML content, no explanation. Use this structure:
<div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
  <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">[Emoji] [Title]</h3>
  <p style="color: #333; line-height: 1.6;">[Paragraph 1]</p>
  <p style="color: #333; line-height: 1.6;">[Paragraph 2]</p>
</div>`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPTS.platformUpdate,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    return textContent.text;
  } catch (error) {
    console.error("Error generating platform update:", error);
    throw error;
  }
}

// ============================================================================
// Prompt Builders
// ============================================================================

function buildPushPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): string {
  const promotionsList = context.topPromotions
    .slice(0, 5)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% descuento)`)
    .join("\n");

  const newBusinessesList = context.newBusinesses
    .slice(0, 3)
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  return `Generate a push notification for Heroes Colombia.

CONTENT CATEGORY: ${category}
TONE: ${tone}
DATE: ${context.currentDate}
${context.specialOccasion ? `SPECIAL OCCASION: ${context.specialOccasion}` : ""}

AVAILABLE DATA:

TOP PROMOTIONS:
${promotionsList || "No promotions available"}

NEW BUSINESSES:
${newBusinessesList || "No new businesses"}

OUTPUT FORMAT (JSON):
{
  "title": "Max 50 chars, engaging, with emoji",
  "body": "Max 150 chars, compelling call to action",
  "deep_link": "heroescolombia://promotions or heroescolombia://businesses"
}

Generate content that matches the category (${category}). Be creative and natural.
Return ONLY the JSON, no explanation.`;
}

function buildInAppPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): string {
  const topPromotion = context.topPromotions[0];
  const featuredPromotions = context.topPromotions.slice(0, 5).map((p) => p.id);

  return `Generate an in-app message for Heroes Colombia.

CONTENT CATEGORY: ${category}
TONE: ${tone}
DATE: ${context.currentDate}
${context.specialOccasion ? `SPECIAL OCCASION: ${context.specialOccasion}` : ""}

FEATURED PROMOTION (for image):
${topPromotion ? `${topPromotion.business_name}: ${topPromotion.title} (${topPromotion.percentage}%)` : "None"}
Image URL will be provided separately.

OUTPUT FORMAT (JSON):
{
  "title": "Engaging title",
  "body": "Compelling description (2-3 sentences)",
  "image_url": "",
  "featured_promotions": ${JSON.stringify(featuredPromotions)},
  "button_text": "Call to action button text",
  "button_action": "heroescolombia://promotions"
}

Generate content that matches the category (${category}).
Return ONLY the JSON, no explanation.`;
}

function buildEmailPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): string {
  const promotionsList = context.topPromotions
    .slice(0, 10)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}%)`)
    .join("\n");

  return `Generate an email campaign for Heroes Colombia.

CONTENT CATEGORY: ${category}
TONE: ${tone}
DATE: ${context.currentDate}
${context.specialOccasion ? `SPECIAL OCCASION: ${context.specialOccasion}` : ""}

TOP PROMOTIONS:
${promotionsList || "No promotions available"}

OUTPUT FORMAT (JSON):
{
  "subject": "Email subject line (compelling, personalized)",
  "preheader": "Preview text for email (max 100 chars)",
  "sections": [
    {
      "headline": "Section headline",
      "promotions": ["promo_id_1", "promo_id_2"],
      "cta_text": "Call to action text"
    }
  ],
  "footer_text": "Closing message"
}

Generate content with 2-3 sections. Use promotion IDs from: ${context.topPromotions.map((p) => p.id).join(", ")}
Return ONLY the JSON, no explanation.`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine content category based on date and context
 */
export function determineContentCategory(date: Date): ContentCategory {
  const dayOfWeek = date.getDay();

  // Rotate categories throughout the week
  // Monday/Thursday: promotional
  // Tuesday/Friday: thematic
  // Wednesday: news
  // Saturday/Sunday: tips

  if (dayOfWeek === 1 || dayOfWeek === 4) return "promotional";
  if (dayOfWeek === 2 || dayOfWeek === 5) return "thematic";
  if (dayOfWeek === 3) return "news";
  return "tips";
}

/**
 * Determine tone based on context and special occasions
 */
export function determineTone(date: Date, specialOccasion?: string): Tone {
  if (specialOccasion) {
    if (
      specialOccasion.toLowerCase().includes("navidad") ||
      specialOccasion.toLowerCase().includes("año nuevo")
    ) {
      return "celebratory";
    }
    if (specialOccasion.toLowerCase().includes("día")) {
      return "professional_patriotic";
    }
  }

  // Default rotation based on day
  const dayOfMonth = date.getDate();
  if (dayOfMonth % 4 === 0) return "urgency";
  if (dayOfMonth % 4 === 1) return "celebratory";
  if (dayOfMonth % 4 === 2) return "professional_patriotic";
  return "friendly";
}

/**
 * Check for special Colombian occasions
 */
export function checkSpecialOccasion(date: Date): string | undefined {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  const occasions: Record<string, string> = {
    "1-1": "Año Nuevo",
    "3-8": "Día de la Mujer",
    "5-1": "Día del Trabajo",
    "6-18": "Día del Padre", // Approximate - third Sunday of June
    "7-20": "Día de la Independencia",
    "8-7": "Batalla de Boyacá",
    "10-12": "Día de la Raza",
    "11-11": "Día de la Independencia de Cartagena",
    "12-25": "Navidad",
    "12-31": "Fin de Año",
  };

  return occasions[`${month}-${day}`];
}
