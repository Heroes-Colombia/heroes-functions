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
  rotationBusinesses: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  currentDate: string;
  specialOccasion?: string;
  recentCampaigns: {
    anglesUsed: string[];
    businessIdsUsed: string[];
    titlesUsed: string[];
  };
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
export type EmailType = "recap" | "midmonth";

export type CampaignAngle =
  | "new_arrival"         // new business joined < 7 days AND never featured before
  | "promotion_spotlight" // highlight 1-2 specific promotions with real percentages
  | "business_highlight"  // spotlight 1 business, explain what they offer
  | "savings_framing"     // frame it around what users can save
  | "category_week"       // best deals in a specific category
  | "rediscover";         // surface under-promoted promotions with low views

const ALL_ANGLES: CampaignAngle[] = [
  "promotion_spotlight",
  "business_highlight",
  "savings_framing",
  "category_week",
  "rediscover",
];

/**
 * Select the campaign angle that keeps messaging fresh.
 * Fires new_arrival only for genuinely new businesses (joined < 7 days, never featured).
 * Otherwise rotates through remaining angles, avoiding what was used most recently.
 */
export function selectCampaignAngle(context: ContentContext): CampaignAngle {
  const { newBusinesses, recentCampaigns } = context;

  const genuinelyNew = newBusinesses.filter(
    (b) => !recentCampaigns.businessIdsUsed.includes(b.id)
  );
  if (genuinelyNew.length > 0) {
    return "new_arrival";
  }

  const unusedAngles = ALL_ANGLES.filter(
    (a) => !recentCampaigns.anglesUsed.includes(a)
  );
  if (unusedAngles.length > 0) {
    return unusedAngles[0];
  }

  // All angles used recently — pick the one not used in the last 3 campaigns
  const recentSet = new Set(recentCampaigns.anglesUsed.slice(0, 3));
  return ALL_ANGLES.find((a) => !recentSet.has(a)) ?? ALL_ANGLES[0];
}

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPTS = {
  consumerCampaign: `Eres Jonathan, el fundador de Heroes Colombia — una app que conecta a militares activos, retirados, policías y sus familias con descuentos exclusivos de negocios en todo Colombia.

Escribes emails que se sienten como mensajes personales, no campañas de marketing masivas. Las personas que te leen sirven o han servido a Colombia. Son directas, ocupadas, y distinguen inmediatamente un email genuino de uno genérico.

QUIÉNES SON:
- Militares activos y retirados, policías, aeronáutica, armada y sus familias
- Valoran el reconocimiento concreto, no el halago vacío
- Responden a mensajes que les dicen exactamente qué hay para ellos y por qué les conviene
- No tienen tiempo para leer marketing — un email tiene que ganarse su atención en las primeras dos líneas

REGLAS DE TONO:
- Escribe como si le mandaras un mensaje a alguien que respetas y aprecias genuinamente
- Usa tuteo natural ("te", "tu") — ni muy informal ni muy formal
- Sé concreto: menciona negocios y promociones reales por nombre
- PROHIBIDO: "¡No te lo pierdas!", "tiempo limitado", "oferta exclusiva", "aprovecha ahora", "¡increíble!", cualquier frase de publicidad genérica
- Emojis con moderación (máx 2-3 por email) — solo si suman al mensaje, nunca para decorar
- El asunto del email debe sonar como el de un mensaje personal, no un anuncio publicitario
- NUNCA inventes datos, porcentajes o nombres que no estén en el contexto dado

FORMATO: Responde SOLO con el JSON solicitado, sin texto adicional ni markdown.`,

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
  tone: Tone,
  angle: CampaignAngle
): Promise<PushContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = buildPushPrompt(context, category, tone, angle);

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
  tone: Tone,
  angle: CampaignAngle
): Promise<InAppContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = buildInAppPrompt(context, category, tone, angle);

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
 * Guarantee the shape downstream send code depends on, since Gemini's JSON
 * output isn't schema-enforced and has been observed to drop/rename fields
 * (e.g. a section missing `promotions` entirely), which crashes the send
 * pipeline with an "undefined Firestore value" error.
 */
