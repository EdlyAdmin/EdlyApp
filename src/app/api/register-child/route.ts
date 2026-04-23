import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNewChildNotification } from '@/lib/email/mailer'
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
  const { userId, parentName, email, phone, childName, childBirthdate, subjects, diagnoses, diagnosisOther, extraInfo, sessionLength, hasWebcam, turnstileToken } = await req.json()

  if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json({ error: 'CAPTCHA-verifiering misslyckades.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Skapa family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ profile_id: userId, parent_name: parentName, email, phone: phone ?? null })
    .select('id')
    .single()

  if (familyError || !family) {
    return NextResponse.json({ error: `Kunde inte skapa familjekonto: ${familyError?.message}` }, { status: 500 })
  }

  // Skapa child
  const { data: child, error: childError } = await supabase
    .from('children')
    .insert({
      family_id: family.id,
      name: childName,
      birthdate: childBirthdate,
      membership_consented_at: new Date().toISOString(),
      subjects: subjects as Subject[],
      diagnoses: diagnoses as string[],
      diagnosis_other: diagnosisOther || null,
      extra_info: extraInfo || null,
      session_length: sessionLength || null,
      has_webcam: hasWebcam ?? null,
    })
    .select('id')
    .single()

  if (childError || !child) {
    return NextResponse.json({ error: `Kunde inte skapa barnprofil: ${childError?.message}` }, { status: 500 })
  }

  // Logga samtycke
  await supabase.from('consent_log').insert({
    family_id: family.id,
    policy_version: '1.0',
  })

  // Skicka notiser till prenumererande lärare
  const { data: notifyTeachers } = await supabase
    .from('teachers')
    .select('name, email, subjects_can')
    .eq('status', 'approved')
    .eq('notify_new_children', true)

  const matchingTeachers = (notifyTeachers ?? []).filter(t =>
    (subjects as Subject[]).some(s => (t.subjects_can as Subject[]).includes(s))
  )

  if (matchingTeachers.length > 0) {
    await sendNewChildNotification(matchingTeachers)
  }

  return NextResponse.json({ success: true })
}
