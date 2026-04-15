import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { sendIntroMail } from '@/lib/email/mailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { proposalId } = await req.json()
  const service = createServiceClient()

  // Hämta förslaget med barn- och lärarinfo
  const { data: proposal, error: propError } = await service
    .from('match_proposals')
    .select(`
      id,
      child_id,
      teacher_id,
      children ( family_id, families ( parent_name, email ) ),
      teachers ( name, email )
    `)
    .eq('id', proposalId)
    .eq('status', 'pending')
    .single()

  if (propError || !proposal) {
    return NextResponse.json({ error: 'Förslag hittades inte.' }, { status: 404 })
  }

  const teacher = (Array.isArray(proposal.teachers) ? proposal.teachers[0] : proposal.teachers) as { name: string; email: string }
  const child = (Array.isArray(proposal.children) ? proposal.children[0] : proposal.children) as { family_id: string; families: { parent_name: string; email: string } }
  const family = child.families

  // Skapa en grupp för läraren
  const { data: group, error: groupError } = await service
    .from('groups')
    .insert({ teacher_id: proposal.teacher_id, status: 'active' })
    .select('id')
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Kunde inte skapa grupp.' }, { status: 500 })
  }

  // Lägg till barnet i gruppen (family_id krävs av RLS-policy)
  const { error: memberError } = await service
    .from('group_members')
    .insert({ group_id: group.id, child_id: proposal.child_id, family_id: child.family_id })

  if (memberError) {
    return NextResponse.json({ error: 'Kunde inte lägga till barn i grupp.' }, { status: 500 })
  }

  // Uppdatera förslaget till approved
  await service
    .from('match_proposals')
    .update({ status: 'approved' })
    .eq('id', proposalId)

  // Skicka intromail till lärare och förälder
  await sendIntroMail(teacher.name, teacher.email, family.parent_name, family.email)

  return NextResponse.json({ success: true })
}
