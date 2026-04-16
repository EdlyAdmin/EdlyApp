import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { childId, name, birthdate, subjects, diagnoses, diagnosisOther, extraInfo, parentName, parentEmail } = await req.json()

  // Uppdatera barnet
  const { error: childError } = await service.from('children').update({
    name,
    birthdate,
    subjects,
    diagnoses,
    diagnosis_other: diagnosisOther || null,
    extra_info: extraInfo || null,
  }).eq('id', childId)

  if (childError) return NextResponse.json({ error: childError.message }, { status: 500 })

  // Hämta family_id och uppdatera familjen
  const { data: child } = await service.from('children').select('family_id').eq('id', childId).single()
  if (child?.family_id) {
    await service.from('families').update({
      parent_name: parentName,
      email: parentEmail,
    }).eq('id', child.family_id)
  }

  return NextResponse.json({ success: true })
}
