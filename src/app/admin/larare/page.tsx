'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DetailPanel } from '@/components/ui/DetailPanel'

type Filter = 'alla' | 'aktiva' | 'inaktiva'

interface Teacher {
  id: string
  name: string
  email: string
  phone: string | null
  subjects_can: string[]
  subjects_blocked: string[]
  age_groups: string[]
  max_groups: number
  motivation: string | null
  status: 'pending' | 'approved' | 'rejected'
  active_groups: number
  forming_groups: number
  created_at: string
}

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska',
  matte: 'Matte',
  engelska: 'Engelska',
}

function statusBadge(teacher: Teacher) {
  if (teacher.status === 'pending') {
    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Väntar på granskning</span>
  }
  if (teacher.status === 'rejected') {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Nekad</span>
  }
  if (teacher.active_groups > 0) {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktiv</span>
  }
  if (teacher.forming_groups > 0) {
    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Tilldelas grupp</span>
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Ingen grupp</span>
}

export default function AdminLararePage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('alla')
  const [selected, setSelected] = useState<Teacher | null>(null)

  const supabase = createClient()

  async function fetchTeachers() {
    setLoading(true)

    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id, name, email, phone, subjects_can, subjects_blocked, age_groups, max_groups, motivation, status, created_at')
      .order('created_at', { ascending: false })

    const { data: groupData } = await supabase
      .from('groups')
      .select('teacher_id, status')
      .in('status', ['forming', 'full', 'active'])

    const activeCount: Record<string, number> = {}
    const formingCount: Record<string, number> = {}
    for (const g of groupData ?? []) {
      if (g.status === 'active') {
        activeCount[g.teacher_id] = (activeCount[g.teacher_id] ?? 0) + 1
      } else {
        formingCount[g.teacher_id] = (formingCount[g.teacher_id] ?? 0) + 1
      }
    }

    setTeachers((teacherData ?? []).map((t: any) => ({
      ...t,
      active_groups: activeCount[t.id] ?? 0,
      forming_groups: formingCount[t.id] ?? 0,
    })))

    setLoading(false)
  }

  useEffect(() => { fetchTeachers() }, [])

  const isActive = (t: Teacher) => t.status === 'approved' && t.active_groups > 0
  const isInactive = (t: Teacher) => !isActive(t)

  const filtered = teachers.filter(t => {
    if (filter === 'aktiva') return isActive(t)
    if (filter === 'inaktiva') return isInactive(t)
    return true
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'alla', label: `Alla (${teachers.length})` },
    { key: 'aktiva', label: `Aktiva (${teachers.filter(isActive).length})` },
    { key: 'inaktiva', label: `Inaktiva (${teachers.filter(isInactive).length})` },
  ]

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Edly — Alla lärare</h1>
            <p className="text-sm text-(--teal-mid)">{teachers.length} registrerade lärare</p>
          </div>
          <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => router.push('/admin')}>
            ← Tillbaka till adminpanelen
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">

        {/* Filterflikar */}
        <div className="mb-6 flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                filter === tab.key
                  ? 'bg-(--teal) text-white'
                  : 'bg-white text-(--text-dark) hover:bg-(--teal-light)'
              }`}
            >
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
                {filtered.map(t => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-(--teal-light) transition-colors"
                    onClick={() => setSelected(t)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                      {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
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
                      <div className="flex flex-wrap gap-1">
                        {(t.age_groups ?? []).map(a => (
                          <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{a}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${t.active_groups >= t.max_groups ? 'text-red-600' : 'text-green-700'}`}>
                        {t.active_groups}/{t.max_groups}
                      </span>
                      {t.forming_groups > 0 && (
                        <p className="text-xs text-yellow-600">{t.forming_groups} under uppbyggnad</p>
                      )}
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
      </main>

      {/* Detaljpanel */}
      <DetailPanel open={!!selected} onClose={() => setSelected(null)} title="Lärarinfo">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Namn</p>
              <p className="mt-1 text-gray-900">{selected.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">E-post</p>
              <a href={`mailto:${selected.email}`} className="mt-1 block text-(--teal) underline">{selected.email}</a>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Telefon</p>
              <p className="mt-1 text-gray-900">{selected.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Status</p>
              <div className="mt-1">{statusBadge(selected)}</div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Ämnen</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.subjects_can.map(s => (
                  <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs text-(--teal)">{SUBJECT_LABELS[s] ?? s}</span>
                ))}
                {selected.subjects_blocked.map(s => (
                  <span key={s} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Ej {SUBJECT_LABELS[s] ?? s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Åldersgrupper</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(selected.age_groups ?? []).map(a => (
                  <span key={a} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{a}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Kapacitet</p>
              <p className="mt-1 text-gray-900">{selected.active_groups} aktiva / max {selected.max_groups} grupper</p>
              {selected.forming_groups > 0 && (
                <p className="mt-0.5 text-sm text-yellow-600">{selected.forming_groups} grupp(er) under uppbyggnad</p>
              )}
            </div>
            {selected.motivation && (
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Motivation</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-900">{selected.motivation}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase text-gray-400">Registrerad</p>
              <p className="mt-1 text-gray-900">{formatDate(selected.created_at)}</p>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  )
}
