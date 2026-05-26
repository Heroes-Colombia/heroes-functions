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

export function getBusinessWelcomeEmail(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `¡Bienvenido a Heroes Colombia, ${firstName}! 🇨🇴`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      <strong>${business.name}</strong> ya está registrado en Heroes Colombia.
      El hecho de que hayan llegado hasta aquí nos dice que comparten algo importante con nosotros:
      el convencimiento de que los militares y sus familias merecen negocios que los reconozcan.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Heroes Colombia conecta a militares activos, retirados y sus familias con negocios
      que ofrecen descuentos y promociones reales. Cuando un héroe abre la app y encuentra
      a <strong>${business.name}</strong>, no solo ve una oferta — ve un negocio que los tuvo en cuenta.
      Eso genera lealtad, y la lealtad genera clientes que vuelven.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Para que los héroes puedan encontrar a <strong>${business.name}</strong> en la app,
      el siguiente paso es completar el pago del periodo de prueba. Puede hacerse directamente
      desde el portal web o con el siguiente enlace:
    </p>
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
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      Una vez completado el pago, recibirán una serie de correos con los primeros pasos
      para sacarle el máximo provecho a la plataforma. Estamos aquí para acompañarlos en el proceso.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(
      content,
      `${business.name} ya está registrado - completa tu pago para que te vean nuestros héroes`
    ),
  };
}
