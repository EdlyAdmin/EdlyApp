import { createServiceClient } from '@/lib/supabase/server'
import type { Subject } from '@/lib/supabase/types'

/**
 * Kör matchningslogik för alla omatchade barn.
 *
 * Barn placeras direkt i grupper (status: 'forming').
 * När en grupp har 2 barn sätts status till 'full' och väntar på admin-godkännande.
 * Admin godkänner hela gruppen → status: 'active' → mail skickas.
 *
 * Prioriteringsordning:
 * 1. Försöker fylla befintlig forming-grupp hos en lämplig lärare
 * 2. Skapar ny forming-grupp om ingen finns
 * 3. Lastbalansering: lärare med lägst belastning väljs
 */

function calcAge(birthdate: string): number {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

export async function runMatching() {
  const supabase = createServiceClient()

  // Hämta alla barn (FCFS-ordning) inklusive family_id för group_members
  const { data: allChildren } = await supabase
    .from('children')
    .select('id, subjects, birthdate, diagnoses')
    .order('created_at', { ascending: true })

  if (!allChildren?.length) return

  // Barn som redan är i en grupp (oavsett status) är matchade
  const { data: groupedMembers } = await supabase
    .from('group_members')
    .select('child_id')

  const matchedIds = new Set((groupedMembers ?? []).map((g: any) => g.child_id))
  const unmatchedChildren = allChildren.filter(c => !matchedIds.has(c.id))
  if (!unmatchedChildren.length) return

  // Godkända lärare
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, subjects_can, subjects_blocked, age_groups, max_groups')
    .eq('status', 'approved')

  if (!teachers?.length) return

  // Räkna belastning per lärare: forming + full + active grupper
  const { data: allGroups } = await supabase
    .from('groups')
    .select('teacher_id')
    .in('status', ['forming', 'full', 'active'])

  const groupCountByTeacher: Record<string, number> = {}
  for (const g of allGroups ?? []) {
    groupCountByTeacher[g.teacher_id] = (groupCountByTeacher[g.teacher_id] ?? 0) + 1
  }

  // Hämta forming-grupper med nuvarande antal barn, ämne och barnens profil
  const { data: formingGroups } = await supabase
    .from('groups')
    .select('id, teacher_id, subject, group_members(child_id, children(birthdate, diagnoses))')
    .eq('status', 'forming')

  // Karta: `${teacher_id}:${subject}:${åldersgrupp}:${primärdiagnos}` → forming-grupp med lediga platser
  // Barn i samma grupp ska ha samma ämne, åldersgrupp och primärdiagnos
  const formingByKey: Record<string, { id: string; memberCount: number }> = {}
  for (const g of formingGroups ?? []) {
    const members = Array.isArray(g.group_members) ? g.group_members : []
    const memberCount = members.length
    if (memberCount < 2 && g.subject) {
      const firstMember = members[0]
      const firstChild = firstMember
        ? (Array.isArray(firstMember.children) ? firstMember.children[0] : firstMember.children)
        : null
      const firstDiagnosis = (firstChild?.diagnoses as string[])?.[0] ?? 'ingen'
      formingByKey[`${g.teacher_id}:${g.subject}:${firstDiagnosis}`] = { id: g.id, memberCount }
    }
  }

  // Håll koll på nya grupper skapade denna körning (för korrekt lastbalansering)
  const newGroupsThisRun: Record<string, number> = {}

  for (const child of unmatchedChildren) {
    const childSubjects = child.subjects as Subject[]

    const childAge = child.birthdate ? calcAge(child.birthdate) : null
    const childAgeGroup = childAge === null ? null
      : childAge <= 9 ? 'F-9'
      : childAge <= 12 ? '10-12'
      : '13-15'

    const eligibleTeachers = teachers.filter(teacher => {
      const canTeach = childSubjects.some(s =>
        (teacher.subjects_can as Subject[]).includes(s) &&
        !(teacher.subjects_blocked as Subject[]).includes(s)
      )
      const ageGroups = teacher.age_groups as string[]
      const canTeachAge = !childAgeGroup || ageGroups.length === 0 || ageGroups.includes(childAgeGroup)
      const currentLoad = (groupCountByTeacher[teacher.id] ?? 0) + (newGroupsThisRun[teacher.id] ?? 0)
      const hasCapacity = currentLoad < teacher.max_groups
      return canTeach && canTeachAge && hasCapacity
    })

    if (!eligibleTeachers.length) continue

    // Barnets ämne (alltid ett ämne), åldersgrupp och primärdiagnos
    const childSubject = childSubjects[0]
    const childDiagnosis = (child.diagnoses as string[])?.[0] ?? 'ingen'
    const groupKey = (teacherId: string) =>
      `${teacherId}:${childSubject}:${childDiagnosis}`

    // Prioritera lärare som redan har en forming-grupp för samma ämne, ålder och diagnos
    const teachersWithSpace = eligibleTeachers.filter(t => formingByKey[groupKey(t.id)])
    const candidates = teachersWithSpace.length > 0 ? teachersWithSpace : eligibleTeachers

    // Välj minst belastad bland kandidaterna
    const match = candidates.reduce((best, teacher) => {
      const bestLoad = (groupCountByTeacher[best.id] ?? 0) + (newGroupsThisRun[best.id] ?? 0)
      const thisLoad = (groupCountByTeacher[teacher.id] ?? 0) + (newGroupsThisRun[teacher.id] ?? 0)
      return thisLoad < bestLoad ? teacher : best
    })

    const matchGroupKey = groupKey(match.id)
    const existingGroup = formingByKey[matchGroupKey]

    if (existingGroup) {
      // Lägg till barn i befintlig forming-grupp (samma ämne, åldersgrupp och diagnos)
      const { error } = await supabase.from('group_members').insert({
        group_id: existingGroup.id,
        child_id: child.id,
      })

      if (!error) {
        existingGroup.memberCount++
        if (existingGroup.memberCount >= 2) {
          // Gruppen är full — väntar på admin-godkännande
          await supabase.from('groups').update({ status: 'full' }).eq('id', existingGroup.id)
          delete formingByKey[matchGroupKey]
        }
      }
    } else {
      // Skapa ny forming-grupp för detta ämne, åldersgrupp och diagnos
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({ teacher_id: match.id, status: 'forming', subject: childSubject })
        .select('id')
        .single()

      if (!groupError && group) {
        const { error: memberError } = await supabase.from('group_members').insert({
          group_id: group.id,
          child_id: child.id,
        })

        if (!memberError) {
          formingByKey[matchGroupKey] = { id: group.id, memberCount: 1 }
          newGroupsThisRun[match.id] = (newGroupsThisRun[match.id] ?? 0) + 1
        }
      }
    }
  }
}
