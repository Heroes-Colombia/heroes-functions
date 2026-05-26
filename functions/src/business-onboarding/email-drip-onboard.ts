import { JONATHAN_SIGNATURE_HTML } from "../business-notifications/emailTemplates";
import { BusinessInfo } from "./helpers";

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
<body style="margin: 0; padding: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ""}
  <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #5d7a3a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; color: white; font-size: 22px;">🇨🇴 Heroes Colombia</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
      ${content}
      ${JONATHAN_SIGNATURE_HTML}
    </div>
    <div style="text-align: center; padding: 20px;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        Heroes Colombia - Honrando a quienes sirven 🇨🇴
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================================================
// Day 1 — Primeros pasos: complete profile + first promotion
// ============================================================================

export function getOnboardingDay1Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, estos son los primeros pasos para destacar en Heroes Colombia`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡<strong>${business.name}</strong> ya está en vivo! Queremos compartirles los
      primeros pasos para asegurarse de que los héroes los encuentren y los elijan.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>Lo más importante esta semana:</strong>
    </p>
    <div style="background: #f5f7f5; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        ✅ <strong>Perfil completo</strong> — Asegúrense de tener logo, descripción,
        teléfono y dirección actualizados. Los héroes confían más en negocios con
        perfiles completos.
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        🏷️ <strong>Primera promoción</strong> — Creen su primera promoción ahora. No
        importa si es pequeña — una oferta del 10% ya es suficiente para aparecer
        en las búsquedas de los héroes.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Los negocios con perfil completo y al menos una promoción activa reciben
      significativamente más visitas en la app. Si tienen 10 minutos hoy, vale la pena.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Completar mi Perfil
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Perfil completo + primera promoción = más visitas"),
  };
}

// ============================================================================
// Day 3 — Tips para crear promociones efectivas
// ============================================================================

export function getOnboardingDay3Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, así crean los mejores negocios sus promociones en Heroes Colombia`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hemos visto qué tipo de promociones funcionan mejor con los héroes y queremos
      compartirles esos aprendizajes con <strong>${business.name}</strong>.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>Los 3 elementos de una promoción exitosa:</strong>
    </p>
    <div style="background: #f5f7f5; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 14px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>1. Un descuento claro</strong> — Los héroes responden mejor a
        porcentajes concretos ("15% de descuento") que a descripciones vagas
        ("grandes ofertas"). Entre más claro, mejor.
      </p>
      <p style="margin: 0 0 14px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>2. Imagen atractiva</strong> — Las promociones con imagen reciben
        significativamente más clics. Una foto real del producto o del negocio
        genera más confianza que una imagen genérica.
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>3. Instrucciones simples</strong> — Indiquen cómo el héroe puede
        reclamar el descuento: "menciona Heroes Colombia al pagar" o "muestra
        la app al llegar". Simple y directo.
      </p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard/promotions"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Crear o Editar Promoción
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      Si tienen dudas sobre su primera promoción, lo más efectivo es publicarla y ajustar
      sobre la marcha. Una promoción imperfecta siempre es mejor que ninguna.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "3 tips para que tus promociones destaquen en la app"),
  };
}

// ============================================================================
// Day 7 — Cómo leer las estadísticas / primera semana
// ============================================================================

