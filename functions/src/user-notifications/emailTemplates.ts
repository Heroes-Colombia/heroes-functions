import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  JONATHAN_SIGNATURE_HTML,
} from "../business-notifications/emailTemplates";

export { EMAIL_FROM, EMAIL_REPLY_TO };

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
    <!-- Header -->
    <div style="background: #5d7a3a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; color: white; font-size: 22px;">🇨🇴 Heroes Colombia</h1>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
      ${content}
      ${JONATHAN_SIGNATURE_HTML}
    </div>

    <!-- Footer -->
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

export function getWelcomeEmailTemplate(
  firstName: string,
  rank: string
): { subject: string; html: string } {
  const subject = `¡Bienvenido a Heroes Colombia, ${firstName}!`;

  const rankParts = rank ? rank.split("_") : [];
  const rankDisplay =
    rankParts.length >= 3
      ? `${rankParts[2]} del ${rankParts[0].charAt(0) + rankParts[0].slice(1).toLowerCase()}`
      : rank || "";

  const rankLine = rankDisplay
    ? `<p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Es un honor tenerte en nuestra plataforma como <strong>${rankDisplay}</strong>.
        En Heroes Colombia, creemos que quienes sirven a la patria merecen lo mejor.
      </p>`
    : `<p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        En Heroes Colombia, creemos que quienes sirven a la patria merecen lo mejor.
      </p>`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      ¡Bienvenido a Heroes Colombia! Nos alegra mucho que hayas decidido unirte a Heroes Colombia.
    </p>
    ${rankLine}
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Desde hoy puedes explorar los negocios y promociones exclusivas que tenemos para ti:
    </p>
    <ul style="color: #1a1a1a; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
      <li>🗺️ Descubre negocios cercanos a ti en el mapa</li>
      <li>🤝 Nuevas alianzas cada mes a nivel nacional</li>
      <li>🏷️ Accede a descuentos y promociones exclusivas</li>
      <li>⭐ Guarda tus negocios favoritos para encontrarlos fácilmente</li>
      <li>📍 Navega directamente a los negocios desde la app</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://heroescolombia.com"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Compártelo con tus familiares y compañeros
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      ¡Estamos aquí para acompañarte y seguiremos trabajando para ofrecerte lo mejor!
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(
      content,
      "Tu cuenta en Heroes Colombia está lista - empieza a explorar"
    ),
  };
}
