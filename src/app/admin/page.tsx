'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DetailPanel } from '@/components/ui/DetailPanel'
import type { Subject } from '@/lib/supabase/types'

interface PendingTeacher {
  id: string
  name: string
  email: string
  phone: string | null
  subjects_can: Subject[]
  subjects_blocked: Subject[]
  age_groups: string[]
  max_groups: number
  motivation: string | null
  created_at: string
}

interface ApprovedTeacher {
  id: string
  name: string
  email: string
  phone: string | null
  subjects_can: Subject[]
  subjects_blocked: Subject[]
  age_groups: string[]
  max_groups: number
  motivation: string | null
  active_groups: number
}

interface QueuedChild {
  id: string
  birthdate: string
  subjects: Subject[]
  diagnoses: string[]
  diagnosis_other: string | null
  extra_info: string | null
  created_at: string
  family_name: string
  family_email: string
  child_name: string
  queue_status: 'waiting' | 'forming'
}

function calcAge(birthdate: string) {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

interface GroupChild {
  child_id: string
  child_name: string
  birthdate: string
  subjects: Subject[]
  diagnoses: string[]
  parent_name: string
  parent_email: string
}

interface FullGroup {
  id: string
  created_at: string
  teacher: { name: string; email: string }
  children: GroupChild[]
}

interface FormingGroup {
  id: string
  created_at: string
  subject: string | null
  teacher: { name: string; email: string }
  children: GroupChild[]
}

interface ActiveGroup {
  id: string
  created_at: string
  subject: string | null
  teacher: { name: string; email: string }
  children: GroupChild[]
}

interface MailError {
  id: string
  type: string
  recipient: string
  error: string
  created_at: string
}

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska',
  matte: 'Matte',
  engelska: 'Engelska',
}

const DIAGNOSIS_LABELS: Record<string, string> = {
  dyslexi: 'Dyslexi',
  dyskalkyli: 'Dyskalkyli',
  adhd: 'ADHD',
  autism: 'Autism',
  sprakstorning: 'Språkstörning',
  annat: 'Annat',
}