function normalizeEmailContent(content: EmailContent): EmailContent {
  return {
    subject: content.subject ?? "",
    preheader: content.preheader ?? "",
    sections: (content.sections ?? []).map((section) => ({
      headline: section.headline ?? "",
      promotions: Array.isArray(section.promotions) ? section.promotions : [],
      cta_text: section.cta_text ?? "",
    })),
    footer_text: content.footer_text ?? "",
  };
}

/**
 * Generate email campaign content using Gemini
 */
export async function generateEmailContent(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone,
  emailType: EmailType = "midmonth"
): Promise<EmailContent> {
  const model = getModel(SYSTEM_PROMPTS.consumerCampaign);
  const prompt = emailType === "recap"
    ? buildEmailRecapPrompt(context, tone)
    : buildEmailMidMonthPrompt(context, tone);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return normalizeEmailContent(parseJsonResponse<EmailContent>(text));
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

function buildAngleInstructions(
  angle: CampaignAngle,
  context: ContentContext
): string {
  const newList = context.newBusinesses
    .slice(0, 3)
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  const rotationList = context.rotationBusinesses
    .slice(0, 3)
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  const promotionsList = context.topPromotions
    .slice(0, 5)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% descuento)`)
    .join("\n");

  const underList = context.underPromoted
    .slice(0, 3)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% descuento)`)
    .join("\n");

  const topCategoryCount: Record<string, number> = {};
  for (const p of context.topPromotions) {
    topCategoryCount[p.category] = (topCategoryCount[p.category] || 0) + 1;
  }
  const topCategory = Object.entries(topCategoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
  const categoryPromos = context.topPromotions
    .filter((p) => p.category === topCategory)
    .slice(0, 3)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% descuento)`)
    .join("\n");

  switch (angle) {
    case "new_arrival":
      return `ÁNGULO: Nuevo aliado en Heroes Colombia
Un negocio acaba de unirse y es su primera aparición para los usuarios.
NEGOCIOS NUEVOS:
${newList || "Sin negocios nuevos"}
El mensaje debe dar la bienvenida a este aliado e invitar a los usuarios a conocerlo.`;

    case "promotion_spotlight":
      return `ÁNGULO: Promoción destacada
Enfócate en 1-2 promociones específicas. Sé concreto: menciona el negocio y el porcentaje real.
PROMOCIONES DISPONIBLES:
${promotionsList || "Sin promociones disponibles"}
NEGOCIOS DE ESTA SEMANA:
${rotationList || "Sin negocios en rotación"}`;

    case "business_highlight":
      return `ÁNGULO: Negocio del momento
Elige 1 negocio de la lista y preséntalo. ¿Qué ofrecen? ¿Por qué vale la pena visitarlos esta semana?
NEGOCIOS DE ESTA SEMANA:
${rotationList || "Sin negocios en rotación"}
PROMOCIONES ACTIVAS (contexto):
${promotionsList || "Sin promociones disponibles"}`;

    case "savings_framing":
      return `ÁNGULO: Ahorro real
Enmarca el mensaje alrededor del valor concreto que Heroes Colombia da a los beneficiarios.
Usa descuentos reales para ilustrar cuánto pueden ahorrar.
PROMOCIONES CON DESCUENTOS:
${promotionsList || "Sin promociones disponibles"}
NEGOCIOS DE ESTA SEMANA:
${rotationList || "Sin negocios en rotación"}`;

    case "category_week":
      return `ÁNGULO: Lo mejor en ${topCategory}
Agrupa las mejores opciones de la categoría "${topCategory}" disponibles ahora.
PROMOCIONES EN ESTA CATEGORÍA:
${categoryPromos || promotionsList || "Sin promociones disponibles"}
NEGOCIOS ACTIVOS:
${rotationList || "Sin negocios en rotación"}`;

    case "rediscover":
      return `ÁNGULO: Por si te lo perdiste
Hay promociones activas que merecen más atención — recuérdale al usuario que existen.
PROMOCIONES CON POCAS VISUALIZACIONES:
${underList || promotionsList || "Sin promociones disponibles"}
NEGOCIOS DE ESTA SEMANA:
${rotationList || "Sin negocios en rotación"}`;
  }
}

function buildPushPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone,
  angle: CampaignAngle
): string {
  const angleInstructions = buildAngleInstructions(angle, context);

  const recentBusinessNames = context.recentCampaigns.businessIdsUsed
    .slice(0, 5)
    .join(", ");

  const recentTitles = context.recentCampaigns.titlesUsed
    .slice(0, 3)
    .map((t) => `- "${t}"`)
    .join("\n");

  return `Genera una notificación push para Heroes Colombia.

