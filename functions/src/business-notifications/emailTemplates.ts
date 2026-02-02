/**
 * Business Notification Email Templates
 *
 * Email templates for all business notification types.
 * All emails are written as if from Jonathan personally.
 *
 * Part of the Automated Engagement System - Part B (Phase 5)
 */

// ============================================================================
// Configuration
// ============================================================================

export const EMAIL_FROM = "Heroes Colombia <noreply@heroescolombia.com>";
export const EMAIL_REPLY_TO = "jonathan@heroescolombia.com";

export const JONATHAN_SIGNATURE_HTML = `
<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
  <p style="margin: 0; font-weight: bold; color: #1a1a1a;">
    Jonathan González
  </p>
  <p style="margin: 4px 0; color: #666; font-size: 14px;">
    Director, Heroes Colombia
  </p>
  <p style="margin: 4px 0; font-size: 14px;">
    <a href="mailto:jonathan@heroescolombia.com" style="color: #0066cc;">
      jonathan@heroescolombia.com
    </a>
  </p>
</div>
`;

// ============================================================================
// Types
// ============================================================================

export type BusinessNotificationType =
  | "promotion_expired"
  | "no_active_promotions"
  | "incomplete_profile"
  | "new_favourite"
  | "cta_clicked"
  | "weekly_report"
  | "monthly_report";

export interface BusinessInfo {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
}

export interface PromotionExpiredData {
  promotion_id: string;
  promotion_title: string;
}

export interface NewFavouriteData {
  user_rank?: string;
}

export interface CtaClickedData {
  cta_type: "phone" | "whatsapp" | "website" | "navigation";
}

export interface IncompleteProfileData {
  missing_fields: string[];
}

export interface ReportStats {
  views: number;
  saves: number;
  clicks: number;
  redemptions: number;
}

export interface WeeklyReportData {
  stats: ReportStats;
  previous_stats?: ReportStats;
  top_promotions: Array<{ title: string; views: number }>;
}

export interface MonthlyReportData {
  stats: ReportStats;
  previous_stats?: ReportStats;
  top_promotions: Array<{ title: string; views: number }>;
  platform_update_html: string;
}

// ============================================================================
// Base Email Template
// ============================================================================

function wrapInEmailTemplate(content: string, preheader: string = ""): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heroes Colombia</title>
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 10px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin: 0; padding: 0; background: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ""}
  <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: #1a1a1a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; color: white; font-size: 22px;">🇨🇴 Heroes Colombia</h1>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
      ${content}
      ${JONATHAN_SIGNATURE_HTML}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        Heroes Colombia - Honrando a quienes sirven 🇨🇴
      </p>
      <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
        <a href="https://heroescolombia.com/business/settings" style="color: #999;">Configurar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================================================
// Email Templates
// ============================================================================

/**
 * Promotion Expired Email
 */
export function getPromotionExpiredEmail(
  business: BusinessInfo,
  data: PromotionExpiredData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];

  const subject = `${firstName}, tu promoción "${data.promotion_title}" expiró`;

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Te escribo porque noté que tu promoción <strong>"${data.promotion_title}"</strong>
      de <strong>${business.name}</strong> ha expirado.
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Sin promociones activas, los héroes no podrán ver tu negocio en la app.
      Te recomiendo renovarla o crear una nueva para seguir conectando con nuestra
      comunidad militar.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard/promotions"
         style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Renovar Promoción
      </a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      Si tienes alguna pregunta sobre cómo crear promociones más efectivas,
      no dudes en responder a este correo. Estoy aquí para ayudarte.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Tu promoción ha expirado - renuévala para seguir visible"),
  };
}

/**
 * No Active Promotions Email
 */
