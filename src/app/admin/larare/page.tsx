'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DetailPanel } from '@/components/ui/DetailPanel'
import type { Subject } from '@/lib/supabase/types'

type Filter = 'alla' | 'aktiva' | 'inaktiva'

interface Teacher {
  id: string
  name: string
  email: string
  phone: string | null
  subjects_can: Subject[]
  subjects_blocked: Subject[]
  age_groups: string[]
  max_groups: number
  motivation: string | null
  status: 'pending' | 'approved' | 'rejected'
  paused: boolean
  active_groups: number
  forming_groups: number
  created_at: string
}

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'svenska', label: 'Svenska' },
  { value: 'matte', label: 'Matematik' },
  { value: 'engelska', label: 'Engelska' },
]

const AGE_GROUPS = [
  { value: 'F-9', label: 'F–9 (6–9 år)' },
  { value: '10-12', label: '10–12 år' },
  { value: '13-15', label: '13–15 år' },
]

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska', matte: 'Matte', engelska: 'Engelska',
}

function calcAge(birthdate: string) {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

interface WaitingChild {
  id: string
  name: string
  birthdate: string
  subjects: Subject[]
  parent_name: string
}

function statusBadge(teacher: Teacher) {
  if (teacher.status === 'pending') return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Väntar på granskning</span>
  if (teacher.status === 'rejected') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Nekad</span>
  if (teacher.paused) return <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Blockerad från matchning</span>
  if (teacher.active_groups > 0) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktiv</span>
  if (teacher.forming_groups > 0) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Tilldelad grupp</span>
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Ingen grupp</span>
}

export default function AdminLararePage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('alla')
  const [selected, setSelected] = useState<Teacher | null>(null)
  const [editing, setEditing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '',
    subjectsCan: [] as Subject[], subjectsBlocked: [] as Subject[],
    ageGroups: [] as string[], maxGroups: 2, paused: false,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const [waitingChildren, setWaitingChildren] = useState<WaitingChild[]>([])
  const [cgSubject, setCgSubject] = useState('')
  const [cgChildIds, setCgChildIds] = useState<string[]>([])
  const [cgLoading, setCgLoading] = useState(false)
  const [cgError, setCgError] = useState<string | null>(null)
  const [cgSuccess, setCgSuccess] = useState<string | null>(null)

  const supabase = createClient()

  async function fetchTeachers() {
    setLoading(true)
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id, name, email, phone, subjects_can, subjects_blocked, age_groups, max_groups, motivation, status, paused, created_at')
      .order('created_at', { ascending: false })

    const { data: groupData } = await supabase
      .from('groups').select('teacher_id, status').in('status', ['forming', 'full', 'active'])

    const activeCount: Record<string, number> = {}
    const formingCount: Record<string, number> = {}
    for (const g of groupData ?? []) {
      if (g.status === 'active') activeCount[g.teacher_id] = (activeCount[g.teacher_id] ?? 0) + 1
      else formingCount[g.teacher_id] = (formingCount[g.teacher_id] ?? 0) + 1
    }

    setTeachers((teacherData ?? []).map((t: any) => ({
      ...t,
      paused: t.paused ?? false,
      active_groups: activeCount[t.id] ?? 0,
      forming_groups: formingCount[t.id] ?? 0,
    })))
    setLoading(false)
  }

  useEffect(() => {
    fetchTeachers()
    fetchWaitingChildren()
  }, [])

  async function fetchWaitingChildren() {
    const { data } = await supabase
      .from('children')
      .select('id, name, birthdate, subjects, families(parent_name), group_members(id, groups(status))')
      .order('created_at', { ascending: true })

    const toArr = (v: any) => !v ? [] : Array.isArray(v) ? v : [v]
    const waiting = (data ?? []).filter((c: any) => {
      const members = toArr(c.group_members)
      if (members.length === 0) return true
      const status = (Array.isArray(members[0].groups) ? members[0].groups[0] : members[0].groups)?.status
      return !status || status === 'forming'
    })
    setWaitingChildren(waiting.map((c: any) => ({
      id: c.id,
      name: c.name,
      birthdate: c.birthdate,
      subjects: c.subjects ?? [],
      parent_name: (Array.isArray(c.families) ? c.families[0] : c.families)?.parent_name ?? '—',
    })))
  }

  async function handleDeleteTeacher() {
    if (!selected) return
    setDeleteLoading(true)
    setError(null)
    const res = await fetch('/api/admin/delete-teacher', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: selected.id }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error ?? 'Kunde inte radera läraren.')
      setDeleteLoading(false)
      setConfirmDelete(false)
      return
    }
    setDeleteLoading(false)
    setSelected(null)
    setConfirmDelete(false)
    fetchTeachers()
  }

  function openTeacher(t: Teacher) {
    setSelected(t)
    setEditing(false)
    setConfirmDelete(false)
    setError(null)
    setEditForm({
      name: t.name, email: t.email, phone: t.phone ?? '',
      subjectsCan: t.subjects_can, subjectsBlocked: t.subjects_blocked,
      ageGroups: t.age_groups, maxGroups: t.max_groups, paused: t.paused,
    })
    setCgSubject(t.subjects_can[0] ?? '')
    setCgChildIds([])
    setCgError(null)
    setCgSuccess(null)
  }

  async function handleCreateGroup() {
    if (!selected) return
    setCgLoading(true)
    setCgError(null)
    setCgSuccess(null)
    const res = await fetch('/api/admin/create-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: selected.id, subject: cgSubject || null, childIds: cgChildIds }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setCgError(body.error ?? 'Något gick fel.')
    } else {
      const label = body.status === 'full' ? 'full (väntar på godkännande)' : 'under uppbyggnad'
      setCgSuccess(`Grupp skapad — status: ${label}.`)
      setCgChildIds([])
      fetchTeachers()
      fetchWaitingChildren()
    }
    setCgLoading(false)
  }

  function toggleCan(s: Subject) {
    setEditForm(f => ({
      ...f,
      subjectsCan: f.subjectsCan.includes(s) ? f.subjectsCan.filter(x => x !== s) : [...f.subjectsCan, s],
      subjectsBlocked: f.subjectsBlocked.filter(x => x !== s),
    }))
  }

  function toggleBlocked(s: Subject) {
    setEditForm(f => ({
      ...f,
      subjectsBlocked: f.subjectsBlocked.includes(s) ? f.subjectsBlocked.filter(x => x !== s) : [...f.subjectsBlocked, s],
      subjectsCan: f.subjectsCan.filter(x => x !== s),
    }))
  }

  function toggleAge(a: string) {
    setEditForm(f => ({
      ...f,
      ageGroups: f.ageGroups.includes(a) ? f.ageGroups.filter(x => x !== a) : [...f.ageGroups, a],
    }))
  }

  async function handleSave() {
    if (!selected) return
    setActionLoading(true)
    setError(null)
    const res = await fetch('/api/admin/update-teacher', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: selected.id, ...editForm, paused: editForm.paused }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'Kunde inte spara.'); setActionLoading(false); return }
    setEditing(false)
    setActionLoading(false)
    await fetchTeachers()
  }

  const isActive = (t: Teacher) => t.status === 'approved' && t.active_groups > 0
  const filtered = teachers.filter(t => {
    if (filter === 'aktiva') return isActive(t)
    if (filter === 'inaktiva') return !isActive(t)
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'alla', label: `Alla (${teachers.length})` },
    { key: 'aktiva', label: `Aktiva (${teachers.filter(isActive).length})` },
    { key: 'inaktiva', label: `Inaktiva (${teachers.filter(t => !isActive(t)).length})` },
  ]

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-(--teal) sm:text-xl">Alla lärare</h1>
            <p className="text-sm text-(--teal-mid)">{teachers.length} registrerade</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => window.location.href = '/api/admin/export-teachers'}>
              Exportera
            </Button>
            <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => router.push('/admin')}>
              ← Tillbaka
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex gap-2">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => { setFilter(tab.key); setPage(1) }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${filter === tab.key ? 'bg-(--teal) text-white' : 'bg-white text-(--text-dark) hover:bg-(--teal-light)'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Card><p className="text-sm text-gray-500">Laddar…</p></Card>
        ) : filtered.length === 0 ? (
          <Card><p className="text-sm text-gray-500">Inga lärare hittades.</p></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-(--teal-light) text-left">
                  <th className="px-4 py-3 font-bold text-(--teal)">Lärare</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Ämnen</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Åldrar</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Grupper</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Status</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Registrerad</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => (
                  <tr key={t.id} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-(--teal-light) transition-colors"
                    onClick={() => openTeacher(t)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                      {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.subjects_can.map(s => <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>)}
                        {t.subjects_blocked.map(s => <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(t.age_groups ?? []).map(a => <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{a}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${t.active_groups >= t.max_groups ? 'text-red-600' : 'text-green-700'}`}>{t.active_groups}/{t.max_groups}</span>
                      {t.forming_groups > 0 && <p className="text-xs text-yellow-600">{t.forming_groups} under uppbyggnad</p>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(t)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">Visa →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-gray-500">
              Visar {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} av {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Föregående
              </button>
              <span className="flex items-center px-3 py-1.5 text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Nästa →
              </button>
            </div>
          </div>
        )}
      </main>

      <DetailPanel open={!!selected} onClose={() => { setSelected(null); setEditing(false); setError(null) }} title={editing ? 'Redigera lärare' : 'Lärarinfo'}>
        {selected && !editing && (
          <div className="space-y-4">
            <div><p className="text-xs font-bold uppercase text-gray-400">Namn</p><p className="mt-1 text-gray-900">{selected.name}</p></div>
            <div><p className="text-xs font-bold uppercase text-gray-400">E-post</p><a href={`mailto:${selected.email}`} className="mt-1 block text-(--teal) underline">{selected.email}</a></div>
            <div><p className="text-xs font-bold uppercase text-gray-400">Telefon</p><p className="mt-1 text-gray-900">{selected.phone ?? '—'}</p></div>
            <div><p className="text-xs font-bold uppercase text-gray-400">Status</p><div className="mt-1">{statusBadge(selected)}</div></div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ämnen</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.subjects_can.map(s => <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>)}
                {selected.subjects_blocked.map(s => <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Åldersgrupper</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(selected.age_groups ?? []).map(a => <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{a}</span>)}
              </div>
            </div>
            <div><p className="text-xs font-bold uppercase text-gray-400">Kapacitet</p><p className="mt-1 text-gray-900">{selected.active_groups} aktiva / max {selected.max_groups} grupper</p></div>
            {selected.motivation && <div><p className="text-xs font-bold uppercase text-gray-400">Motivation</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{selected.motivation}</p></div>}
            <div><p className="text-xs font-bold uppercase text-gray-400">Registrerad</p><p className="mt-1 text-gray-900">{formatDate(selected.created_at)}</p></div>

            <div><p className="text-xs font-bold uppercase text-gray-400">Matchning</p>
              <p className="mt-1 text-sm text-gray-900">{selected.paused ? '🚫 Blockerad från nya matchningar' : '✓ Tillgänglig för matchning'}</p>
            </div>

            <div className="border-t border-gray-100 pt-5 space-y-4">
              <p className="text-xs font-bold uppercase text-gray-400">Skapa grupp manuellt</p>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ämne</label>
                <select
                  value={cgSubject}
                  onChange={e => { setCgSubject(e.target.value); setCgChildIds([]) }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-(--teal)"
                >
                  <option value="">Inget specifikt ämne</option>
                  {selected.subjects_can.map(s => (
                    <option key={s} value={s}>{SUBJECT_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Barn <span className="text-gray-400 font-normal">(välj 1–2)</span>
                </label>
                {(() => {
                  const available = waitingChildren.filter(c =>
                    !cgSubject || c.subjects.includes(cgSubject as Subject)
                  )
                  if (available.length === 0) {
                    return <p className="text-sm text-gray-400 italic">Inga väntande barn{cgSubject ? ` i ${SUBJECT_LABELS[cgSubject]}` : ''}.</p>
                  }
                  return (
                    <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-gray-200 bg-white p-2">
                      {available.map(c => {
                        const checked = cgChildIds.includes(c.id)
                        const disabled = !checked && cgChildIds.length >= 2
                        return (
                          <label key={c.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-(--teal-light)' : 'hover:bg-gray-50'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => setCgChildIds(prev => checked ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                              className="h-4 w-4 accent-(--teal)"
                            />
                            <span className="text-sm text-gray-900">{c.name}</span>
                            <span className="text-xs text-gray-400">{calcAge(c.birthdate)} år · {c.parent_name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {cgError && <p className="text-sm text-red-600">{cgError}</p>}
              {cgSuccess && <p className="text-sm text-green-700">{cgSuccess}</p>}

              <Button variant="primary" loading={cgLoading} onClick={handleCreateGroup} className="w-full">
                Skapa grupp
              </Button>
            </div>

            <Button variant="secondary" className="w-full text-sm mt-2" onClick={() => setEditing(true)}>
              Redigera uppgifter
            </Button>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            {!confirmDelete ? (
              <button
                onClick={() => { setConfirmDelete(true); setError(null) }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors w-full justify-center"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Radera lärare
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden mt-1">
                <div className="flex items-start gap-3 px-4 py-3 border-b border-red-100">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-800">Radera {selected.name}?</p>
                    <p className="text-xs text-red-600 mt-0.5">Lärarkontot och inloggningen tas bort permanent. Läraren måste registrera sig på nytt för att komma tillbaka.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-3">
                  <Button variant="danger" className="text-xs px-4 min-h-[34px]" loading={deleteLoading} onClick={handleDeleteTeacher}>
                    Ja, radera
                  </Button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selected && editing && (
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Namn</label>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400">E-post</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Telefon</label>
              <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-2">Kan undervisa i</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s.value} type="button" onClick={() => toggleCan(s.value)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${editForm.subjectsCan.includes(s.value) ? 'border-(--teal) bg-(--teal) text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-2">Vill ej undervisa i</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s.value} type="button" onClick={() => toggleBlocked(s.value)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${editForm.subjectsBlocked.includes(s.value) ? 'border-(--accent-org) bg-(--accent-org) text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-2">Åldersgrupper</label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map(a => (
                  <button key={a.value} type="button" onClick={() => toggleAge(a.value)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${editForm.ageGroups.includes(a.value) ? 'border-(--teal) bg-(--teal) text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Max antal grupper</label>
              <select value={editForm.maxGroups} onChange={e => setEditForm(f => ({ ...f, maxGroups: parseInt(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'grupp' : 'grupper'}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 block mb-2">Matchning</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.paused}
                  onChange={e => setEditForm(f => ({ ...f, paused: e.target.checked }))}
                  className="h-4 w-4 accent-orange-500"
                />
                <span className="text-sm text-gray-700">Blockera från nya matchningar</span>
              </label>
              {editForm.paused && (
                <p className="mt-1 text-xs text-orange-600">Läraren kommer inte tilldelas nya grupper vid matchning.</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1 text-sm" loading={actionLoading} onClick={handleSave}>Spara</Button>
              <Button variant="secondary" className="flex-1 text-sm" onClick={() => { setEditing(false); setError(null) }}>Avbryt</Button>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  )
}
