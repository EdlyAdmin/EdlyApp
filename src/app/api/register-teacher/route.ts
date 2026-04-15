import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTeacherNotifyToAdmin } from '@/lib/email/mailer'
import type { Subject } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const { userId, name, email, phone, subjectsCan, subjectsBlocked, maxGroups, motivation } = await req.json()

  const supabase = createServiceClient()

  const { error } = await supabase.from('teachers').insert({
    profile_id: userId,
    name,
    email,
    phone: phone ?? null,
    subjects_can: subjectsCan as Subject[],
    subjects_blocked: subjectsBlocked as Subject[],
    max_groups: maxGroups,
    motivation: motivation ?? null,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: 'Kunde inte spara läraransökan.' }, { status: 500 })
  }

  // Notifiera Johan
  await sendTeacherNotifyToAdmin(name, email, subjectsCan)

  return NextResponse.json({ success: true })
}
