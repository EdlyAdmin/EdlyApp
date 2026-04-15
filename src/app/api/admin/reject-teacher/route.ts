import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { sendTeacherRejected } from '@/lib/email/mailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { teacherId } = await req.json()
  const service = createServiceClient()

  const { data: teacher, error } = await service
    .from('teachers')
    .update({ status: 'rejected' })
    .eq('id', teacherId)
    .select('name, email')
    .single()

  if (error || !teacher) {
    return NextResponse.json({ error: 'Kunde inte uppdatera lärare.' }, { status: 500 })
  }

  await sendTeacherRejected(teacher.name, teacher.email)

  return NextResponse.json({ success: true })
}
