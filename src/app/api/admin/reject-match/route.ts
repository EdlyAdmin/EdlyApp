import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { proposalId } = await req.json()
  const service = createServiceClient()

  // Sätt status till rejected — barnet återgår till kön vid nästa matchningskörning
  const { error } = await service
    .from('match_proposals')
    .update({ status: 'rejected' })
    .eq('id', proposalId)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: 'Kunde inte avvisa förslag.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