export function getOnboardingDay7Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, ¿cómo va la primera semana de ${business.name} en Heroes?`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Ya llevas una semana en Heroes Colombia. Si ya tienen el perfil completo y al menos
      una promoción activa, deberían estar viendo sus primeras métricas en el portal.
      Si todavía no, este es un buen momento para hacerlo — los números son útiles incluso cuando son bajos.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>Qué puedes ver en tu portal web:</strong>
    </p>
    <div style="background: #f5f7f5; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        👁️ <strong>Vistas de promociones</strong> — Cuántos héroes han visto sus
        ofertas en la última semana.
      </p>
      <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        ⭐ <strong>Guardados en favoritos</strong> — Héroes que guardaron tu negocio
        para volver después. Es una señal muy positiva de interés.
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        📱 <strong>Clics en contacto</strong> — Héroes que intentaron llamarte,
        escribirte por WhatsApp o visitar tu sitio web.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Si las cifras son bajas, lo más probable es que la promoción necesite un ajuste
      — un título más claro, una imagen o un porcentaje más visible. Con gusto revisamos
      su perfil juntos si nos escriben.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard/analytics"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ver mis Estadísticas
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Tu primera semana en Heroes — así vas"),
  };
}

// ============================================================================
// Day 14 — Mid-trial check-in + RUT reminder
// ============================================================================

export function getOnboardingDay14Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, check-in de mitad de camino para ${business.name}`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Ya llevan dos semanas activos — eso ya es algo. Queremos compartirles
      un consejo clave para esta segunda mitad del periodo de prueba.
    </p>
    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 15px; font-weight: bold;">
        💡 Actualiza tus promociones regularmente
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        Los negocios que actualizan o crean nuevas promociones cada 2-3 semanas
        mantienen un flujo constante de visitas. Una promoción nueva genera
        notificaciones a héroes que ya te tienen como favorito.
      </p>
    </div>
    <div style="background: #fff8e6; border-left: 4px solid #d4a017; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 15px; font-weight: bold;">
        📄 Recordatorio: RUT para facturación
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        Para poder generarles la factura de compra, necesitamos el RUT de
        <strong>${business.name}</strong>. Nuestro equipo se pondrá en contacto
        contigo para solicitarlo.
      </p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard/promotions"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Gestionar Promociones
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¡Seguimos trabajando para que Heroes Colombia sea cada vez más útil para
      negocios como <strong>${business.name}</strong>!
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "2 semanas en Heroes — tips para la segunda mitad de tu periodo de prueba"),
  };
}

// ============================================================================
// Day 30 — Milestone + soft plan conversion
// ============================================================================

export function getOnboardingDay30Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, ¡${business.name} lleva un mes en Heroes Colombia!`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡<strong>${business.name}</strong> ya lleva un mes conectando con héroes en nuestra plataforma!
      Queremos celebrar este primer mes y compartirles algo importante sobre lo que viene.
    </p>
    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 15px; font-weight: bold;">
        📅 Su periodo de prueba dura 2 meses
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        Ya han completado la mitad. Esto significa que en aproximadamente 30 días más,
        <strong>${business.name}</strong> necesitará un plan activo para seguir visible
        en la app y conectando con los héroes.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      La buena noticia: ofrecemos un plan anual de <strong>$480,000 COP/año</strong>
      que incluye todas las funcionalidades de la plataforma. No hay planes parciales
      ni opciones confusas — un solo precio, acceso completo, sin sorpresas.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      No hay urgencia todavía — queremos que tengan tiempo de evaluar calmadamente.
      Pero si ya saben que quieren continuar, pueden asegurar su lugar hoy:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://mpago.li/2VW9tCu"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Activar Plan Anual — $480,000 COP/año
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¡Seguimos trabajando para que Heroes Colombia sea cada vez más útil para
      negocios como <strong>${business.name}</strong>!
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Un mes en Heroes Colombia — lo que viene a continuación"),
  };
}

// ============================================================================
// Day 45 — Practical next steps (15 days before trial ends)
// ============================================================================

export function getOnboardingDay45Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, el periodo de prueba de ${business.name} termina en 15 días`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Queremos recordarles que el periodo de prueba de <strong>${business.name}</strong>
      en Heroes Colombia termina en aproximadamente <strong>15 días</strong>.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      <strong>Estos son los pasos para continuar sin interrupciones:</strong>
    </p>
    <div style="background: #f5f7f5; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
      <p style="margin: 0 0 14px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>Paso 1</strong> — Hacer clic en el botón de pago a continuación o en
        el siguiente enlace antes de que termine el periodo de prueba.
      </p>
      <p style="margin: 0 0 14px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>Paso 2</strong> — Completar el pago de <strong>$480,000 COP/año</strong>
        a través de MercadoPago. Acepta todas las tarjetas y transferencias bancarias.
      </p>
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        <strong>Paso 3</strong> — Listo. Su negocio permanece activo y visible para
        los héroes sin ninguna interrupción.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Si realizan el pago antes del vencimiento, la continuidad es inmediata.
      Si el periodo de prueba vence antes de que paguen, la visibilidad se pausa
      hasta que se active el plan.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://mpago.li/2VW9tCu"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Activar Plan Anual — $480,000 COP/año
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¡Estamos aquí para acompañarlos en este proceso y esperamos poder contar
      con <strong>${business.name}</strong> como parte permanente de Heroes Colombia!
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "15 días para el fin del trial — pasos para renovar"),
  };
}
