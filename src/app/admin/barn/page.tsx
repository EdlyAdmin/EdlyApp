'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DetailPanel } from '@/components/ui/DetailPanel'
import type { Subject } from '@/lib/supabase/types'

type Filter = 'alla' | 'aktiva' | 'inaktiva'

interface Child {
  id: string
  name: string
  birthdate: string
  subjects: Subject[]
  diagnoses: string[]
  diagnosis_other: string | null
  extra_info: string | null
  created_at: string
  parent_name: string
  parent_email: string
  group_id: string | null
  group_status: string | null
  teacher_name: string | null
}

function calcAge(birthdate: string) {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'svenska', label: 'Svenska' },
  { value: 'matte', label: 'Matematik' },
  { value: 'engelska', label: 'Engelska' },
]

const DIAGNOSES = [
  { value: 'dyslexi', label: 'Dyslexi' },
  { value: 'dyskalkyli', label: 'Dyskalkyli' },
  { value: 'adhd', label: 'ADHD' },
  { value: 'autism', label: 'Autism' },
  { value: 'sprakstorning', label: 'Språkstörning' },
  { value: 'annat', label: 'Annat' },
]

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska', matte: 'Matte', engelska: 'Engelska',
}

const DIAGNOSIS_LABELS: Record<string, string> = {
  dyslexi: 'Dyslexi', dyskalkyli: 'Dyskalkyli', adhd: 'ADHD',
  autism: 'Autism', sprakstorning: 'Språkstörning', annat: 'Annat',
}

function statusBadge(groupStatus: string | null) {
  if (!groupStatus || groupStatus === 'rejected') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">I kö</span>
  if (groupStatus === 'forming') return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Tilldelad grupp</span>
  if (groupStatus === 'full') return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">Inväntar godkännande</span>
  if (groupStatus === 'active') return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktiv</span>
  return null
}

