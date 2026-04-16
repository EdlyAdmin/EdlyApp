import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendGroupApprovedMail } from '@/lib/email/mailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { groupId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta gruppen med lärare och alla barn + familjer
  const { data: group, error: groupError } = await service
    .from('groups')
    .select(`
      id, teacher_id,
      teachers(name, email),
      group_members(
        child_id,
        children(name, families(parent_name, email))
      )
    `)
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: `Gruppen hittades inte (id: ${groupId}).` }, { status: 404 })
  }

  // Aktivera gruppen
  const { error: updateError } = await service
    .from('groups')
    .update({ status: 'active' })
    .eq('id', groupId)

  if (updateError) {
    return NextResponse.json({ error: 'Kunde inte aktivera gruppen.' }, { status: 500 })
  }

  // Bygg lista med föräldrar
  const teacher = (Array.isArray(group.teachers) ? group.teachers[0] : group.teachers) as { name: string; email: string }
  const members = Array.isArray(group.group_members) ? group.group_members : []

  const parents: { name: string; email: string }[] = members.map((m: any) => {
    const child = Array.isArray(m.children) ? m.children[0] : m.children
    const family = child ? (Array.isArray(child.families) ? child.families[0] : child.families) : null
    return { name: family?.parent_name ?? '', email: family?.email ?? '' }
  }).filter((p: any) => p.email)

  // Skicka mail till lärare och alla föräldrar
  try {
    await sendGroupApprovedMail(teacher.name, teacher.email, parents)
  } catch (e) {
    console.error('sendGroupApprovedMail failed', e)
  }

  return NextResponse.json({ success: true })
}
