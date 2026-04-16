'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type Filter = 'alla' | 'aktiva' | 'inaktiva'

interface Child {
  id: string
  name: string
  birthdate: string
  subjects: string[]
  diagnoses: string[]
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

function statusBadge(groupStatus: string | null) {
  if (!groupStatus || groupStatus === 'rejected') {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">I kö</span>
  }
  if (groupStatus === 'forming') {
    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Tilldelas grupp</span>
  }
  if (groupStatus === 'full') {
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">Inväntar godkännande</span>
  }
  if (groupStatus === 'active') {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktiv</span>
  }
  return null
}

export default function AdminBarnPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('alla')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function fetchChildren() {
    setLoading(true)
    const { data } = await supabase
      .from('children')
      .select(`
        id, name, birthdate, subjects, diagnoses, created_at,
        families(parent_name, email),
        group_members(
          group_id,
          groups(id, status, teachers(name, email))
        )
      `)
      .order('created_at', { ascending: false })

    const mapped: Child[] = (data ?? []).map((c: any) => {
      const family = Array.isArray(c.families) ? c.families[0] : c.families
      const members = Array.isArray(c.group_members) ? c.group_members : (c.group_members ? [c.group_members] : [])

      // Hitta aktiv/relevant grupp (ignorera rejected)
      const activeMember = members.find((m: any) => {
        const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
        return g && g.status !== 'rejected'
      }) ?? members[0]

      const group = activeMember
        ? (Array.isArray(activeMember.groups) ? activeMember.groups[0] : activeMember.groups)
        : null

      const teacher = group
        ? (Array.isArray(group.teachers) ? group.teachers[0] : group.teachers)
        : null

      return {
        id: c.id,
        name: c.name,
        birthdate: c.birthdate,
        subjects: c.subjects ?? [],
        diagnoses: c.diagnoses ?? [],
        created_at: c.created_at,
        parent_name: family?.parent_name ?? '—',
        parent_email: family?.email ?? '—',
        group_id: activeMember?.group_id ?? null,
        group_status: group?.status ?? null,
        teacher_name: teacher?.name ?? null,
      }
    })

    setChildren(mapped)
    setLoading(false)
  }

  useEffect(() => { fetchChildren() }, [])

  async function handleRemove(childId: string) {
    setActionLoading(childId)
    setError(null)
    const res = await fetch('/api/admin/remove-from-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Något gick fel.')
    }
    setActionLoading(null)
    fetchChildren()
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
            ← Tillbaka till adminpanelen
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

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
          <Card><p className="text-sm text-gray-500">Inga barn hittades.</p></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-(--teal-light) text-left">
                  <th className="px-4 py-3 font-bold text-(--teal)">Barn</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Förälder</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Ålder</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Ämnen</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Status</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Lärare</th>
                  <th className="px-4 py-3 font-bold text-(--teal)">Registrerad</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
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
                      <a href={`mailto:${c.parent_email}`} className="text-xs text-(--teal)">{c.parent_email}</a>
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
                    <td className="px-4 py-3 text-right">
                      {c.group_id && c.group_status !== 'rejected' && (
                        <Button
                          variant="danger"
                          className="text-xs px-3 py-1.5 min-h-[32px]"
                          loading={actionLoading === c.id}
                          onClick={() => handleRemove(c.id)}
                        >
                          Ta bort ur grupp
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
