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

  // Hämta barnets family_id
  const { data: child } = await service
    .from('children')
    .select('id, family_id')
    .eq('id', childId)
    .single()

  if (!child) return NextResponse.json({ error: 'Barnet hittades inte.' }, { status: 404 })

  // Ta bort grupptillhörighet
  await service.from('group_members').delete().eq('child_id', childId)

  // Ta bort barnet
  const { error: deleteError } = await service.from('children').delete().eq('id', childId)
  if (deleteError) return NextResponse.json({ error: 'Kunde inte ta bort barnet.' }, { status: 500 })

  // Ta bort familjen och auth-användaren om inga fler barn finns kopplade
  if (child.family_id) {
    const { data: siblings } = await service
      .from('children')
      .select('id')
      .eq('family_id', child.family_id)

    if (!siblings || siblings.length === 0) {
      // Hämta user_id innan familjeposten raderas
      const { data: family } = await service
        .from('families')
        .select('user_id')
        .eq('id', child.family_id)
        .single()

      await service.from('families').delete().eq('id', child.family_id)

      // Radera auth-användaren om en sådan finns
      if (family?.user_id) {
        await service.auth.admin.deleteUser(family.user_id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
