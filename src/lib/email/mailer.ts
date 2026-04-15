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

export async function sendIntroMail(
  teacherName: string, teacherEmail: string,
  parentName: string, parentEmail: string
) {
  const results = await Promise.allSettled([
    getResend().emails.send({
      from: FROM,
      to: teacherEmail,
      subject: 'Edly — Du har fått ett nytt undervisningsuppdrag!',
      html: `
        <h2>Hej ${teacherName}!</h2>
        <p>Du har blivit matchad med en familj på Edly. Här är förälderns kontaktuppgifter:</p>
        <p><strong>Namn:</strong> ${parentName}<br>
        <strong>E-post:</strong> <a href="mailto:${parentEmail}">${parentEmail}</a></p>
        <p>Ta kontakt och kom överens om en tid för första träffen!</p>
        <p>Varma hälsningar,<br>Edly-teamet</p>
      `,
    }),
    getResend().emails.send({
      from: FROM,
      to: parentEmail,
      subject: 'Edly — Din familj har fått en lärare!',
      html: `
        <h2>Hej ${parentName}!</h2>
        <p>Goda nyheter — ditt barn har matchats med en lärare på Edly! Här är kontaktuppgifterna:</p>
        <p><strong>Lärare:</strong> ${teacherName}<br>
        <strong>E-post:</strong> <a href="mailto:${teacherEmail}">${teacherEmail}</a></p>
        <p>Läraren kommer att höra av sig för att boka in en tid. Välkommen!</p>
        <p>Varma hälsningar,<br>Edly-teamet</p>
      `,
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
    html: `
      <h2>Ny läraransökan</h2>
      <p><strong>Namn:</strong> ${teacherName}<br>
      <strong>E-post:</strong> ${teacherEmail}<br>
      <strong>Ämnen:</strong> ${subjectsCan.join(', ')}</p>
      <p><a href="${APP_URL}/admin" style="background:#1e6b74;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
        Granska i adminpanelen
      </a></p>
    `,
  })
  if (error) await logMailError('teacher_notify', ADMIN_EMAIL, error.message)
}

export async function sendTeacherWelcome(teacherName: string, teacherEmail: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: teacherEmail,
    subject: 'Edly — Din ansökan har godkänts!',
    html: `
      <h2>Välkommen till Edly, ${teacherName}!</h2>
      <p>Din ansökan har granskats och godkänts. Du kan nu logga in och börja ta undervisningsuppdrag.</p>
      <p><a href="${APP_URL}/larare/logga-in" style="background:#1e6b74;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
        Logga in
      </a></p>
      <p>Varma hälsningar,<br>Edly-teamet</p>
    `,
  })
  if (error) await logMailError('welcome', teacherEmail, error.message)
}

export async function sendTeacherRejected(teacherName: string, teacherEmail: string) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to: teacherEmail,
    subject: 'Edly — Din ansökan',
    html: `
      <h2>Hej ${teacherName},</h2>
      <p>Tack för att du ansökte om att bli lärare hos Edly. Tyvärr kan vi inte godkänna din ansökan den här gången.</p>
      <p>Har du frågor är du välkommen att kontakta oss på <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
      <p>Varma hälsningar,<br>Edly-teamet</p>
    `,
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
        html: `
          <h2>Hej ${t.name}!</h2>
          <p>Ett nytt barn har registrerats på Edly inom ditt ämnesområde.</p>
          <p><a href="${APP_URL}/larare/uppdragsbank" style="background:#1e6b74;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
            Se uppdragsbanken
          </a></p>
          <p>Varma hälsningar,<br>Edly-teamet</p>
        `,
      }).catch(async (err) => {
        await logMailError('new_child', t.email, String(err))
      })
    )
  )
}
