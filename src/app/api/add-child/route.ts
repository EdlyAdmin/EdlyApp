import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { runMatching } from '@/lib/matching'
import type { Subject } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  // Verifiera inloggad användare
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { childName, childBirthdate, subjects, diagnoses, diagnosisOther, extraInfo } = await req.json()

  const service = createServiceClient()

  // Hämta familjens id
  const { data: family } = await service
    .from('families')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!family) {
    return NextResponse.json({ error: 'Familjekonto hittades inte.' }, { status: 404 })
  }

  // Lägg till barnet
  const { error: childError } = await service
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

  if (childError) {
    return NextResponse.json({ error: 'Kunde inte lägga till barn.' }, { status: 500 })
  }

  // Kör matchning
  await runMatching()

  return NextResponse.json({ success: true })
}
