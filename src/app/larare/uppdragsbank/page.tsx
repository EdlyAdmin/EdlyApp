'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { Subject } from '@/lib/supabase/types'

interface AssignmentEntry {
  id: string
  age: number
  subjects: Subject[]
  diagnoses: string[]
  diagnosis_other?: string
  extra_info?: string
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

const SUBJECTS: Subject[] = ['svenska', 'matte', 'engelska']
const DIAGNOSIS_FILTER_OPTIONS = [
  { value: 'alla', label: 'Alla diagnoser' },
  { value: 'dyslexi', label: 'Dyslexi' },
  { value: 'dyskalkyli', label: 'Dyskalkyli' },
  { value: 'adhd', label: 'ADHD' },
  { value: 'autism', label: 'Autism' },
  { value: 'sprakstorning', label: 'Språkstörning' },
  { value: 'annat', label: 'Annat' },
]

export default function UppdragsbankPage() {
  const [entries, setEntries] = useState<AssignmentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSubject, setFilterSubject] = useState<Subject | 'alla'>('alla')
  const [filterDiagnosis, setFilterDiagnosis] = useState<string>('alla')
  const [filterAge, setFilterAge] = useState<string>('alla')

  const supabase = createClient()

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('assignment_bank')
      .select('*')
      .order('created_at', { ascending: true })

    setEntries((data ?? []) as AssignmentEntry[])
    setLoading(false)
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/larare/logga-in'
  }

  const filtered = entries.filter(entry => {
    if (filterSubject !== 'alla' && !entry.subjects.includes(filterSubject)) return false
    if (filterDiagnosis !== 'alla' && !(entry.diagnoses ?? []).includes(filterDiagnosis)) return false
    if (filterAge === 'under10' && entry.age >= 10) return false
    if (filterAge === '10-13' && (entry.age < 10 || entry.age > 13)) return false
    if (filterAge === 'over13' && entry.age <= 13) return false
    return true
  })

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Uppdragsbank</h1>
            <p className="text-sm text-(--teal-mid)">Anonymiserade barnprofiler som söker lärare</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/larare/installningar">
              <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]">
                Notiser
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleLogout} className="text-xs px-3 py-2 min-h-[36px]">
              Logga ut
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Filter */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Ämne</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterSubject('alla')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  filterSubject === 'alla'
                    ? 'bg-(--teal) text-white'
                    : 'bg-white text-gray-600 hover:bg-(--teal-light)'
                }`}
              >
                Alla
              </button>
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSubject(s)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    filterSubject === s
                      ? 'bg-(--teal) text-white'
                      : 'bg-white text-gray-600 hover:bg-(--teal-light)'
                  }`}
                >
                  {SUBJECT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Diagnos</label>
            <select
              value={filterDiagnosis}
              onChange={e => setFilterDiagnosis(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-(--teal)"
            >
              {DIAGNOSIS_FILTER_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600">Ålder</label>
            <select
              value={filterAge}
              onChange={e => setFilterAge(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-(--teal)"
            >
              <option value="alla">Alla åldrar</option>
              <option value="under10">Under 10 år</option>
              <option value="10-13">10–13 år</option>
              <option value="over13">Över 13 år</option>
            </select>
          </div>
        </div>

        {/* Resultat */}
        {loading ? (
          <p className="text-center text-(--teal) font-bold">Laddar…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-gray-500">
              {entries.length === 0
                ? 'Inga barn i uppdragsbanken just nu.'
                : 'Inga träffar med valda filter.'}
            </p>
          </Card>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-500">{filtered.length} barn visas</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(entry => (
                <Card key={entry.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl font-bold text-(--teal)">{entry.age} år</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {(entry.diagnoses ?? []).map(d => (
                          <span key={d} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs font-medium text-(--teal)">
                            {DIAGNOSIS_LABELS[d] ?? d}
                          </span>
                        ))}
                        {(entry.diagnoses ?? []).length === 0 && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Ej angiven
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entry.subjects.map(s => (
                        <span
                          key={s}
                          className="rounded-full border border-(--teal) px-2 py-0.5 text-xs font-medium text-(--teal)"
                        >
                          {SUBJECT_LABELS[s] ?? s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      I kön sedan {new Date(entry.created_at).toLocaleDateString('sv-SE', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 rounded-xl bg-(--teal-light) p-4">
          <p className="text-sm text-(--teal)">
            <strong>Obs:</strong> Barnens personuppgifter är dolda av integritetsskäl. Du får kontaktuppgifter via e-post när en match godkänns av Edly.
          </p>
        </div>
      </main>
    </div>
  )
}
