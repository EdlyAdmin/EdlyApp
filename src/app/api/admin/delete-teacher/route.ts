import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { teacherId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta läraren och kontrollera att de inte har aktiva grupper
  const { data: teacher } = await service
    .from('teachers')
    .select('id, profile_id, name')
    .eq('id', teacherId)
    .single()

  if (!teacher) return NextResponse.json({ error: 'Läraren hittades inte.' }, { status: 404 })

  // Blockera radering om läraren har pågående grupper
  const { data: activeGroups } = await service
    .from('groups')
    .select('id, status')
    .eq('teacher_id', teacherId)
    .in('status', ['forming', 'full', 'active'])

  if (activeGroups && activeGroups.length > 0) {
    return NextResponse.json({
      error: `Läraren har ${activeGroups.length} aktiv${activeGroups.length > 1 ? 'a' : ''} grupp${activeGroups.length > 1 ? 'er' : ''}. Ta bort eller omfördela grupperna innan läraren raderas.`,
    }, { status: 409 })
  }

  // Radera avvisade/inaktiva grupper kopplade till läraren (ON DELETE RESTRICT blockerar annars)
  await service.from('groups').delete().eq('teacher_id', teacherId).eq('status', 'rejected')

  // Ta bort lärarposten
  const { error: teacherError } = await service
    .from('teachers')
    .delete()
    .eq('id', teacherId)

  if (teacherError) {
    return NextResponse.json({ error: 'Kunde inte ta bort läraren: ' + teacherError.message }, { status: 500 })
  }

  // Radera auth-användaren — profiles-raden kaskaderas automatiskt
  if (teacher.profile_id) {
    await service.auth.admin.deleteUser(teacher.profile_id)
  }

  return NextResponse.json({ success: true })
}
