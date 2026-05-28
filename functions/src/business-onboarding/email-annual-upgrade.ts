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

export function getAnnualUpgradeEmail(
  business: BusinessInfo
): { subject: string; html: string } {
  const firstName = business.owner_name.split(" ")[0];
  const subject = `Gracias por la confianza, ${firstName} — ${business.name} ya tiene plan anual`;

  const content = `
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hola ${firstName},
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Queremos tomarnos un momento para agradecerles. Decidir continuar con el
      plan anual no es algo que tomamos a la ligera — significa que vieron valor
      real en lo que estamos construyendo juntos, y eso para nosotros lo es todo.
    </p>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      <strong>${business.name}</strong> ya lleva un tiempo conectando con la comunidad
      de héroes. Con el plan anual activado, ese vínculo no va a interrumpirse —
      sus promociones siguen visibles, su perfil sigue activo, y seguimos trabajando
      para traer más héroes a la plataforma mes a mes.
    </p>
    <div style="background: #f5f7f5; border-left: 4px solid #5d7a3a; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        Negocios como el suyo son los que hacen posible que esta plataforma exista.
        Cada héroe que encuentra una promoción de <strong>${business.name}</strong>
        lo hace porque ustedes decidieron estar aquí.
      </p>
    </div>
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Si en algún momento tienen preguntas, quieren actualizar algo en su perfil,
      o simplemente quieren contarnos cómo les está yendo, estamos disponibles.
      No hay que esperar a que algo salga mal para escribirnos.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://app.heroescolombia.com/business/dashboard"
         style="display: inline-block; padding: 14px 28px; background: #5d7a3a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Ir al Portal Web
      </a>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
      Gracias de nuevo. Nos alegra mucho contar con ${business.name} este año.
    </p>
  `;

  return {
    subject,
    html: wrapInEmailTemplate(
      content,
      `${business.name} activó el plan anual — gracias por la confianza`
    ),
  };
}
