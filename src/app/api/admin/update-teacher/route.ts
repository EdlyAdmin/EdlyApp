import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { teacherId, name, email, phone, subjectsCan, subjectsBlocked, ageGroups, maxGroups } = await req.json()

  const { error } = await service.from('teachers').update({
    name,
    email,
    phone: phone || null,
    subjects_can: subjectsCan,
    subjects_blocked: subjectsBlocked,
    age_groups: ageGroups,
    max_groups: maxGroups,
  }).eq('id', teacherId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
