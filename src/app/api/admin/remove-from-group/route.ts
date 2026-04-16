import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { childId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hitta barnets grupptillhörighet
  const { data: membership } = await service
    .from('group_members')
    .select('group_id, groups(status)')
    .eq('child_id', childId)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Barnet är inte i någon grupp.' }, { status: 404 })
  }

  const groupId = membership.group_id
  const groupStatus = (Array.isArray(membership.groups) ? membership.groups[0] : membership.groups)?.status

  // Ta bort barnet ur gruppen
  const { error: deleteError } = await service
    .from('group_members')
    .delete()
    .eq('child_id', childId)

  if (deleteError) {
    return NextResponse.json({ error: 'Kunde inte ta bort barnet.' }, { status: 500 })
  }

  // Aktiva grupper behåller sin status även om ett barn tas bort
  if (groupStatus === 'active') {
    return NextResponse.json({ success: true })
  }

  // För forming/full: uppdatera status baserat på antal kvarvarande barn
  const { data: remaining } = await service
    .from('group_members')
    .select('child_id')
    .eq('group_id', groupId)

  const count = remaining?.length ?? 0

  if (count === 0) {
    await service.from('groups').update({ status: 'rejected' }).eq('id', groupId)
  } else {
    await service.from('groups').update({ status: 'forming' }).eq('id', groupId)
  }

  return NextResponse.json({ success: true })
}
