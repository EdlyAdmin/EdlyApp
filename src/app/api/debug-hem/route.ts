import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'ingen användare inloggad' })

  const { data: familyData, error: famErr } = await supabase
    .from('families')
    .select('parent_name, id')
    .eq('profile_id', user.id)
    .single()

  const { data: children, error: childErr } = familyData
    ? await supabase.from('children').select('id, name').eq('family_id', familyData.id)
    : { data: null }

  const childIds = (children ?? []).map((c: any) => c.id)

  const { data: groupMembers, error: gmErr } = childIds.length
    ? await supabase.from('group_members').select('child_id, group_id').in('child_id', childIds)
    : { data: [], error: null }

  const groupIds = (groupMembers ?? []).map((gm: any) => gm.group_id)

  const { data: groups, error: groupErr } = groupIds.length
    ? await supabase.from('groups').select('id, teacher_id, status').in('id', groupIds)
    : { data: [], error: null }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    familyData,
    famErr: famErr?.message,
    children,
    childErr: childErr?.message,
    groupMembers,
    gmErr: gmErr?.message,
    groups,
    groupErr: groupErr?.message,
  })
}
