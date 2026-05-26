import { JONATHAN_SIGNATURE_HTML } from "../business-notifications/emailTemplates";
import { BusinessInfo } from "./helpers";

const PAYMENT_LINK = "https://mpago.li/2VW9tCu";
const DASHBOARD_LINK = "https://app.heroescolombia.com/business/dashboard";

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
// Day 3 — Loss awareness: promotions are invisible, profile is half-present
// ============================================================================

export function getReengagementDay3Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, tu perfil sigue activo — pero tus promociones están pausadas`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hace unos días terminó el periodo de prueba de <strong>${business.name}</strong> y
      queremos contarte exactamente qué pasa con tu negocio en este momento.
    </p>

    <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 24px 0;">
      <div style="display: flex; align-items: center; padding: 14px 20px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <span style="font-size: 18px; margin-right: 10px;">✅</span>
        <div>
          <p style="margin: 0; font-weight: 600; color: #1a1a1a; font-size: 14px;">Tu perfil sigue visible en el mapa</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">Los héroes pueden encontrar a ${business.name}</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; padding: 14px 20px; background: #fff7ed;">
        <span style="font-size: 18px; margin-right: 10px;">⏸️</span>
        <div>
          <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 14px;">Tus promociones están pausadas</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #b45309;">Los descuentos de ${business.name} no aparecen en la app</p>
        </div>
      </div>
    </div>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Las promociones son el motor principal de Heroes Colombia — son lo que hace que los héroes
      elijan un negocio sobre otro. Mientras estén pausadas, otros negocios aliados en tu categoría
      siguen apareciendo con sus descuentos activos.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Reactivar todo lo que ya configuraron es sencillo — y sus promociones vuelven a aparecer
      de inmediato para los héroes que los buscan. El plan anual tiene un costo de
      <strong>$480,000 COP</strong> — aproximadamente $40,000 al mes.
    </p>

    <div style="text-align: center; margin: 32px 0 20px 0;">
      <a href="${PAYMENT_LINK}"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Reactivar ${business.name}
      </a>
      <br>
      <a href="${DASHBOARD_LINK}"
         style="display: inline-block; margin-top: 12px; color: #5d7a3a; font-size: 14px; text-decoration: underline;">
        Ir al Portal Web
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `Tu perfil está activo pero tus promociones están pausadas`),
  };
}

// ============================================================================
// Day 10 — Community & mission: the audience is still there, waiting
// ============================================================================

export function getReengagementDay10Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `Los héroes siguen buscando negocios como ${business.name}`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cada semana, militares activos, retirados, policías y sus familias abren Heroes Colombia
      buscando negocios que los valoren. Negocios que reconocen su servicio con algo concreto:
      un descuento, una atención preferencial, un gesto que diga "los vemos".
    </p>

    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.7;">
        Ellos no buscan el negocio más barato. Buscan el negocio que los tenga en cuenta.
        Y cuando lo encuentran, vuelven, recomiendan y se convierten en clientes leales.
      </p>
    </div>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Durante tu periodo de prueba, <strong>${business.name}</strong> fue parte de esa promesa.
      Esa comunidad no se fue a ningún lado — sigue creciendo, sigue buscando,
      y hay un lugar para ustedes en ella.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Ser aliado de Heroes Colombia no es solo publicidad. Es un reconocimiento activo
      a quienes han servido a nuestra patria. Eso tiene un valor que va más allá de cualquier
      pauta digital.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Para volver a conectar con esa comunidad, el plan anual cuesta <strong>$480,000 COP</strong>
      — menos de $40,000 al mes. Sus promociones vuelven activas de inmediato.
    </p>

    <div style="text-align: center; margin: 32px 0 20px 0;">
      <a href="${PAYMENT_LINK}"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Volver a ser parte de Heroes Colombia
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `La comunidad de héroes sigue buscando negocios como el tuyo`),
  };
}

// ============================================================================
// Day 20 — Founder to founder: honest, personal, addresses ROI directly
// ============================================================================

export function getReengagementDay20Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `Un mensaje personal para ${firstName}`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Soy Jonathan, fundador de Heroes Colombia. Quería escribirte directamente acerca de
      <strong>${business.name}</strong>.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Creé esta plataforma porque creo genuinamente que los militares y sus familias merecen
      negocios que los reconozcan. No como una campaña de marketing, sino como un compromiso real.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Entendemos que $480,000 al año es una decisión. Y entendemos que si el periodo de prueba
      no generó los resultados que esperaban, es difícil dar ese siguiente paso.
    </p>

    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.7;">
        Lo que hemos visto con otros aliados es que los resultados dependen mucho de tres cosas:
        un perfil completo, al menos una promoción activa, y un poco de paciencia para que la
        comunidad los descubra. Negocios que tienen eso en su lugar recuperan la inversión
        del año entero con un solo cliente nuevo.
      </p>
    </div>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Si hay algo que podamos hacer para que <strong>${business.name}</strong> vuelva a Heroes Colombia
      — resolver una duda, revisar su perfil juntos, lo que sea — estamos disponibles.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Y si el momento no es el indicado ahora, la puerta siempre está abierta.
      Guardamos un lugar para ustedes.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Si quieren dar ese paso, el plan anual tiene un costo de <strong>$480,000 COP</strong> al año.
      Si tienen alguna pregunta antes de decidir, con gusto los acompañamos.
    </p>

    <div style="text-align: center; margin: 32px 0 20px 0;">
      <a href="${PAYMENT_LINK}"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Activar plan anual
      </a>
    </div>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, `Un mensaje personal del fundador de Heroes Colombia`),
  };
}
