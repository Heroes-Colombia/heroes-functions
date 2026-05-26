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

export function getBusinessPaymentConfirmedEmail(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `¡${business.name} ya está en vivo en Heroes Colombia! 🎉`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡Excelente noticia! El pago de <strong>${business.name}</strong> ha sido confirmado
      y tu negocio ya está activo en Heroes Colombia. 🎉
    </p>
    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        Desde este momento, miles de héroes activos, retirados y sus familias
        pueden encontrar a <strong>${business.name}</strong> en la app, ver sus
        promociones y contactarlos directamente.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      En los próximos días recibirán algunos consejos para sacarle el máximo
      provecho a la plataforma. Por ahora, les recomendamos verificar que el
      perfil esté completo y crear su primera promoción si aún no lo han hecho.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ir al Portal Web
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¡Bienvenidos oficialmente a Heroes Colombia! Estamos muy contentos de
      contar con <strong>${business.name}</strong> en nuestra plataforma.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(
      content,
      `Pago confirmado - ${business.name} ya está visible para los héroes`
    ),
  };
}