export default function AdminBarnPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('alla')
  const [selected, setSelected] = useState<Child | null>(null)
  const [editing, setEditing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [availableGroups, setAvailableGroups] = useState<{ id: string; label: string }[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Redigeringsformulär
  const [editForm, setEditForm] = useState({
    name: '', birthdate: '', subjects: [] as Subject[],
    diagnoses: [] as string[], diagnosisOther: '', extraInfo: '',
    parentName: '', parentEmail: '',
  })

  const supabase = createClient()

  async function fetchChildren() {
    setLoading(true)
    const { data } = await supabase
      .from('children')
      .select(`
        id, name, birthdate, subjects, diagnoses, diagnosis_other, extra_info, created_at,
        families(parent_name, email),
        group_members(group_id, groups(id, status, teachers(name, email)))
      `)
      .order('created_at', { ascending: false })

    const mapped: Child[] = (data ?? []).map((c: any) => {
      const family = Array.isArray(c.families) ? c.families[0] : c.families
      const members = Array.isArray(c.group_members) ? c.group_members : (c.group_members ? [c.group_members] : [])
      const activeMember = members.find((m: any) => {
        const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
        return g && g.status !== 'rejected'
      }) ?? members[0]
      const group = activeMember ? (Array.isArray(activeMember.groups) ? activeMember.groups[0] : activeMember.groups) : null
      const teacher = group ? (Array.isArray(group.teachers) ? group.teachers[0] : group.teachers) : null
      return {
        id: c.id, name: c.name, birthdate: c.birthdate,
        subjects: c.subjects ?? [], diagnoses: c.diagnoses ?? [],
        diagnosis_other: c.diagnosis_other ?? null, extra_info: c.extra_info ?? null,
        created_at: c.created_at,
        parent_name: family?.parent_name ?? '—', parent_email: family?.email ?? '—',
        group_id: activeMember?.group_id ?? null,
        group_status: group?.status ?? null,
        teacher_name: teacher?.name ?? null,
      }
    })
    setChildren(mapped)
    setLoading(false)
  }

  useEffect(() => { fetchChildren() }, [])

  async function fetchAvailableGroups(child: Child) {
    const childSubject = child.subjects[0]
    // Hämta forming-grupper med plats, filtrera på barnets ämne
    const { data } = await supabase
      .from('groups')
      .select('id, subject, teachers(name), group_members(child_id)')
      .eq('status', 'forming')

    const groups = (data ?? [])
      .filter((g: any) => {
        const memberCount = Array.isArray(g.group_members) ? g.group_members.length : 0
        const subject = g.subject
        return memberCount < 2 && (!subject || subject === childSubject)
      })
      .map((g: any) => {
        const teacher = Array.isArray(g.teachers) ? g.teachers[0] : g.teachers
        const count = Array.isArray(g.group_members) ? g.group_members.length : 0
        const subjectLabel = SUBJECT_LABELS[g.subject] ?? g.subject ?? '?'
        return { id: g.id, label: `${teacher?.name ?? '—'} — ${subjectLabel} (${count}/2 barn)` }
      })

    setAvailableGroups(groups)
    setSelectedGroupId(groups[0]?.id ?? '')
  }

  async function handleDeleteChild(childId: string) {
    setActionLoading('delete')
    setError(null)
    const res = await fetch('/api/admin/delete-child', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'Något gick fel.'); setActionLoading(null); setConfirmDelete(false); return }
    setActionLoading(null)
    setConfirmDelete(false)
    setSelected(null)
    await fetchChildren()
  }

  function openChild(c: Child) {
    setSelected(c)
    setEditing(false)
    setError(null)
    setConfirmDelete(false)
    setSelectedGroupId('')
    setAvailableGroups([])
    if (!c.group_id) fetchAvailableGroups(c)
    setEditForm({
      name: c.name, birthdate: c.birthdate,
      subjects: c.subjects, diagnoses: c.diagnoses,
      diagnosisOther: c.diagnosis_other ?? '', extraInfo: c.extra_info ?? '',
      parentName: c.parent_name, parentEmail: c.parent_email,
    })
  }

  async function handleRemove(childId: string) {
    setActionLoading('remove')
    setError(null)
    const res = await fetch('/api/admin/remove-from-group', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId }),
    })
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error ?? 'Något gick fel.') }
    setActionLoading(null)
    await fetchChildren()
    if (selected?.id === childId) {
      const updated = children.find(c => c.id === childId)
      if (updated) setSelected({ ...updated, group_id: null, group_status: null, teacher_name: null })
    }
  }

  async function handleAddToGroup(childId: string) {
    if (!selectedGroupId) { setError('Välj en grupp.'); return }
    setActionLoading('add-group')
    setError(null)
    const res = await fetch('/api/admin/add-child-to-group', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, groupId: selectedGroupId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'Något gick fel.'); setActionLoading(null); return }
    setSelectedGroupId('')
    setAvailableGroups([])
    setActionLoading(null)
    await fetchChildren()
  }

  async function handleSaveChild() {
    if (!selected) return
    setActionLoading('save')
    setError(null)
    const res = await fetch('/api/admin/update-child', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: selected.id, ...editForm }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setError(body.error ?? 'Kunde inte spara.'); setActionLoading(null); return }
    setEditing(false)
    setActionLoading(null)
    await fetchChildren()
  }

  const filtered = children.filter(c => {
    if (filter === 'aktiva') return c.group_status === 'active'
    if (filter === 'inaktiva') return c.group_status !== 'active'
    return true
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'alla', label: `Alla (${children.length})` },
    { key: 'aktiva', label: `Aktiva (${children.filter(c => c.group_status === 'active').length})` },
    { key: 'inaktiva', label: `Inaktiva (${children.filter(c => c.group_status !== 'active').length})` },
  ]

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Edly — Alla barn</h1>
            <p className="text-sm text-(--teal-mid)">{children.length} registrerade barn</p>
          </div>
          <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => router.push('/admin')}>
            ← Tillbaka
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && !selected && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-6 flex gap-2">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${filter === tab.key ? 'bg-(--teal) text-white' : 'bg-white text-(--text-dark) hover:bg-(--teal-light)'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Card><p className="text-sm text-gray-500">Laddar…</p></Card>
        ) : filtered.length === 0 ? (
          <Card><p className="text-sm text-gray-500">Inga barn hittades.</p></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-(--teal-light) text-left">
                  <th className="px-4 py-3 font-bold text-(--teal)">Barn</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Förälder</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Ålder</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Ämne</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Status</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Lärare</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Registrerad</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-(--teal-light) transition-colors"
                    onClick={() => openChild(c)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {c.diagnoses.map(d => (
                          <span key={d} className="rounded-full bg-orange-50 px-1.5 py-0.5 text-xs text-orange-600">{DIAGNOSIS_LABELS[d] ?? d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{c.parent_name}</p>
                      <p className="text-xs text-(--teal)">{c.parent_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{calcAge(c.birthdate)} år</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.subjects.map(s => (
                          <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.group_status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.teacher_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">Visa →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <DetailPanel open={!!selected} onClose={() => { setSelected(null); setEditing(false); setError(null) }} title={editing ? 'Redigera barn' : 'Barninfo'}>
        {selected && !editing && (
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div><p className="text-xs font-bold uppercase text-gray-400">Barnets namn</p><p className="mt-1 text-gray-900">{selected.name}</p></div>
            <div><p className="text-xs font-bold uppercase text-gray-400">Ålder</p><p className="mt-1 text-gray-900">{calcAge(selected.birthdate)} år ({new Date(selected.birthdate).toLocaleDateString('sv-SE')})</p></div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ämne</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.subjects.map(s => <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Diagnos</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.diagnoses.length > 0
                  ? selected.diagnoses.map(d => <span key={d} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{DIAGNOSIS_LABELS[d] ?? d}</span>)
                  : <p className="text-sm text-gray-500">—</p>}
              </div>
              {selected.diagnosis_other && <p className="mt-1 text-sm text-gray-700">{selected.diagnosis_other}</p>}
            </div>
            {selected.extra_info && <div><p className="text-xs font-bold uppercase text-gray-400">Övrig info</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{selected.extra_info}</p></div>}
            <div><p className="text-xs font-bold uppercase text-gray-400">Förälder</p><p className="mt-1 text-gray-900">{selected.parent_name}</p><a href={`mailto:${selected.parent_email}`} className="text-sm text-(--teal) underline">{selected.parent_email}</a></div>
            <div><p className="text-xs font-bold uppercase text-gray-400">Status</p><div className="mt-1">{statusBadge(selected.group_status)}</div></div>
            {selected.teacher_name && <div><p className="text-xs font-bold uppercase text-gray-400">Lärare</p><p className="mt-1 text-gray-900">{selected.teacher_name}</p></div>}

            <hr className="border-gray-100" />

            {/* Lägg till i grupp */}
            {!selected.group_id && (
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-2">Lägg i grupp manuellt</p>
                {availableGroups.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Inga lediga grupper för {SUBJECT_LABELS[selected.subjects[0]] ?? selected.subjects[0] ?? 'detta ämne'}.</p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedGroupId}
                      onChange={e => setSelectedGroupId(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-(--teal) bg-white"
                    >
                      {availableGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                    <Button variant="primary" className="text-xs px-3 min-h-[36px]"
                      loading={actionLoading === 'add-group'} onClick={() => handleAddToGroup(selected.id)}>
                      Lägg till
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Sätt i kö */}
            {selected.group_id && selected.group_status !== 'rejected' && (
              <Button variant="danger" className="w-full text-sm"
                loading={actionLoading === 'remove'} onClick={() => handleRemove(selected.id)}>
                Sätt i kö igen
              </Button>
            )}

            <Button variant="secondary" className="w-full text-sm" onClick={() => setEditing(true)}>
              Redigera uppgifter
            </Button>

            <hr className="border-gray-100" />

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Radera barn
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">Är du säker?</p>
                <p className="text-xs text-red-600">
                  Detta raderar <strong>{selected.name}</strong> och all tillhörande data permanent. Åtgärden kan inte ångras.
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1 text-sm"
                    loading={actionLoading === 'delete'}
                    onClick={() => handleDeleteChild(selected.id)}>
                    Ja, radera
                  </Button>
                  <Button variant="secondary" className="flex-1 text-sm"
                    onClick={() => setConfirmDelete(false)}>
                    Avbryt
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {selected && editing && (
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Barnets namn</label>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Födelsedatum</label>
              <input type="date" value={editForm.birthdate} onChange={e => setEditForm(f => ({ ...f, birthdate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Ämne</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s.value} type="button" onClick={() => setEditForm(f => ({ ...f, subjects: [s.value] }))}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${editForm.subjects.includes(s.value) ? 'border-(--teal) bg-(--teal) text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Diagnoser</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {DIAGNOSES.map(d => (
                  <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editForm.diagnoses.includes(d.value)}
                      onChange={() => setEditForm(f => ({
                        ...f,
                        diagnoses: f.diagnoses.includes(d.value) ? f.diagnoses.filter(x => x !== d.value) : [...f.diagnoses, d.value]
                      }))}
                      className="h-4 w-4 accent-(--teal)" />
                    <span className="text-sm text-gray-700">{d.label}</span>
                  </label>
                ))}
              </div>
              {editForm.diagnoses.includes('annat') && (
                <input value={editForm.diagnosisOther} onChange={e => setEditForm(f => ({ ...f, diagnosisOther: e.target.value }))}
                  placeholder="Beskriv diagnos…" className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Övrig information</label>
              <textarea value={editForm.extraInfo} onChange={e => setEditForm(f => ({ ...f, extraInfo: e.target.value }))}
                rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Förälderns namn</label>
              <input value={editForm.parentName} onChange={e => setEditForm(f => ({ ...f, parentName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Förälderns e-post</label>
              <input type="email" value={editForm.parentEmail} onChange={e => setEditForm(f => ({ ...f, parentEmail: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--teal)" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1 text-sm" loading={actionLoading === 'save'} onClick={handleSaveChild}>
                Spara
              </Button>
              <Button variant="secondary" className="flex-1 text-sm" onClick={() => { setEditing(false); setError(null) }}>
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  )
}
