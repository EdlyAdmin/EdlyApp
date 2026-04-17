import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { groupId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta gruppinfo för historik
  const { data: group } = await service
    .from('groups')
    .select('subject, status, teachers(name), group_members(child_id)')
    .eq('id', groupId)
    .single()

  if (group) {
    const teacher = Array.isArray(group.teachers) ? group.teachers[0] : group.teachers
    const members = Array.isArray(group.group_members) ? group.group_members : []
    const historyRows = members.map((m: any) => ({
      child_id: m.child_id,
      teacher_name: teacher?.name ?? null,
      subject: group.subject ?? null,
      group_status: group.status ?? 'deleted',
    }))
    if (historyRows.length > 0) {
      await service.from('group_history').insert(historyRows)
    }
  }

  // Ta bort alla grupptillhörigheter
  const { error: membersError } = await service
    .from('group_members')
    .delete()
    .eq('group_id', groupId)

  if (membersError) return NextResponse.json({ error: 'Kunde inte ta bort gruppmedlemmar.' }, { status: 500 })

  // Ta bort gruppen
  const { error: groupError } = await service
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (groupError) return NextResponse.json({ error: 'Kunde inte ta bort gruppen.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