export function getNoActivePromotionsEmail(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];

  const subject = `${firstName}, noté que no tienes promociones activas`;

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Revisando los negocios en Heroes Colombia, vi que <strong>${business.name}</strong>
      actualmente no tiene promociones activas.
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Esto significa que los héroes no pueden encontrar tu negocio cuando buscan
      descuentos. Crear una promoción te tomará solo unos minutos y te ayudará
      a conectar con miles de militares que buscan apoyar negocios como el tuyo.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard/promotions"
         style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Crear Promoción
      </a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¿Necesitas ideas para tu primera promoción? Responde a este correo y te
      comparto algunas sugerencias que han funcionado bien para otros negocios.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Los héroes no pueden ver tu negocio sin promociones"),
  };
}

/**
 * Incomplete Profile Email
 */
export function getIncompleteProfileEmail(
  business: BusinessInfo,
  data: IncompleteProfileData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];

  const missingFieldsSpanish: Record<string, string> = {
    description: "descripción del negocio",
    featured_image: "imagen principal",
    phone_number: "número de teléfono",
    website: "sitio web",
  };

  const missingList = data.missing_fields
    .map((field) => missingFieldsSpanish[field] || field)
    .join(", ");

  const subject = `${firstName}, vi que faltan algunos datos en tu perfil`;

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Estaba revisando el perfil de <strong>${business.name}</strong> y noté que
      falta información importante: <strong>${missingList}</strong>.
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Un perfil completo genera más confianza en los héroes y aumenta las
      probabilidades de que te contacten. Te tomará solo unos minutos completarlo.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard/settings"
         style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Completar Perfil
      </a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      Si necesitas ayuda con tu perfil o tienes alguna pregunta, responde a este
      correo y con gusto te ayudo.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `Falta: ${missingList}`),
  };
}

/**
 * New Favourite Email
 */
export function getNewFavouriteEmail(
  business: BusinessInfo,
  data: NewFavouriteData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const rankText = data.user_rank ? ` (${data.user_rank})` : "";

  const subject = `¡Buenas noticias ${firstName}! Un héroe guardó a ${business.name}`;

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡Excelente noticia! Un héroe${rankText} acaba de guardar a <strong>${business.name}</strong>
      en sus favoritos.
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Esto significa que le gustó lo que vio y quiere poder encontrar tu negocio
      fácilmente en el futuro. Es una señal de que estás haciendo las cosas bien. 💪
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Sigue así - cada favorito es un potencial cliente leal.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ver Mi Dashboard
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "¡Un héroe guardó tu negocio en favoritos!"),
  };
}

/**
 * CTA Clicked Email
 */
export function getCtaClickedEmail(
  business: BusinessInfo,
  data: CtaClickedData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];

  const ctaActions: Record<string, { action: string; tip: string }> = {
    phone: {
      action: "llamar a tu negocio",
      tip: "Asegúrate de tener alguien disponible para contestar durante horario laboral.",
    },
    whatsapp: {
      action: "contactarte por WhatsApp",
      tip: "Responde rápido a los mensajes - los héroes aprecian la atención inmediata.",
    },
    website: {
      action: "visitar tu sitio web",
      tip: "Asegúrate de que tu sitio esté actualizado con tus promociones actuales.",
    },
    navigation: {
      action: "obtener direcciones a tu ubicación",
      tip: "¡Prepárate para recibir a un héroe pronto!",
    },
  };

  const { action, tip } = ctaActions[data.cta_type] || {
    action: "interactuar con tu negocio",
    tip: "",
  };

  const subject = `${firstName}, un héroe acaba de ${action}`;

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡Buenas noticias! Un héroe acaba de dar clic para <strong>${action}</strong>
      desde la app de Heroes Colombia.
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Esto significa que tu presencia en la plataforma está funcionando.
      ${tip}
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ver Estadísticas
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `Un héroe quiere ${action}`),
  };
}

/**
 * Weekly Report Email
 */
