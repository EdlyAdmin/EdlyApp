import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const getResend = () => new Resend(process.env.RESEND_API_KEY)
const FROM = 'Edly <admin@edly.se>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'johan@edly.se'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function logMailError(type: string, recipient: string, error: string) {
  const supabase = createServiceClient()
  await supabase.from('mail_error_log').insert({ type, recipient, error })
}

function emailWrapper(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f5f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#1e6b74;padding:24px 32px;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Edly</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f5f0eb;border-top:1px solid #e5e0db;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                  Edly — Vi matchar barn med rätt lärare
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

function btn(url: string, label: string) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:#1e6b74;border-radius:8px;">
          <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>
  `
}

function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`
}

function h2(text: string) {
  return `<h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1e6b74;">${text}</h2>`
}

function infoBox(rows: { label: string; value: string }[]) {
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;font-weight:600;color:#6b7280;width:100px;">${r.label}</td>
      <td style="padding:8px 16px;font-size:14px;color:#1a202c;">${r.value}</td>
    </tr>
  `).join('')
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f0f9fa;border-radius:8px;border:1px solid #d1e9eb;">
      ${rowsHtml}
    </table>
  `
}

function signoff() {
  return p('Varma hälsningar,<br><strong>Edly-teamet</strong>')
}

export async function sendIntroMail(
  teacherName: string, teacherEmail: string,
  parentName: string, parentEmail: string
) {
  const results = await Promise.allSettled([
    getResend().emails.send({
      from: FROM,
      to: teacherEmail,
      subject: 'Edly — Du har fått ett nytt undervisningsuppdrag!',
      html: emailWrapper(`
        ${h2(`Hej ${teacherName}!`)}
        ${p('Du har blivit matchad med en familj på Edly. Här är förälderns kontaktuppgifter:')}
        ${infoBox([
          { label: 'Namn', value: parentName },
          { label: 'E-post', value: `<a href="mailto:${parentEmail}" style="color:#1e6b74;">${parentEmail}</a>` },
        ])}
        ${p('Ta kontakt och kom överens om en tid för första träffen!')}
        ${signoff()}
      `),
    }),
    getResend().emails.send({
      from: FROM,
      to: parentEmail,
      subject: 'Edly — Din familj har fått en lärare!',
      html: emailWrapper(`
        ${h2(`Hej ${parentName}!`)}
        ${p('Goda nyheter — ditt barn har matchats med en lärare på Edly!')}
        ${infoBox([
          { label: 'Lärare', value: teacherName },
          { label: 'E-post', value: `<a href="mailto:${teacherEmail}" style="color:#1e6b74;">${teacherEmail}</a>` },
        ])}
        ${p('Läraren kommer att höra av sig för att boka in en tid. Välkommen!')}
        ${signoff()}
      `),
    }),
  ])

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const recipient = i === 0 ? teacherEmail : parentEmail
      await logMailError('intro', recipient, String(result.reason))
    }
  }
}

export async function sendTeacherNotifyToAdmin(teacherName: string, teacherEmail: string, subjectsCan: string[]) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Edly — Ny läraransökan: ${teacherName}`,
    html: emailWrapper(`
      ${h2('Ny läraransökan')}
      ${infoBox([
        { label: 'Namn', value: teacherName },
        { label: 'E-post', value: teacherEmail },
        { label: 'Ämnen', value: subjectsCan.join(', ') },
      ])}
      ${btn(`${APP_URL}/admin`, 'Granska i adminpanelen')}
    `),
  })
  if (error) await logMailError('teacher_notify', ADMIN_EMAIL, error.message)
}

export async function sendTeacherWelcome(teacherName: string, teacherEmail: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: teacherEmail,
    subject: 'Edly — Din ansökan har godkänts!',
    html: emailWrapper(`
      ${h2(`Välkommen till Edly, ${teacherName}!`)}
      ${p('Din ansökan har granskats och godkänts. Du kan nu logga in och börja ta undervisningsuppdrag.')}
      ${btn(`${APP_URL}/larare/logga-in`, 'Logga in')}
      ${signoff()}
    `),
  })
  if (error) await logMailError('welcome', teacherEmail, error.message)
}

export async function sendTeacherRejected(teacherName: string, teacherEmail: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: teacherEmail,
    subject: 'Edly — Din ansökan',
    html: emailWrapper(`
      ${h2(`Hej ${teacherName},`)}
      ${p('Tack för att du ansökte om att bli lärare hos Edly. Tyvärr kan vi inte godkänna din ansökan den här gången.')}
      ${p(`Har du frågor är du välkommen att kontakta oss på <a href="mailto:${ADMIN_EMAIL}" style="color:#1e6b74;">${ADMIN_EMAIL}</a>.`)}
      ${signoff()}
    `),
  })
  if (error) await logMailError('rejected', teacherEmail, error.message)
}

export async function sendNewChildNotification(teachers: { email: string; name: string }[]) {
  await Promise.allSettled(
    teachers.map(t =>
      getResend().emails.send({
        from: FROM,
        to: t.email,
        subject: 'Edly — Nytt barn i uppdragsbanken',
        html: emailWrapper(`
          ${h2(`Hej ${t.name}!`)}
          ${p('Ett nytt barn har registrerats på Edly inom ditt ämnesområde.')}
          ${btn(`${APP_URL}/larare/uppdragsbank`, 'Se uppdragsbanken')}
          ${signoff()}
        `),
      }).catch(async (err) => {
        await logMailError('new_child', t.email, String(err))
      })
    )
  )
}
