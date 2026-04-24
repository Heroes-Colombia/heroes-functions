/**
 * AI Content Generation using Google Gemini
 *
 * Generates Spanish campaign content for Heroes Colombia users using Gemini 2.0 Flash (free tier).
 *
 * Part of the Automated Engagement System - Part A
 */

import { VertexAI } from "@google-cloud/vertexai";

// ============================================================================
// Types
// ============================================================================

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
  specialOccasion?: string;
}

export interface PushContent {
  title: string;
  body: string;
}

export interface InAppContent {
  title: string;
  body: string;
  image_url: string;
  featured_promotions: string[];
  button_text: string;
  button_action: string;
}

export interface EmailContent {
  subject: string;
  preheader: string;
  sections: Array<{
    headline: string;
    promotions: string[];
    cta_text: string;
  }>;
  footer_text: string;
}

export type ContentCategory = "promotional" | "thematic" | "news" | "tips";
export type Tone =
  | "friendly"
  | "urgency"
  | "celebratory"
  | "professional_patriotic";

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPTS = {
  consumerCampaign: `Eres el asistente de marketing de Heroes Colombia, una app que conecta a todos los miembros de las fuerzas armadas de Colombia (ejercito, policia nacional, armada, y fuerza aeroespacial)
  y sus familias con descuentos exclusivos de negocios locales a nivel nacional.

Tu trabajo es generar contenido de campañas en ESPAÑOL COLOMBIANO natural y auténtico.

Reglas:
- Siempre en español colombiano (tuteo, no voseo)
- Tono cálido y cercano, que reconozca el servicio de los héroes
- Menciona descuentos y promociones específicas cuando estén disponibles
- Incluye emojis relevantes pero sin exagerar
- El contenido debe motivar a abrir la app
- NUNCA inventes porcentajes o nombres de negocios que no estén en el contexto
- Responde SOLO con el JSON solicitado, sin texto adicional ni markdown`,

  platformUpdate: `Eres el equipo de producto de Heroes Colombia. Generas actualizaciones mensuales sobre mejoras de la plataforma en español colombiano natural y motivador.

Las actualizaciones deben:
- Destacar 1-2 mejoras reales pero creíbles
- Usar lenguaje entusiasta pero profesional
- Agradecer a los negocios aliados
- Responde SOLO con el HTML solicitado, sin texto adicional`,
};

// ============================================================================
// Gemini Client
// ============================================================================

function getModel(systemPrompt: string) {
  const vertexAI = new VertexAI({ project: "heroes-cd74a", location: "us-central1" });
  const model = vertexAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
  });

  return {
    generateContent: async (prompt: string) => {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return {
        response: {
          text: () => result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
        },
      };
    },
  };
}

/**
 * Parse JSON response from Gemini, stripping any markdown fences
 */
function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ============================================================================
// Content Generation Functions
// ============================================================================

/**
 * Generate push notification content using Gemini
 */
export async function generatePushContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<PushContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = buildPushPrompt(context, category, tone);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<PushContent>(text);
  } catch (error) {
    console.error("Error generating push content:", error);
    throw error;
  }
}

/**
 * Generate in-app message content using Gemini
 */
export async function generateInAppContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<InAppContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = buildInAppPrompt(context, category, tone);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<InAppContent>(text);
  } catch (error) {
    console.error("Error generating in-app content:", error);
    throw error;
  }
}

/**
 * Generate email campaign content using Gemini
 */
export async function generateEmailContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): Promise<EmailContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = buildEmailPrompt(context, category, tone);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<EmailContent>(text);
  } catch (error) {
    console.error("Error generating email content:", error);
    throw error;
  }
}

/**
 * Generate monthly platform update for business reports
 */
export async function generatePlatformUpdate(): Promise<string> {
  const model = getModel(SYSTEM_PROMPTS.platformUpdate);

  const currentMonth = new Date().toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });

  const prompt = `Genera la actualización mensual de la plataforma para ${currentMonth}.

Retorna solo el contenido HTML, sin explicación. Usa esta estructura:
<div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
  <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">[Emoji] [Título]</h3>
  <p style="color: #333; line-height: 1.6;">[Párrafo 1]</p>
  <p style="color: #333; line-height: 1.6;">[Párrafo 2]</p>
</div>`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
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

  return `Genera una notificación push para Heroes Colombia.

CATEGORÍA DE CONTENIDO: ${category}
TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

DATOS DISPONIBLES:

TOP PROMOCIONES:
${promotionsList || "No hay promociones disponibles"}

NEGOCIOS NUEVOS:
${newBusinessesList || "No hay negocios nuevos"}

FORMATO DE SALIDA (JSON):
{
  "title": "Máx 50 caracteres, llamativo, con emoji",
  "body": "Máx 120 caracteres, llamada a la acción convincente"
}

Genera contenido que coincida con la categoría (${category}). Sé creativo y suena natural sin palabras que suenen forzadas.
Retorna SOLO el JSON, sin explicación.`;
}

function buildInAppPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone
): string {
  const topPromotion = context.topPromotions[0];
  const featuredPromotions = context.topPromotions.slice(0, 5).map((p) => p.id);

  return `Genera un mensaje in-app para Heroes Colombia.

CATEGORÍA DE CONTENIDO: ${category}
TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

PROMOCIÓN DESTACADA (para imagen):
${topPromotion ? `${topPromotion.business_name}: ${topPromotion.title} (${topPromotion.percentage}%)` : "Ninguna"}

FORMATO DE SALIDA (JSON):
{
  "title": "Título llamativo",
  "body": "Descripción convincente (2-3 oraciones)",
  "image_url": "",
  "featured_promotions": ${JSON.stringify(featuredPromotions)},
  "button_text": "Texto del botón de acción",
  "button_action": "heroescolombia://promotions"
}

Genera contenido que coincida con la categoría (${category}). Sé creativo y suena natural sin palabras que suenen forzadas.
Retorna SOLO el JSON, sin explicación.`;
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

  return `Genera una campaña de email para Heroes Colombia.

CATEGORÍA DE CONTENIDO: ${category}
TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

TOP PROMOCIONES:
${promotionsList || "No hay promociones disponibles"}

FORMATO DE SALIDA (JSON):
{
  "subject": "Línea de asunto (convincente, personalizada)",
  "preheader": "Texto de vista previa del email (máx 100 caracteres)",
  "sections": [
    {
      "headline": "Titular de la sección",
      "promotions": ["promo_id_1", "promo_id_2"],
      "cta_text": "Texto de llamada a la acción"
    }
  ],
  "footer_text": "Mensaje de cierre"
}

Genera contenido con 2-3 secciones. Usa IDs de promoción de: ${context.topPromotions.map((p) => p.id).join(", ")}
Sé creativo y suena natural sin palabras que suenen forzadas. Retorna SOLO el JSON, sin explicación.`;
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
