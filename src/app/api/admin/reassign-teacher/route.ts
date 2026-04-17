import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { groupId, teacherId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta gruppen
  const { data: group } = await service
    .from('groups')
    .select('id, subject, teacher_id')
    .eq('id', groupId)
    .single()

  if (!group) return NextResponse.json({ error: 'Gruppen hittades inte.' }, { status: 404 })

  // Hämta nya läraren
  const { data: teacher } = await service
    .from('teachers')
    .select('id, subjects_can, subjects_blocked, max_groups, status')
    .eq('id', teacherId)
    .single()

  if (!teacher || teacher.status !== 'approved') {
    return NextResponse.json({ error: 'Läraren är inte godkänd.' }, { status: 400 })
  }

  // Kontrollera att läraren kan undervisa i gruppens ämne
  const subjectsCan = teacher.subjects_can as string[]
  const subjectsBlocked = teacher.subjects_blocked as string[]
  if (group.subject && (!subjectsCan.includes(group.subject) || subjectsBlocked.includes(group.subject))) {
    return NextResponse.json({ error: 'Läraren kan inte undervisa i gruppens ämne.' }, { status: 400 })
  }

  // Kontrollera kapacitet (räkna ej den nuvarande gruppen)
  const { data: teacherGroups } = await service
    .from('groups')
    .select('id')
    .eq('teacher_id', teacherId)
    .in('status', ['forming', 'full', 'active'])
    .neq('id', groupId)

  if ((teacherGroups?.length ?? 0) >= teacher.max_groups) {
    return NextResponse.json({ error: 'Läraren har nått sin maxkapacitet.' }, { status: 400 })
  }

  // Byt lärare
  const { error } = await service
    .from('groups')
    .update({ teacher_id: teacherId })
    .eq('id', groupId)

  if (error) return NextResponse.json({ error: 'Kunde inte byta lärare.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
