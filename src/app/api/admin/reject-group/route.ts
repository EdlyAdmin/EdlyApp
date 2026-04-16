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

  // Ta bort alla barn ur gruppen — de hamnar automatiskt i kön igen
  const { error: memberError } = await service
    .from('group_members')
    .delete()
    .eq('group_id', groupId)

  if (memberError) {
    return NextResponse.json({ error: 'Kunde inte ta bort barn från gruppen.' }, { status: 500 })
  }

  // Markera gruppen som avvisad
  await service
    .from('groups')
    .update({ status: 'rejected' })
    .eq('id', groupId)

  return NextResponse.json({ success: true })
}
