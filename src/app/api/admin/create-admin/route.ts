import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verifiera att anroparen är admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'E-post och lösenord krävs.' }, { status: 400 })

  const service = createServiceClient()

  // Skapa auth-användaren
  const { data: newUser, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Kunde inte skapa användaren.' }, { status: 500 })
  }

  // Sätt admin-roll (triggern skapar profilen med role från metadata,
  // men vi skapar utan metadata här så vi uppdaterar direkt)
  const { error: profileError } = await service
    .from('profiles')
    .upsert({ id: newUser.user.id, role: 'admin' })

  if (profileError) {
    return NextResponse.json({ error: 'Användaren skapades men rollen kunde inte sättas.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: newUser.user.email })
}
