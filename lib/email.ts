import { Resend } from 'resend'

const FROM = 'Gartenapp <onboarding@resend.dev>'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Missing RESEND_API_KEY')
  return new Resend(key)
}

export async function sendResetRequestEmail(
  gardenName: string,
  confirmUrl: string
): Promise<void> {
  const to = process.env.ADMIN_EMAIL
  if (!to) throw new Error('Missing ADMIN_EMAIL')

  const resend = getResend()

  const subject = `Gartenapp: ${gardenName} möchte Passwort zurücksetzen`
  const text = [
    `Hallo Michael,`,
    ``,
    `${gardenName} hat eine Passwort-Zurücksetzung angefragt.`,
    ``,
    `Zum Bestätigen und Zurücksetzen:`,
    confirmUrl,
    ``,
    `Der Link ist 24 Stunden gültig. Nach dem Klick wird das Passwort für`,
    `diesen Garten gelöscht — ${gardenName} kann sich dann mit einem neuen`,
    `Passwort einloggen. Informiere sie kurz, dass der Reset erledigt ist.`,
    ``,
    `— Gartenapp`,
  ].join('\n')

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #2C2C2A; line-height: 1.5;">
      <h2 style="color: #4A7C59; font-size: 20px; margin-bottom: 16px;">
        🌱 Passwort-Zurücksetzung angefragt
      </h2>
      <p><strong>${escapeHtml(gardenName)}</strong> hat eine Zurücksetzung
      ihres Passworts angefragt.</p>
      <p style="margin: 24px 0;">
        <a href="${confirmUrl}"
           style="display: inline-block; background: #4A7C59; color: white;
                  padding: 12px 24px; border-radius: 8px; text-decoration: none;
                  font-weight: 500;">
          Passwort-Reset bestätigen
        </a>
      </p>
      <p style="color: #888780; font-size: 14px;">
        Der Link ist 24 Stunden gültig. Nach dem Klick wird das Passwort für
        diesen Garten gelöscht — ${escapeHtml(gardenName)} kann sich dann
        mit einem neuen Passwort einloggen. Informiere sie kurz, dass der
        Reset erledigt ist.
      </p>
      <p style="color: #888780; font-size: 12px; margin-top: 32px;">
        Gartenapp · garten.philia-aletheia.art
      </p>
    </div>
  `.trim()

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  })
  if (error) {
    throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