CATEGORÍA DE CONTENIDO: ${category}
TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

${angleInstructions}

${recentBusinessNames ? `NEGOCIOS USADOS RECIENTEMENTE (no los repitas como protagonistas): ${recentBusinessNames}` : ""}
${recentTitles ? `TÍTULOS RECIENTES (usa un enfoque diferente, no repitas el mismo ángulo):\n${recentTitles}` : ""}

FORMATO DE SALIDA (JSON):
{
  "title": "Máx 50 caracteres, llamativo, con emoji",
  "body": "Máx 120 caracteres, llamada a la acción convincente"
}

Sé creativo y suena natural. Retorna SOLO el JSON, sin explicación.`;
}

function buildInAppPrompt(
  context: ContentContext,
  category: ContentCategory,
  tone: Tone,
  angle: CampaignAngle
): string {
  const topPromotion = context.topPromotions[0];
  const featuredPromotions = context.topPromotions.slice(0, 5).map((p) => p.id);

  const buttonAction = topPromotion
    ? `heroescolombia://promotion?id=${topPromotion.id}`
    : "heroescolombia://promotions";

  const buttonTextHint = topPromotion
    ? `Texto corto que invite a ver la promoción de ${topPromotion.business_name} (ej: 'Ver oferta', 'Aprovechar descuento')`
    : "Texto corto que invite a explorar (ej: 'Explorar descuentos', 'Ver ofertas')";

  const angleInstructions = buildAngleInstructions(angle, context);

  const recentBusinessNames = context.recentCampaigns.businessIdsUsed
    .slice(0, 5)
    .join(", ");

  const recentTitles = context.recentCampaigns.titlesUsed
    .slice(0, 3)
    .map((t) => `- "${t}"`)
    .join("\n");

  return `Genera un mensaje in-app para Heroes Colombia.

⛔ RESTRICCIÓN ABSOLUTA — LEE ESTO PRIMERO:
El usuario YA tiene la app abierta. Está leyendo este mensaje DENTRO de la app.
NUNCA escribas: "descarga", "instala", "abre la app", "descúbrela en la app", "disponible en la app", ni ninguna variación.
Si el mensaje contiene cualquiera de esas palabras, la respuesta es inválida.
El CTA debe invitar a explorar o aprovechar algo que el usuario ya tiene frente a él.

CATEGORÍA: ${category}
TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

${angleInstructions}

${recentBusinessNames ? `NEGOCIOS USADOS RECIENTEMENTE (no los repitas como protagonistas): ${recentBusinessNames}` : ""}
${recentTitles ? `TÍTULOS RECIENTES (usa un enfoque diferente):\n${recentTitles}` : ""}

FORMATO DE SALIDA (JSON):
{
  "title": "Máx 50 caracteres, directo, con emoji",
  "body": "Máx 120 caracteres, menciona negocios reales por nombre, sin jerga de marketing",
  "image_url": "",
  "featured_promotions": ${JSON.stringify(featuredPromotions)},
  "button_text": "${buttonTextHint}",
  "button_action": "${buttonAction}"
}

Retorna SOLO el JSON, sin explicación.`;
}

/**
 * 1st of month: recap of the previous month — new businesses, top promotions, community growth.
 * Tone: warm, celebratory, personal — like a founder sharing what he's proud of.
 */
function buildEmailRecapPrompt(context: ContentContext, tone: Tone): string {
  const newBusinessesList = context.newBusinesses
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  const topPromotionsList = context.topPromotions
    .slice(0, 8)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% de descuento)`)
    .join("\n");

  const promotionIds = context.topPromotions.slice(0, 6).map((p) => p.id);

  return `Genera un email de resumen mensual para Heroes Colombia. Se envía el 1ro de cada mes.

PROPÓSITO: Contarle al héroe qué pasó el mes anterior — qué negocios nuevos se unieron, qué promociones fueron las más populares — y celebrar que la comunidad sigue creciendo para ellos.

TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

NEGOCIOS QUE SE UNIERON ESTE MES:
${newBusinessesList || "Sin nuevos negocios este mes"}

