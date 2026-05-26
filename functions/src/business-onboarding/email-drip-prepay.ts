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
      .cta-table { width: 100% !important; }
      .cta-cell { display: block !important; width: 100% !important; text-align: center !important; padding: 8px 0 !important; }
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

function ctaButtons(): string {
  return `
    <table class="cta-table" style="margin: 30px auto; border-collapse: collapse;">
      <tr>
        <td class="cta-cell" style="padding: 0 8px;">
          <a href="https://app.heroescolombia.com/business/dashboard"
             style="display: inline-block; padding: 14px 24px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
            Ir al Portal Web
          </a>
        </td>
        <td class="cta-cell" style="padding: 0 8px;">
          <a href="https://mpago.li/15ukNZz"
             style="display: inline-block; padding: 14px 24px; background: #7fa64e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
            Pagar ahora
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// Day 1 — Visibility benefit
// ============================================================================

export function getPrePayDripDay1Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, miles de héroes buscan negocios como ${business.name}`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      <strong>${business.name}</strong> está registrado pero aún no aparece en la app.
      Todos los días, militares activos, retirados y sus familias abren Heroes Colombia
      buscando negocios como el tuyo — y de momento no te encuentran.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Esta comunidad tiene una característica especial: cuando encuentran un negocio de confianza,
      no solo vuelven — lo recomiendan. Militares que se trasladan, familias que buscan referidos,
      compañeros de unidad. Es un círculo de confianza que pocas plataformas pueden ofrecer.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Completar el pago del periodo de prueba activa a <strong>${business.name}</strong>
      de inmediato. Pueden hacerlo desde el portal o directamente con el siguiente enlace:
    </p>
    ${ctaButtons()}
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Miles de héroes buscan tu negocio hoy"),
  };
}

// ============================================================================
// Day 2 — Reach benefit
// ============================================================================

export function getPrePayDripDay2Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, presencia nacional para ${business.name} en un solo paso`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Una de las cosas que más valoran los negocios en Heroes Colombia es el alcance.
      No se trata solo de personas cercanas — la app la usan militares activos y retirados
      en todo el territorio nacional.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cuando un héroe viaja, cuando se traslada de unidad, cuando regresa a casa —
      busca negocios de confianza verificados en nuestra plataforma. <strong>${business.name}</strong>
      podría ser ese negocio en su radar.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Todo eso comienza con completar el pago del periodo de prueba. Para que los héroes en movimiento puedan encontrar a <strong>${business.name}</strong>:
    </p>
    ${ctaButtons()}
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Alcance nacional para tu negocio - un paso más"),
  };
}

// ============================================================================
// Day 5 — Trust benefit
// ============================================================================

export function getPrePayDripDay5Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, los héroes confían en negocios verificados como ${business.name}`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Los militares y sus familias son un público muy especial. Son leales, son
      cuidadosos con sus decisiones de compra y, cuando encuentran un negocio de
      confianza, vuelven una y otra vez.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Estar en Heroes Colombia es exactamente esa señal de confianza. Los negocios
      verificados en nuestra plataforma no son cualquier negocio — son negocios que
      decidieron comprometerse con la comunidad de héroes de Colombia.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      <strong>${business.name}</strong> ya hizo lo más difícil: decidir ser parte de esto.
      El último paso es el pago del periodo de prueba:
    </p>
    ${ctaButtons()}
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Confianza y lealtad — lo que los héroes buscan en un negocio"),
  };
}

// ============================================================================
// Day 7 — Final invitation (soft)
// ============================================================================

export function getPrePayDripDay7Email(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `${firstName}, queremos que ${business.name} sea parte de esto`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nos tomamos un momento para escribirles personalmente porque genuinamente
      queremos que <strong>${business.name}</strong> sea parte de Heroes Colombia.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Sabemos que la decisión requiere un momento de pausa. Si tienen alguna duda
      sobre el proceso, el plan, o cómo funciona la plataforma, con gusto
      los acompañamos.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Si tienen alguna duda sobre la plataforma, el plan o cómo funciona el proceso de pago,
      con gusto los acompañamos antes de que den ese paso. Y si ya están listos:
    </p>
    ${ctaButtons()}
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      La comunidad de Heroes Colombia sigue creciendo. Queremos que <strong>${business.name}</strong>
      sea parte de ella.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(content, "Una última invitación de parte del equipo de Heroes Colombia"),
  };
}
