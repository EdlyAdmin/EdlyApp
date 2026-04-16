import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTeacherNotifyToAdmin } from '@/lib/email/mailer'
import type { Subject } from '@/lib/supabase/types'

async function verifyTurnstile(token: string) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  const { userId, name, email, phone, subjectsCan, subjectsBlocked, ageGroups, maxGroups, motivation, turnstileToken } = await req.json()

  if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json({ error: 'CAPTCHA-verifiering misslyckades.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase.from('teachers').insert({
    profile_id: userId,
    name,
    email,
    phone: phone ?? null,
    subjects_can: subjectsCan as Subject[],
    subjects_blocked: subjectsBlocked as Subject[],
    age_groups: ageGroups as string[],
    max_groups: maxGroups,
    motivation: motivation ?? null,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: 'Kunde inte spara läraransökan.' }, { status: 500 })
  }

  // Notifiera Johan
  await sendTeacherNotifyToAdmin(name, email, subjectsCan)

  return NextResponse.json({ success: true })
}
