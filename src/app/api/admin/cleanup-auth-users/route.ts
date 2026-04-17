import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta alla user_id som finns i families
  const { data: families } = await service.from('families').select('user_id')
  const activeUserIds = new Set((families ?? []).map((f: any) => f.user_id).filter(Boolean))

  // Hämta alla auth-användare (paginerat, max 1000)
  const { data: { users: authUsers }, error } = await service.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtrera bort: admins och användare som har en aktiv familj
  const toDelete = authUsers.filter(u => {
    if (activeUserIds.has(u.id)) return false // har en aktiv familj
    // Kolla om de har admin-roll via profiles
    return true // resten är orphans
  })

  // Dubbelkolla mot profiles — skippa admins
  const orphanIds = toDelete.map(u => u.id)
  const { data: adminProfiles } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .in('id', orphanIds)

  const adminSet = new Set((adminProfiles ?? []).map((p: any) => p.id))

  const safeToDelete = toDelete.filter(u => !adminSet.has(u.id))

  // Radera
  const deleted: string[] = []
  const failed: string[] = []

  for (const u of safeToDelete) {
    const { error: delErr } = await service.auth.admin.deleteUser(u.id)
    if (delErr) {
      failed.push(u.email ?? u.id)
    } else {
      deleted.push(u.email ?? u.id)
    }
  }

  return NextResponse.json({ deleted, failed, total: safeToDelete.length })
}
