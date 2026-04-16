import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { childId, groupId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Kontrollera att gruppen finns
  const { data: group } = await service.from('groups').select('id, status').eq('id', groupId).single()
  if (!group) return NextResponse.json({ error: 'Gruppen hittades inte.' }, { status: 404 })
  if (group.status === 'active' || group.status === 'rejected') {
    return NextResponse.json({ error: 'Gruppen är inte öppen för nya barn.' }, { status: 400 })
  }

  // Kontrollera att barnet inte redan är i en grupp
  const { data: existing } = await service.from('group_members').select('id').eq('child_id', childId).single()
  if (existing) return NextResponse.json({ error: 'Barnet är redan i en grupp.' }, { status: 400 })

  // Kontrollera hur många barn som redan är i gruppen
  const { data: members } = await service.from('group_members').select('child_id').eq('group_id', groupId)
  if ((members?.length ?? 0) >= 2) {
    return NextResponse.json({ error: 'Gruppen är redan full.' }, { status: 400 })
  }

  // Lägg till barnet
  const { error } = await service.from('group_members').insert({ group_id: groupId, child_id: childId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Uppdatera gruppstatus
  const newCount = (members?.length ?? 0) + 1
  const newStatus = newCount >= 2 ? 'full' : 'forming'
  await service.from('groups').update({ status: newStatus }).eq('id', groupId)

  return NextResponse.json({ success: true })
}
