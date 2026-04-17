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

  // Ta bort alla grupptillhörigheter — barnen hamnar automatiskt i kön
  const { error: membersError } = await service
    .from('group_members')
    .delete()
    .eq('group_id', groupId)

  if (membersError) return NextResponse.json({ error: 'Kunde inte ta bort gruppmedlemmar.' }, { status: 500 })

  // Ta bort gruppen helt
  const { error: groupError } = await service
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (groupError) return NextResponse.json({ error: 'Kunde inte ta bort gruppen.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