export default function AdminPage() {
  const [pendingTeachers, setPendingTeachers] = useState<PendingTeacher[]>([])
  const [approvedTeachers, setApprovedTeachers] = useState<ApprovedTeacher[]>([])
  const [queuedChildren, setQueuedChildren] = useState<QueuedChild[]>([])
  const [fullGroups, setFullGroups] = useState<FullGroup[]>([])
  const [formingGroups, setFormingGroups] = useState<FormingGroup[]>([])
  const [activeGroups, setActiveGroups] = useState<ActiveGroup[]>([])
  const [mailErrors, setMailErrors] = useState<MailError[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '' })
  const [newAdminLoading, setNewAdminLoading] = useState(false)
  const [newAdminMessage, setNewAdminMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<ApprovedTeacher | null>(null)
  const [selectedChild, setSelectedChild] = useState<QueuedChild | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const supabase = createClient()

  async function fetchData() {
    setLoading(true)

    const [pendingT, approvedT, children, full, forming, active, errors] = await Promise.all([
      supabase
        .from('teachers')
        .select('id, name, email, phone, subjects_can, subjects_blocked, age_groups, max_groups, motivation, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),

      supabase
        .from('teachers')
        .select('id, name, email, phone, subjects_can, subjects_blocked, age_groups, max_groups, motivation')
        .eq('status', 'approved')
        .order('name', { ascending: true }),

      supabase
        .from('children')
        .select('id, name, birthdate, subjects, diagnoses, diagnosis_other, extra_info, created_at, families(parent_name, email), group_members(id, groups(status))')
        .order('created_at', { ascending: true }),

      // Fullständiga grupper — väntar på admin-godkännande
      supabase
        .from('groups')
        .select(`
          id, created_at,
          teachers(name, email),
          group_members(
            child_id,
            children(name, birthdate, subjects, diagnoses, families(parent_name, email))
          )
        `)
        .eq('status', 'full')
        .order('created_at', { ascending: true }),

      // Grupper under uppbyggnad (1 barn, väntar på fler)
      supabase
        .from('groups')
        .select(`
          id, created_at, subject,
          teachers(name, email),
          group_members(
            child_id,
            children(name, birthdate, subjects, diagnoses, families(parent_name, email))
          )
        `)
        .eq('status', 'forming')
        .order('created_at', { ascending: true }),

      // Aktiva godkända grupper
      supabase
        .from('groups')
        .select(`
          id, created_at, subject,
          teachers(name, email),
          group_members(
            child_id,
            children(name, birthdate, subjects, diagnoses, families(parent_name, email))
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('mail_error_log')
        .select('id, type, recipient, error, created_at')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // Räkna endast aktiva grupper per lärare för visning
    const { data: activeGroupsForCount } = await supabase
      .from('groups')
      .select('teacher_id')
      .eq('status', 'active')

    const groupCount: Record<string, number> = {}
    for (const g of activeGroupsForCount ?? []) {
      groupCount[g.teacher_id] = (groupCount[g.teacher_id] ?? 0) + 1
    }

    setPendingTeachers((pendingT.data ?? []) as PendingTeacher[])

    setApprovedTeachers((approvedT.data ?? []).map((t: any) => ({
      ...t,
      active_groups: groupCount[t.id] ?? 0,
    })))

    // Barn i kön = ingen grupp alls, ELLER i en forming-grupp (väntar på matchpartner)
    const toArr = (v: any) => !v ? [] : Array.isArray(v) ? v : [v]
    const queued = (children.data ?? []).filter((c: any) => {
      const members = toArr(c.group_members)
      if (members.length === 0) return true
      const groupStatus = (Array.isArray(members[0].groups) ? members[0].groups[0] : members[0].groups)?.status
      return groupStatus === 'forming'
    })
    setQueuedChildren(queued.map((c: any) => {
      const members = toArr(c.group_members)
      const groupStatus = members.length > 0
        ? (Array.isArray(members[0].groups) ? members[0].groups[0] : members[0].groups)?.status
        : null
      return {
        id: c.id,
        child_name: c.name,
        birthdate: c.birthdate,
        subjects: c.subjects,
        diagnoses: c.diagnoses ?? [],
        diagnosis_other: c.diagnosis_other ?? null,
        extra_info: c.extra_info ?? null,
        created_at: c.created_at,
        family_name: c.families?.parent_name ?? '—',
        family_email: c.families?.email ?? '—',
        queue_status: groupStatus === 'forming' ? 'forming' : 'waiting',
      }
    }))

    // Fullständiga grupper
    setFullGroups((full.data ?? []).map((g: any) => {
      const teacher = Array.isArray(g.teachers) ? g.teachers[0] : g.teachers
      const members = Array.isArray(g.group_members) ? g.group_members : []
      const groupChildren: GroupChild[] = members.map((m: any) => {
        const child = Array.isArray(m.children) ? m.children[0] : m.children
        const family = child ? (Array.isArray(child.families) ? child.families[0] : child.families) : null
        return {
          child_id: m.child_id,
          child_name: child?.name ?? '—',
          birthdate: child?.birthdate ?? '',
          subjects: child?.subjects ?? [],
          diagnoses: child?.diagnoses ?? [],
          parent_name: family?.parent_name ?? '—',
          parent_email: family?.email ?? '—',
        }
      })
      return { id: g.id, created_at: g.created_at, teacher, children: groupChildren }
    }))

    // Grupper under uppbyggnad
    setFormingGroups((forming.data ?? []).map((g: any) => {
      const teacher = Array.isArray(g.teachers) ? g.teachers[0] : g.teachers
      const members = Array.isArray(g.group_members) ? g.group_members : []
      const groupChildren: GroupChild[] = members.map((m: any) => {
        const child = Array.isArray(m.children) ? m.children[0] : m.children
        const family = child ? (Array.isArray(child.families) ? child.families[0] : child.families) : null
        return {
          child_id: m.child_id,
          child_name: child?.name ?? '—',
          birthdate: child?.birthdate ?? '',
          subjects: child?.subjects ?? [],
          diagnoses: child?.diagnoses ?? [],
          parent_name: family?.parent_name ?? '—',
          parent_email: family?.email ?? '—',
        }
      })
      return { id: g.id, created_at: g.created_at, subject: g.subject ?? null, teacher, children: groupChildren }
    }))

    // Aktiva grupper
    setActiveGroups((active.data ?? []).map((g: any) => {
      const teacher = Array.isArray(g.teachers) ? g.teachers[0] : g.teachers
      const members = Array.isArray(g.group_members) ? g.group_members : []
      const groupChildren: GroupChild[] = members.map((m: any) => {
        const child = Array.isArray(m.children) ? m.children[0] : m.children
        const family = child ? (Array.isArray(child.families) ? child.families[0] : child.families) : null
        return {
          child_id: m.child_id,
          child_name: child?.name ?? '—',
          birthdate: child?.birthdate ?? '',
          subjects: child?.subjects ?? [],
          diagnoses: child?.diagnoses ?? [],
          parent_name: family?.parent_name ?? '—',
          parent_email: family?.email ?? '—',
        }
      })
      return { id: g.id, created_at: g.created_at, subject: g.subject ?? null, teacher, children: groupChildren }
    }))

    setMailErrors((errors.data ?? []) as MailError[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleTeacherAction(teacherId: string, action: 'approve' | 'reject') {
    setActionLoading(`teacher-${teacherId}-${action}`)
    setActionError(null)
    const endpoint = action === 'approve' ? '/api/admin/approve-teacher' : '/api/admin/reject-teacher'
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setActionError(body.error ?? `Något gick fel (${res.status})`)
    }
    setActionLoading(null)
    fetchData()
  }

  async function handleGroupAction(groupId: string, action: 'approve' | 'reject') {
    setActionLoading(`group-${groupId}-${action}`)
    setActionError(null)
    const endpoint = action === 'approve' ? '/api/admin/approve-group' : '/api/admin/reject-group'
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId }) })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setActionError(body.error ?? `Något gick fel (${res.status})`)
    }
    setActionLoading(null)
    fetchData()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/admin/logga-in'
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--beige)">
        <p className="text-(--teal) font-bold">Laddar…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Edly — Adminpanel</h1>
            <p className="text-sm text-(--teal-mid)">Hantera lärare och matchningar</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => window.location.href = '/admin/larare'}>
              Alla lärare
            </Button>
            <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => window.location.href = '/admin/barn'}>
              Alla barn
            </Button>
            <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => window.location.href = '/api/admin/export-members'}>
              Exportera medlemmar
            </Button>
            <Button variant="secondary" onClick={handleLogout} className="text-xs px-3 py-2 min-h-[36px]">
              Logga ut
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">

        {actionError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Väntande läraransökningar */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">
            Väntande läraransökningar
            {pendingTeachers.length > 0 && (
              <span className="ml-2 rounded-full bg-(--accent-org) px-2 py-0.5 text-xs text-white">{pendingTeachers.length}</span>
            )}
          </h2>
          {pendingTeachers.length === 0 ? (
            <Card><p className="text-sm text-gray-500">Inga väntande ansökningar.</p></Card>
          ) : (
            <div className="space-y-3">
              {pendingTeachers.map(teacher => (
                <Card key={teacher.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{teacher.name}</p>
                      <p className="text-sm text-gray-500">{teacher.email}</p>
                      <p className="text-sm text-gray-500">{teacher.phone ?? ''}</p>
                      <p className="mt-1 text-xs text-gray-400">Registrerad: {formatDate(teacher.created_at)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {teacher.subjects_can.map(s => (
                          <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs font-medium text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                        ))}
                        {teacher.subjects_blocked.map(s => (
                          <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>
                        ))}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(teacher.age_groups ?? []).map(a => (
                          <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{a}</span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Max grupper: {teacher.max_groups}</p>
                      {teacher.motivation && (
                        <p className="mt-2 text-sm text-gray-700 italic">"{teacher.motivation}"</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="primary" className="text-sm px-4 min-h-[40px]" loading={actionLoading === `teacher-${teacher.id}-approve`} onClick={() => handleTeacherAction(teacher.id, 'approve')}>Godkänn</Button>
                      <Button variant="danger" className="text-sm px-4 min-h-[40px]" loading={actionLoading === `teacher-${teacher.id}-reject`} onClick={() => handleTeacherAction(teacher.id, 'reject')}>Neka</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Godkända lärare */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">
            Godkända lärare
            <span className="ml-2 text-sm font-normal text-gray-500">({approvedTeachers.length} st)</span>
          </h2>
          {approvedTeachers.length === 0 ? (
            <Card><p className="text-sm text-gray-500">Inga godkända lärare ännu.</p></Card>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-(--teal-light) text-left">
                    <th className="px-4 py-3 font-bold text-(--teal)">Namn</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Ämnen</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Grupper</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {approvedTeachers.map(t => (
                    <tr
                      key={t.id}
                      className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-(--teal-light) transition-colors"
                      onClick={() => setSelectedTeacher(t)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.subjects_can.map(s => (
                            <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                          ))}
                          {t.subjects_blocked.map(s => (
                            <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${t.active_groups >= t.max_groups ? 'text-red-600' : 'text-green-700'}`}>
                          {t.active_groups}/{t.max_groups}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">Visa →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Barn i kön */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">
            Barn i kön
            <span className="ml-2 text-sm font-normal text-gray-500">({queuedChildren.length} st)</span>
          </h2>
          {queuedChildren.length === 0 ? (
            <Card><p className="text-sm text-gray-500">Inga barn i kön.</p></Card>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-(--teal-light) text-left">
                    <th className="px-4 py-3 font-bold text-(--teal)">Förälder</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Ålder</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Ämnen</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Diagnos</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">Status</th>
                    <th className="px-4 py-3 font-bold text-(--teal)">I kön sedan</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {queuedChildren.map(c => (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-(--teal-light) transition-colors"
                      onClick={() => setSelectedChild(c)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{c.family_name}</td>
                      <td className="px-4 py-3 text-gray-700">{calcAge(c.birthdate)} år</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.subjects.map(s => (
                            <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {(c.diagnoses ?? []).map((d: string) => DIAGNOSIS_LABELS[d] ?? d).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.queue_status === 'forming'
                          ? <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Tilldelas grupp</span>
                          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Väntar</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">Visa →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Fullständiga grupper — väntar på godkännande */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">
            Grupper att godkänna
            {fullGroups.length > 0 && (
              <span className="ml-2 rounded-full bg-(--accent-org) px-2 py-0.5 text-xs text-white">{fullGroups.length}</span>
            )}
          </h2>
          {fullGroups.length === 0 ? (
            <Card><p className="text-sm text-gray-500">Inga fullständiga grupper att godkänna.</p></Card>
          ) : (
            <div className="space-y-3">
              {fullGroups.map(group => (
                <Card key={group.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-bold text-gray-900">Lärare:</span>
                        <span className="text-sm text-gray-700">{group.teacher?.name}</span>
                        <span className="text-xs text-gray-400">{group.teacher?.email}</span>
                      </div>
                      <div className="space-y-3">
                        {group.children.map((child, i) => (
                          <div key={child.child_id} className="rounded-lg bg-gray-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase text-gray-400 mb-1">Barn {i + 1}</p>
                            <p className="text-sm font-medium text-gray-900">{child.child_name} · {child.birthdate ? calcAge(child.birthdate) : '?'} år</p>
                            <p className="text-xs text-gray-500">{child.parent_name} — <a href={`mailto:${child.parent_email}`} className="text-(--teal)">{child.parent_email}</a></p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {child.subjects.map(s => (
                                <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                              ))}
                              {child.diagnoses.map(d => (
                                <span key={d} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-600">{DIAGNOSIS_LABELS[d] ?? d}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">Fullsatt: {formatDate(group.created_at)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="primary" className="text-sm px-4 min-h-[40px]" loading={actionLoading === `group-${group.id}-approve`} onClick={() => handleGroupAction(group.id, 'approve')}>Godkänn grupp</Button>
                      <Button variant="danger" className="text-sm px-4 min-h-[40px]" loading={actionLoading === `group-${group.id}-reject`} onClick={() => handleGroupAction(group.id, 'reject')}>Avvisa</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Grupper under uppbyggnad */}
        {formingGroups.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold text-(--teal)">
              Grupper under uppbyggnad
              <span className="ml-2 text-sm font-normal text-gray-500">({formingGroups.length} st)</span>
            </h2>
            <div className="space-y-2">
              {formingGroups.map(g => {
                const expanded = expandedGroups.has(g.id)
                return (
                  <Card key={g.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{g.teacher?.name}</p>
                        {g.subject && <span className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[g.subject] ?? g.subject}</span>}
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">{g.children.length}/2 barn</span>
                      </div>
                      <button onClick={() => toggleGroup(g.id)} className="text-xs text-(--teal) font-medium hover:underline shrink-0 ml-2">
                        {expanded ? 'Visa mindre ↑' : 'Visa mer ↓'}
                      </button>
                    </div>
                    {expanded && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-400">{g.teacher?.email}</p>
                        {g.children.map((child, i) => (
                          <div key={child.child_id} className="rounded-lg bg-gray-50 px-4 py-2">
                            <p className="text-xs font-bold uppercase text-gray-400 mb-0.5">Barn {i + 1}</p>
                            <p className="text-sm font-medium text-gray-900">{child.child_name} · {child.birthdate ? calcAge(child.birthdate) : '?'} år</p>
                            <p className="text-xs text-gray-500">{child.parent_name} — <a href={`mailto:${child.parent_email}`} className="text-(--teal)">{child.parent_email}</a></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>
        )}

        {/* Aktiva grupper */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">
            Aktiva grupper
            <span className="ml-2 text-sm font-normal text-gray-500">({activeGroups.length} st)</span>
          </h2>
          {activeGroups.length === 0 ? (
            <Card><p className="text-sm text-gray-500">Inga aktiva grupper ännu.</p></Card>
          ) : (
            <div className="space-y-2">
              {activeGroups.map(g => {
                const expanded = expandedGroups.has(g.id)
                return (
                  <Card key={g.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{g.teacher?.name}</p>
                        {g.subject && <span className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[g.subject] ?? g.subject}</span>}
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktiv · {g.children.length} barn</span>
                        <span className="text-xs text-gray-400">{formatDate(g.created_at)}</span>
                      </div>
                      <button onClick={() => toggleGroup(g.id)} className="text-xs text-(--teal) font-medium hover:underline shrink-0 ml-2">
                        {expanded ? 'Visa mindre ↑' : 'Visa mer ↓'}
                      </button>
                    </div>
                    {expanded && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-400">{g.teacher?.email}</p>
                        {g.children.map((child, i) => (
                          <div key={child.child_id} className="rounded-lg bg-gray-50 px-4 py-2">
                            <p className="text-xs font-bold uppercase text-gray-400 mb-0.5">Barn {i + 1}</p>
                            <p className="text-sm font-medium text-gray-900">{child.child_name} · {child.birthdate ? calcAge(child.birthdate) : '?'} år</p>
                            <p className="text-xs text-gray-500">{child.parent_name} — <a href={`mailto:${child.parent_email}`} className="text-(--teal)">{child.parent_email}</a></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Skapa admin */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-(--teal)">Lägg till administratör</h2>
          <Card>
            <form
              onSubmit={async e => {
                e.preventDefault()
                setNewAdminLoading(true)
                setNewAdminMessage(null)
                const res = await fetch('/api/admin/create-admin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newAdmin),
                })
                const body = await res.json().catch(() => ({}))
                if (res.ok) {
                  setNewAdminMessage({ type: 'success', text: `${body.email} är nu admin.` })
                  setNewAdmin({ email: '', password: '' })
                } else {
                  setNewAdminMessage({ type: 'error', text: body.error ?? 'Något gick fel.' })
                }
                setNewAdminLoading(false)
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="E-postadress"
                  value={newAdmin.email}
                  onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))}
                  required
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)"
                />
                <input
                  type="password"
                  placeholder="Lösenord (minst 8 tecken)"
                  value={newAdmin.password}
                  onChange={e => setNewAdmin(a => ({ ...a, password: e.target.value }))}
                  required
                  minLength={8}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)"
                />
                <Button type="submit" loading={newAdminLoading} className="shrink-0">
                  Skapa admin
                </Button>
              </div>
              {newAdminMessage && (
                <p className={`text-sm ${newAdminMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                  {newAdminMessage.text}
                </p>
              )}
            </form>
          </Card>
        </section>

        {/* Mailfelloggar */}
        {mailErrors.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold text-(--teal)">
              Misslyckade mailutskick
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{mailErrors.length}</span>
            </h2>
            <div className="space-y-3">
              {mailErrors.map(err => (
                <Card key={err.id}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{err.type}</span>
                    <span className="text-sm text-gray-700">{err.recipient}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 font-mono">{err.error}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(err.created_at)}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Detaljpanel — lärare */}
      <DetailPanel
        open={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        title="Lärarinfo"
      >
        {selectedTeacher && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Namn</p>
              <p className="mt-1 text-gray-900">{selectedTeacher.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">E-post</p>
              <a href={`mailto:${selectedTeacher.email}`} className="mt-1 block text-(--teal) underline">{selectedTeacher.email}</a>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Telefon</p>
              <p className="mt-1 text-gray-900">{selectedTeacher.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ämnen</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedTeacher.subjects_can.map(s => (
                  <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                ))}
                {selectedTeacher.subjects_blocked.map(s => (
                  <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Åldersgrupper</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(selectedTeacher.age_groups ?? []).map(a => (
                  <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{a}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Kapacitet</p>
              <p className="mt-1 text-gray-900">{selectedTeacher.active_groups} aktiva / max {selectedTeacher.max_groups} grupper</p>
            </div>
            {selectedTeacher.motivation && (
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Motivation</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-900">{selectedTeacher.motivation}</p>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      {/* Detaljpanel — barn */}
      <DetailPanel
        open={!!selectedChild}
        onClose={() => setSelectedChild(null)}
        title="Familjeinfo"
      >
        {selectedChild && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Förälder</p>
              <p className="mt-1 text-gray-900">{selectedChild.family_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">E-post</p>
              <a href={`mailto:${selectedChild.family_email}`} className="mt-1 block text-(--teal) underline">{selectedChild.family_email}</a>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Barnets namn</p>
              <p className="mt-1 text-gray-900">{selectedChild.child_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ålder</p>
              <p className="mt-1 text-gray-900">{calcAge(selectedChild.birthdate)} år ({new Date(selectedChild.birthdate).toLocaleDateString('sv-SE')})</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Diagnos</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(selectedChild.diagnoses ?? []).length > 0
                  ? (selectedChild.diagnoses ?? []).map(d => (
                      <span key={d} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">
                        {DIAGNOSIS_LABELS[d] ?? d}
                      </span>
                    ))
                  : <p className="text-gray-500">—</p>
                }
              </div>
              {selectedChild.diagnosis_other && (
                <p className="mt-1 text-sm text-gray-700">{selectedChild.diagnosis_other}</p>
              )}
            </div>
            {selectedChild.extra_info && (
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Övrig information</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-900">{selectedChild.extra_info}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ämnen</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedChild.subjects.map(s => (
                  <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">I kön sedan</p>
              <p className="mt-1 text-gray-900">{formatDate(selectedChild.created_at)}</p>
            </div>
          </div>
        )}
      </DetailPanel>

    </div>
  )
}
