import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runMatching } from '@/lib/matching'
import { sendNewChildNotification } from '@/lib/email/mailer'
import type { Subject } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const { userId, parentName, email, childName, childBirthdate, subjects, diagnoses, diagnosisOther, extraInfo } = await req.json()

  const supabase = createServiceClient()

  // Skapa family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ profile_id: userId, parent_name: parentName, email })
    .select('id')
    .single()

  if (familyError || !family) {
    return NextResponse.json({ error: 'Kunde inte skapa familjekonto.' }, { status: 500 })
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
    })
    .select('id')
    .single()

  if (childError || !child) {
    return NextResponse.json({ error: 'Kunde inte skapa barnprofil.' }, { status: 500 })
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

  // Kör matchning
  await runMatching()

  return NextResponse.json({ success: true })
}