PROMOCIONES MÁS POPULARES DEL MES:
${topPromotionsList || "No hay datos de promociones"}

ESTRUCTURA DEL EMAIL (2-3 secciones):
1. Apertura personal: menciona el mes que pasó con calidez, como quien comparte algo de lo que está orgulloso
2. Novedades: los negocios nuevos que se unieron (menciona nombre y categoría, invita a conocerlos)
3. Destacados del mes: las promociones más vistas — concreto, con nombre de negocio y descuento
El cierre debe mirar hacia adelante con optimismo, sin frases de marketing

FORMATO DE SALIDA (JSON):
{
  "subject": "Asunto personal, como si fuera un mensaje tuyo directo (no un titular publicitario)",
  "preheader": "Texto de vista previa, máx 90 caracteres, que complemente el asunto",
  "sections": [
    {
      "headline": "Titular de sección (concreto y cálido, no genérico)",
      "promotions": ${JSON.stringify(promotionIds.slice(0, 3))},
      "cta_text": "Texto de CTA que invite a explorar (sin urgencia artificial)"
    }
  ],
  "footer_text": "Frase de cierre personal — agradece que sean parte de Heroes Colombia"
}

Usa IDs de promoción disponibles: ${promotionIds.join(", ")}
Retorna SOLO el JSON. Sin explicación, sin markdown.`;
}

/**
 * 15th of month: mid-month curation — best active promotions and featured businesses right now.
 * Tone: helpful, direct — like a knowledgeable friend saying "I picked the best for you."
 */
function buildEmailMidMonthPrompt(context: ContentContext, tone: Tone): string {
  const topPromotionsList = context.topPromotions
    .slice(0, 8)
    .map((p) => `- ${p.business_name}: ${p.title} (${p.percentage}% de descuento) [ID: ${p.id}]`)
    .join("\n");

  const featuredBusinessesList = [
    ...context.rotationBusinesses.slice(0, 2),
    ...context.enterpriseBusinesses.slice(0, 2),
  ]
    .slice(0, 3)
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  const newBusinessesList = context.newBusinesses
    .slice(0, 3)
    .map((b) => `- ${b.name} (${b.category})`)
    .join("\n");

  const promotionIds = context.topPromotions.slice(0, 6).map((p) => p.id);

  return `Genera un email de mitad de mes para Heroes Colombia. Se envía el 15 de cada mes.

PROPÓSITO: Contarle al héroe qué hay disponible AHORA en la app — las mejores promociones activas y los negocios que vale la pena conocer esta quincena. Como una recomendación curada de alguien que ya revisó todo y te dice qué vale la pena.

TONO: ${tone}
FECHA: ${context.currentDate}
${context.specialOccasion ? `OCASIÓN ESPECIAL: ${context.specialOccasion}` : ""}

MEJORES PROMOCIONES ACTIVAS AHORA:
${topPromotionsList || "No hay promociones disponibles"}

NEGOCIOS DESTACADOS ESTA QUINCENA:
${featuredBusinessesList || "No hay negocios destacados"}

${newBusinessesList ? `NEGOCIOS NUEVOS (llegaron recientemente):
${newBusinessesList}` : ""}

ESTRUCTURA DEL EMAIL (2-3 secciones):
1. Apertura directa y útil: ve al grano — "esto es lo mejor que hay para ti ahora"
2. Promociones recomendadas: 2-3 promociones específicas con negocio y descuento real
3. Negocios a conocer: 1-2 negocios que vale la pena visitar esta quincena
El cierre debe ser un CTA claro para abrir la app — sin urgencia forzada

FORMATO DE SALIDA (JSON):
{
  "subject": "Asunto directo y personal, que haga querer abrir el email de inmediato",
  "preheader": "Complemento al asunto, máx 90 caracteres",
  "sections": [
    {
      "headline": "Titular de sección (específico, no genérico)",
      "promotions": ${JSON.stringify(promotionIds.slice(0, 3))},
      "cta_text": "Texto de CTA concreto (ej: 'Ver descuentos en la app')"
    }
  ],
  "footer_text": "Frase de cierre breve y humana"
}

Usa IDs de promoción disponibles: ${promotionIds.join(", ")}
Retorna SOLO el JSON. Sin explicación, sin markdown.`;
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
