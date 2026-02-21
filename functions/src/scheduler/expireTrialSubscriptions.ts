/**
 * Scheduled function to expire trial subscriptions
 *
 * This function runs daily at midnight (America/Bogota timezone) and:
 * 1. Queries businesses where subscription.status = 'trial' and subscription.end_date < now
 * 2. Updates subscription.status to 'expired'
 * 3. Sends expiration email notification to the business
 * 4. Optionally sends warning emails for trials expiring soon (7 days)
 *
 * Part of Week 5: Business Dashboard & Expiration implementation
 */

import * as admin from "firebase-admin"
import * as functions from "firebase-functions/v1"
import { Timestamp, FieldValue } from "firebase-admin/firestore"

// Email configuration (uses Resend)
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = "Heroes Colombia <noreply@heroescolombia.com>"
const ADMIN_EMAIL = "jonathan@heroescolombia.com"

interface BusinessSubscription {
  type: "trial" | "mercadopago" | "manual"
  status: "pending_payment" | "trial" | "active" | "past_due" | "cancelled" | "expired"
  plan: string
  billing_period: "monthly" | "annual" | null
  start_date: Timestamp | null
  end_date: Timestamp | null
  amount: number
  currency: string
  mercadopago_subscription_id: string | null
  mercadopago_payer_id: number | null
  mercadopago_payer_email: string | null
  is_founder: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

interface Business {
  id: string
  name: string
  email: string
  subscription?: BusinessSubscription
}

/**
 * Helper to send emails via Resend API
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] Resend API key not configured. Email not sent:", { to, subject })
    return false
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      console.error("[Email] Failed to send:", await response.text())
      return false
    }

    console.log("[Email] Sent successfully to:", to)
    return true
  } catch (error) {
    console.error("[Email] Error sending email:", error)
    return false
  }
}

/**
 * Generate trial expired email HTML
 */
function getTrialExpiredEmailHtml(businessName: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e7e5; border-top: none; }
    .warning-box { background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626; }
    .founder-box { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .feature-list { list-style: none; padding: 0; margin: 15px 0; }
    .feature-list li { padding: 8px 0; display: flex; align-items: center; }
    .feature-list li::before { content: "\\2713"; color: #f59e0b; font-weight: bold; margin-right: 10px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .footer { background: #f9fafb; padding: 20px 30px; border: 1px solid #e5e7e5; border-top: none; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu periodo de prueba ha expirado</h1>
      <p>Pero no te preocupes, aun puedes activar tu plan</p>
    </div>
    <div class="content">
      <p>Hola <strong>${businessName}</strong>,</p>

      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #dc2626;">Tu negocio ya no es visible en la app de Heroes Colombia</p>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #7f1d1d;">
          Tus promociones no aparecen en la app y los usuarios no pueden ver tu negocio.
        </p>
      </div>

      <div class="founder-box">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">Conviertete en Fundador</h3>
        <p style="margin: 0 0 15px 0; color: #78350f;">
          Asegura tu precio exclusivo de <strong>$480,000 COP/año</strong>.
        </p>
        <ul class="feature-list">
          <li>Precio especial de socios fundadores</li>
          <li>Acceso a todas las funcionalidades Enterprise</li>
          <li>Soporte prioritario directo</li>
          <li>Tu negocio visible para miles de usuarios</li>
        </ul>
        <p style="font-size: 14px; color: #92400e; margin: 10px 0 0 0;">
          Solo hay 100 lugares disponibles como Fundador!
        </p>
      </div>

      <div style="text-align: center;">
        <a href="https://app.heroescolombia.com/business/dashboard/plans" class="cta-button">
          Activar Plan Fundador
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
        Si tienes alguna pregunta, no dudes en contactarnos respondiendo a este correo o escribiendonos por WhatsApp.
      </p>
    </div>
    <div class="footer">
      <p>2026 Heroes Colombia. Todos los derechos reservados.</p>
      <p>Este correo fue enviado a ${email}</p>
    </div>
  </div>
</body>
</html>
`
}

/**
 * Generate trial expiring warning email HTML (7 days before)
 */
function getTrialExpiringEmailHtml(businessName: string, email: string, daysRemaining: number, endDate: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e7e5; border-top: none; }
    .countdown-box { background: #fffbeb; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b; text-align: center; }
    .countdown-number { font-size: 48px; font-weight: bold; color: #f59e0b; }
    .feature-list { list-style: none; padding: 0; margin: 15px 0; }
    .feature-list li { padding: 8px 0; display: flex; align-items: center; }
    .feature-list li::before { content: "\\2713"; color: #f59e0b; font-weight: bold; margin-right: 10px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .footer { background: #f9fafb; padding: 20px 30px; border: 1px solid #e5e7e5; border-top: none; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu periodo de prueba esta por vencer</h1>
      <p>Asegura tu lugar como Fundador</p>
    </div>
    <div class="content">
      <p>Hola <strong>${businessName}</strong>,</p>

      <div class="countdown-box">
        <div class="countdown-number">${daysRemaining}</div>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #92400e;">
          dias restantes (vence el ${endDate})
        </p>
      </div>

      <p>
        Tu periodo de prueba en Heroes Colombia esta por terminar. Despues del <strong>${endDate}</strong>,
        tu negocio y promociones no seran visibles en la app.
      </p>

      <h3 style="margin: 20px 0 10px 0;">Conviertete en Fundador y obten:</h3>
      <ul class="feature-list">
        <li>Precio especial de Fundador por $480,000 COP/año</li>
        <li>Acceso a todas las funcionalidades Enterprise</li>
        <li>Soporte prioritario directo con el equipo</li>
        <li>Tu negocio visible para miles de usuarios</li>
      </ul>

      <div style="text-align: center;">
        <a href="https://app.heroescolombia.com/business/dashboard/plans" class="cta-button">
          Activar Plan Fundador - $480,000/año
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
        Solo hay 100 lugares disponibles como Fundador. No pierdas esta oportunidad!
      </p>
    </div>
    <div class="footer">
      <p>2026 Heroes Colombia. Todos los derechos reservados.</p>
      <p>Este correo fue enviado a ${email}</p>
    </div>
  </div>
</body>
</html>
`
}

/**
 * Main function to expire overdue trial subscriptions
 */
export async function expireOverdueTrials(): Promise<{ expired: number; errors: number }> {
  const db = admin.firestore()
  const now = Timestamp.now()

  let expiredCount = 0
  let errorCount = 0

  console.log("[expireTrials] Starting trial expiration check...")

  try {
    // Query businesses where subscription.status = 'trial' and subscription.end_date < now
    const expiredTrialsSnapshot = await db
      .collection("businesses")
      .where("subscription.status", "==", "trial")
      .where("subscription.end_date", "<", now)
      .get()

    console.log(`[expireTrials] Found ${expiredTrialsSnapshot.size} expired trials`)

    for (const doc of expiredTrialsSnapshot.docs) {
      const business = { id: doc.id, ...doc.data() } as Business
      try {
        // Update subscription status to expired
        await doc.ref.update({
          "subscription.status": "expired",
          "subscription.updated_at": FieldValue.serverTimestamp(),
        })

        // Send expiration email
        if (business.email) {
          await sendEmail(
            business.email,
            `${business.name}, tu periodo de prueba ha expirado`,
            getTrialExpiredEmailHtml(business.name, business.email)
          )
        }

        console.log(`[expireTrials] Expired trial for business: ${business.id} (${business.name})`)
        expiredCount++
      } catch (error) {
        console.error(`[expireTrials] Error expiring trial for ${business.id}:`, error)
        errorCount++
      }
    }

    // Notify admin of expired trials
    if (expiredCount > 0) {
      await sendEmail(
        ADMIN_EMAIL,
        `[Heroes Colombia] ${expiredCount} trial(s) expirado(s)`,
        `<p>Se han expirado ${expiredCount} periodos de prueba hoy.</p>
         <p>Errores: ${errorCount}</p>
         <p><a href="https://app.heroescolombia.com/admin/dashboard/businesses">Ver en admin</a></p>`
      )
    }
  } catch (error) {
    console.error("[expireTrials] Error in main query:", error)
    throw error
  }

  console.log(`[expireTrials] Completed. Expired: ${expiredCount}, Errors: ${errorCount}`)
  return { expired: expiredCount, errors: errorCount }
}

/**
 * Send warning emails for trials expiring in 7 days
 */
export async function sendExpiringWarnings(): Promise<{ warned: number; errors: number }> {
  const db = admin.firestore()

  // Calculate date range: 7 days from now
  const now = new Date()
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  // Add/subtract 1 day for range
  const startRange = new Date(sevenDaysFromNow)
  startRange.setHours(0, 0, 0, 0)
  const endRange = new Date(sevenDaysFromNow)
  endRange.setHours(23, 59, 59, 999)

  let warnedCount = 0
  let errorCount = 0

  console.log("[expiringWarnings] Checking for trials expiring in 7 days...")

  try {
    // Query businesses where subscription.status = 'trial' and end_date is in 7 days
    const expiringSnapshot = await db
      .collection("businesses")
      .where("subscription.status", "==", "trial")
      .where("subscription.end_date", ">=", Timestamp.fromDate(startRange))
      .where("subscription.end_date", "<=", Timestamp.fromDate(endRange))
      .get()

    console.log(`[expiringWarnings] Found ${expiringSnapshot.size} trials expiring in 7 days`)

    for (const doc of expiringSnapshot.docs) {
      const business = { id: doc.id, ...doc.data() } as Business
      const endDate = business.subscription?.end_date

      if (!endDate) continue

      const endDateObj = endDate.toDate()
      const daysRemaining = Math.ceil((endDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const formattedEndDate = endDateObj.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      try {
        // Send warning email
        if (business.email) {
          await sendEmail(
            business.email,
            `${business.name}, tu prueba vence en ${daysRemaining} dias`,
            getTrialExpiringEmailHtml(business.name, business.email, daysRemaining, formattedEndDate)
          )
        }

        console.log(`[expiringWarnings] Sent warning for business: ${business.id} (${business.name})`)
        warnedCount++
      } catch (error) {
        console.error(`[expiringWarnings] Error sending warning for ${business.id}:`, error)
        errorCount++
      }
    }
  } catch (error) {
    console.error("[expiringWarnings] Error in main query:", error)
    throw error
  }

  console.log(`[expiringWarnings] Completed. Warned: ${warnedCount}, Errors: ${errorCount}`)
  return { warned: warnedCount, errors: errorCount }
}

/**
 * Scheduled function: Run daily at midnight (America/Bogota timezone)
 * Expires overdue trial subscriptions
 */
export const expireTrialSubscriptions = functions.pubsub
  .schedule("0 0 * * *") // Daily at midnight
  .timeZone("America/Bogota")
  .onRun(async () => {
    try {
      const result = await expireOverdueTrials()
      console.log("[expireTrialSubscriptions] Scheduled run completed:", result)
    } catch (error) {
      console.error("[expireTrialSubscriptions] Scheduled run failed:", error)
    }
    return null
  })

/**
 * Scheduled function: Run daily at 9 AM (America/Bogota timezone)
 * Sends warning emails for trials expiring in 7 days
 */
export const sendTrialExpiringWarnings = functions.pubsub
  .schedule("0 9 * * *") // Daily at 9 AM
  .timeZone("America/Bogota")
  .onRun(async () => {
    try {
      const result = await sendExpiringWarnings()
      console.log("[sendTrialExpiringWarnings] Scheduled run completed:", result)
    } catch (error) {
      console.error("[sendTrialExpiringWarnings] Scheduled run failed:", error)
    }
    return null
  })
