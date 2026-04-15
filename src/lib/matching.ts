import { createServiceClient } from '@/lib/supabase/server'
import type { Subject } from '@/lib/supabase/types'

/**
 * Kör matchningslogik för alla omatchade barn.
 * FCFS, icke-blockerande: skapar förslag för alla barn som kan matchas
 * oavsett ordning — hoppar över barn utan tillgänglig lärare.
 *
 * Lastbalansering: Vid varje barn väljs läraren med lägst aktuell belastning
 * (aktiva grupper + förslag skapade denna körning) bland de som matchar.
 * Detta förhindrar att en lärare fylls upp innan nästa tillfrågas.
 */
export async function runMatching() {
  const supabase = createServiceClient()

  // Hämta alla barn (FCFS-ordning)
  const { data: allChildren } = await supabase
    .from('children')
    .select('id, subjects')
    .order('created_at', { ascending: true })

  if (!allChildren?.length) return

  // Hämta barn som redan är matchade eller har aktiva förslag
  const { data: groupedMembers } = await supabase
    .from('group_members')
    .select('child_id')

  const { data: activeProposals } = await supabase
    .from('match_proposals')
    .select('child_id')
    .in('status', ['pending', 'approved'])

  const matchedIds = new Set([
    ...(groupedMembers ?? []).map((g: any) => g.child_id),
    ...(activeProposals ?? []).map((p: any) => p.child_id),
  ])

  const unmatchedChildren = allChildren.filter(c => !matchedIds.has(c.id))
  if (!unmatchedChildren.length) return

  // Hämta godkända lärare
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, subjects_can, subjects_blocked, max_groups')
    .eq('status', 'approved')

  if (!teachers?.length) return

  // Räkna aktiva grupper per lärare
  const { data: activeGroups } = await supabase
    .from('groups')
    .select('teacher_id')
    .eq('status', 'active')

  const groupCountByTeacher: Record<string, number> = {}
  for (const g of activeGroups ?? []) {
    groupCountByTeacher[g.teacher_id] = (groupCountByTeacher[g.teacher_id] ?? 0) + 1
  }

  // Räkna även väntande förslag per lärare (approved-förslag har redan en aktiv grupp)
  const { data: pendingProposals } = await supabase
    .from('match_proposals')
    .select('teacher_id')
    .eq('status', 'pending')

  for (const p of pendingProposals ?? []) {
    groupCountByTeacher[p.teacher_id] = (groupCountByTeacher[p.teacher_id] ?? 0) + 1
  }

  // Håll koll på förslag skapade i denna körning (för korrekt belastningsräkning)
  const proposalsCreated: Record<string, number> = {}

  for (const child of unmatchedChildren) {
    const childSubjects = child.subjects as Subject[]

    // Hitta alla lärare som kan matcha detta barn
    const eligibleTeachers = teachers.filter(teacher => {
      const canTeach = childSubjects.some(s =>
        (teacher.subjects_can as Subject[]).includes(s) &&
        !(teacher.subjects_blocked as Subject[]).includes(s)
      )
      const currentLoad = (groupCountByTeacher[teacher.id] ?? 0) + (proposalsCreated[teacher.id] ?? 0)
      const hasCapacity = currentLoad < teacher.max_groups
      return canTeach && hasCapacity
    })

    if (!eligibleTeachers.length) continue

    // Välj läraren med lägst belastning (lastbalansering / round-robin)
    const match = eligibleTeachers.reduce((best, teacher) => {
      const bestLoad = (groupCountByTeacher[best.id] ?? 0) + (proposalsCreated[best.id] ?? 0)
      const thisLoad = (groupCountByTeacher[teacher.id] ?? 0) + (proposalsCreated[teacher.id] ?? 0)
      return thisLoad < bestLoad ? teacher : best
    })

    // Skapa matchningsförslag
    const { error } = await supabase.from('match_proposals').insert({
      child_id: child.id,
      teacher_id: match.id,
      status: 'pending',
    })

    if (!error) {
      proposalsCreated[match.id] = (proposalsCreated[match.id] ?? 0) + 1
    }
  }
}
