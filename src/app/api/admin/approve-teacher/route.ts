import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { sendTeacherWelcome } from '@/lib/email/mailer'

export async function POST(req: NextRequest) {
  // Verifiera admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { teacherId } = await req.json()
  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const { error: updateError } = await service
    .from('teachers')
    .update({ status: 'approved' })
    .eq('id', teacherId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: teacher } = await service
    .from('teachers')
    .select('name, email')
    .eq('id', teacherId)
    .single()

  try { if (teacher) await sendTeacherWelcome(teacher.name, teacher.email) } catch (e) { console.error('sendTeacherWelcome failed', e) }

  return NextResponse.json({ success: true })
}