export function getWeeklyReportEmail(
  business: BusinessInfo,
  data: WeeklyReportData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const hasActivity = data.stats.views > 0 || data.stats.saves > 0 || data.stats.clicks > 0;

  const subject = `${firstName}, tu resumen semanal de ${business.name}`;

  let statsHtml = "";
  if (hasActivity) {
    statsHtml = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px;">📊 Esta semana</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${data.stats.views > 0 ? `<tr><td style="padding: 8px 0; color: #333;">👁️ Vistas de promociones</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.views}</td></tr>` : ""}
          ${data.stats.saves > 0 ? `<tr><td style="padding: 8px 0; color: #333;">⭐ Guardados en favoritos</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.saves}</td></tr>` : ""}
          ${data.stats.clicks > 0 ? `<tr><td style="padding: 8px 0; color: #333;">📱 Clics en CTAs</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.clicks}</td></tr>` : ""}
          ${data.stats.redemptions > 0 ? `<tr><td style="padding: 8px 0; color: #333;">✅ Promociones redimidas</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #22c55e;">${data.stats.redemptions}</td></tr>` : ""}
        </table>
      </div>
    `;

    if (data.top_promotions.length > 0) {
      statsHtml += `
        <div style="margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">🏆 Promociones más vistas</h4>
          <ul style="margin: 0; padding-left: 20px; color: #333;">
            ${data.top_promotions.map((p) => `<li style="margin: 5px 0;">${p.title} (${p.views} vistas)</li>`).join("")}
          </ul>
        </div>
      `;
    }
  }

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Aquí está tu resumen semanal de <strong>${business.name}</strong> en Heroes Colombia.
    </p>
    ${hasActivity ? statsHtml : `
    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Esta semana no hubo actividad en tu negocio. Te recomiendo revisar tus promociones
      y asegurarte de que estén activas y sean atractivas para los héroes.
    </p>
    `}
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ver Dashboard Completo
      </a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¿Quieres mejorar tus resultados? Responde a este correo y te comparto algunos tips.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, hasActivity ? "Ve cómo te fue esta semana" : "Tu resumen semanal está listo"),
  };
}

/**
 * Monthly Report Email
 */
export function getMonthlyReportEmail(
  business: BusinessInfo,
  data: MonthlyReportData
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const hasActivity = data.stats.views > 0 || data.stats.saves > 0 || data.stats.clicks > 0;

  const monthName = new Date().toLocaleDateString("es-CO", { month: "long" });
  const subject = `${firstName}, tu reporte mensual de ${monthName}`;

  let statsHtml = "";
  if (hasActivity) {
    statsHtml = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px;">📊 Resumen de ${monthName}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${data.stats.views > 0 ? `<tr><td style="padding: 8px 0; color: #333;">👁️ Vistas totales</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.views}</td></tr>` : ""}
          ${data.stats.saves > 0 ? `<tr><td style="padding: 8px 0; color: #333;">⭐ Nuevos favoritos</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.saves}</td></tr>` : ""}
          ${data.stats.clicks > 0 ? `<tr><td style="padding: 8px 0; color: #333;">📱 Interacciones (clics)</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0066cc;">${data.stats.clicks}</td></tr>` : ""}
          ${data.stats.redemptions > 0 ? `<tr><td style="padding: 8px 0; color: #333;">✅ Promociones usadas</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #22c55e;">${data.stats.redemptions}</td></tr>` : ""}
        </table>
      </div>
    `;

    if (data.top_promotions.length > 0) {
      statsHtml += `
        <div style="margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 16px;">🏆 Tus promociones más populares</h4>
          <ul style="margin: 0; padding-left: 20px; color: #333;">
            ${data.top_promotions.map((p) => `<li style="margin: 5px 0;">${p.title} (${p.views} vistas)</li>`).join("")}
          </ul>
        </div>
      `;
    }
  }

  const content = `
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Aquí está tu reporte mensual de <strong>${business.name}</strong> en Heroes Colombia.
    </p>
    ${hasActivity ? statsHtml : `
    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Este mes no registramos actividad en tu negocio. Te invito a revisar tus promociones
      y asegurarte de que estén activas. Recuerda que los héroes buscan descuentos constantemente.
    </p>
    `}

    <!-- Platform Update -->
    ${data.platform_update_html}

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ver Mi Dashboard
      </a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¿Tienes preguntas o sugerencias? Me encantaría escucharte - solo responde a este correo.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `Tu reporte mensual de ${business.name}`),
  };
}
