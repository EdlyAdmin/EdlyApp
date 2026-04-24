import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { teacherId, subject, childIds } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  if (!teacherId) return NextResponse.json({ error: 'Lärare saknas.' }, { status: 400 })
  if (!childIds || childIds.length === 0) return NextResponse.json({ error: 'Välj minst ett barn.' }, { status: 400 })
  if (childIds.length > 2) return NextResponse.json({ error: 'Max 2 barn per grupp.' }, { status: 400 })

  // Kontrollera att barnen inte redan är i en icke-forming-grupp
  for (const childId of childIds) {
    const { data: existing } = await service
      .from('group_members')
      .select('id, groups(status)')
      .eq('child_id', childId)
      .maybeSingle()
    if (existing) {
      const grp = existing as any
      const groupStatus = Array.isArray(grp.groups) ? grp.groups[0]?.status : grp.groups?.status
      if (groupStatus && groupStatus !== 'forming') {
        return NextResponse.json({ error: 'Ett av barnen är redan placerat i en grupp.' }, { status: 400 })
      }
    }
  }

  const status = childIds.length >= 2 ? 'full' : 'forming'

  const { data: group, error: groupError } = await service
    .from('groups')
    .insert({ teacher_id: teacherId, subject: subject || null, status })
    .select('id')
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? 'Kunde inte skapa grupp.' }, { status: 500 })
  }

  for (const childId of childIds) {
    const { error: memberError } = await service
      .from('group_members')
      .insert({ group_id: group.id, child_id: childId })
    if (memberError) {
      return NextResponse.json({ error: `Kunde inte lägga till barn: ${memberError.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, groupId: group.id, status })
}
