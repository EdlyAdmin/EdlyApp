'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Input } from '@/components/ui/Input'
import type { Subject } from '@/lib/supabase/types'

interface ChildInfo {
  id: string
  name: string
  birthdate: string
  subjects: Subject[]
  diagnoses: string[]
  diagnosisOther: string | null
  extraInfo: string | null
  matchStatus: 'queued' | 'proposed' | 'matched'
  teacherName?: string
  teacherEmail?: string
}

function calcAge(birthdate: string) {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

interface FamilyData {
  parentName: string
  children: ChildInfo[]
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

const emptyChildForm = {
  childName: '',
  childBirthdate: '',
  subjects: [] as Subject[],
  diagnoses: [] as string[],
  diagnosisOther: '',
  extraInfo: '',
}

export default function HemPage() {
  const [family, setFamily] = useState<FamilyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [addForm, setAddForm] = useState(emptyChildForm)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: familyData } = await supabase
      .from('families')
      .select('parent_name, id')
      .eq('profile_id', user.id)
      .single()

    if (!familyData) {
      setLoading(false)
      return
    }

    const { data: children } = await supabase
      .from('children')
      .select('id, name, birthdate, subjects, diagnoses, diagnosis_other, extra_info')
      .eq('family_id', familyData.id)

    if (!children?.length) {
      setFamily({ parentName: familyData.parent_name, children: [] })
      setLoading(false)
      return
    }

    const childIds = children.map(c => c.id)

    const { data: groupMembers } = await supabase
      .from('group_members')
      .select('child_id, group_id')
      .in('child_id', childIds)

    const groupIds = (groupMembers ?? []).map(gm => gm.group_id)
    const { data: groups } = groupIds.length
      ? await supabase.from('groups').select('id, teacher_id, status').in('id', groupIds).eq('status', 'active')
      : { data: [] }

    const teacherIds = (groups ?? []).map(g => g.teacher_id)
    const { data: teachers } = teacherIds.length
      ? await supabase.from('teachers').select('id, name, email').in('id', teacherIds)
      : { data: [] }

    const { data: proposals } = await supabase
      .from('match_proposals')
      .select('child_id, status')
      .in('child_id', childIds)
      .in('status', ['pending', 'approved'])

    const enrichedChildren: ChildInfo[] = children.map(child => {
      const gm = (groupMembers ?? []).find(g => g.child_id === child.id)
      const group = gm ? (groups ?? []).find(g => g.id === gm.group_id) : null
      const teacher = group ? (teachers ?? []).find(t => t.id === group.teacher_id) : null

      if (group && teacher) {
        return {
          ...child,
          diagnoses: child.diagnoses ?? [],
          diagnosisOther: child.diagnosis_other ?? null,
          extraInfo: child.extra_info ?? null,
          matchStatus: 'matched' as const,
          teacherName: teacher.name,
          teacherEmail: teacher.email,
        }
      }

      const hasProposal = (proposals ?? []).some(p => p.child_id === child.id)
      return {
        ...child,
        diagnoses: child.diagnoses ?? [],
        diagnosisOther: child.diagnosis_other ?? null,
        extraInfo: child.extra_info ?? null,
        matchStatus: hasProposal ? ('proposed' as const) : ('queued' as const),
      }

    })

    setFamily({ parentName: familyData.parent_name, children: enrichedChildren })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/familj/logga-in'
  }

  function toggleSubject(subject: Subject) {
    setAddForm(f => ({
      ...f,
      subjects: f.subjects.includes(subject)
        ? f.subjects.filter(s => s !== subject)
        : [...f.subjects, subject],
    }))
  }

  function toggleDiagnosis(value: string) {
    setAddForm(f => ({
      ...f,
      diagnoses: f.diagnoses.includes(value)
        ? f.diagnoses.filter(d => d !== value)
        : [...f.diagnoses, value],
    }))
  }

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (addForm.subjects.length === 0) { setAddError('Välj minst ett ämne.'); return }
    if (addForm.diagnoses.includes('annat') && !addForm.diagnosisOther.trim()) {
      setAddError('Beskriv vad du menar med "Annat".'); return
    }

    setAddLoading(true)
    const res = await fetch('/api/add-child', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName: addForm.childName,
        childBirthdate: addForm.childBirthdate,
        subjects: addForm.subjects,
        diagnoses: addForm.diagnoses,
        diagnosisOther: addForm.diagnosisOther,
        extraInfo: addForm.extraInfo,
      }),
    })

    if (!res.ok) {
      setAddError('Något gick fel. Försök igen.')
      setAddLoading(false)
      return
    }

    setAddForm(emptyChildForm)
    setShowAddChild(false)
    setLoading(true)
    await load()
    setAddLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--beige)">
        <p className="font-bold text-(--teal)">Laddar…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-(--teal)">Hej, {family?.parentName}!</h1>
            <p className="text-sm text-(--teal-mid)">Dina barn hos Edly</p>
          </div>
          <HeaderMenu items={[
            { label: 'Logga ut', onClick: handleLogout },
          ]} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {(!family || family.children.length === 0) ? (
          <Card>
            <p className="text-center text-sm text-gray-500">Inga barn registrerade.</p>
          </Card>
        ) : (
          family.children.map(child => (
            <Card key={child.id} header={child.name}>
              <div className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs font-semibold uppercase text-gray-400">Ålder</span>
                    <span className="text-gray-700">{calcAge(child.birthdate)} år</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-24 shrink-0 text-xs font-semibold uppercase text-gray-400">Ämnen</span>
                    <div className="flex flex-wrap gap-1">
                      {child.subjects.map(s => (
                        <span key={s} className="rounded-full bg-(--teal-light) px-2 py-0.5 text-xs font-medium text-(--teal)">
                          {SUBJECT_LABELS[s] ?? s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {(child.diagnoses ?? []).length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="w-24 shrink-0 text-xs font-semibold uppercase text-gray-400">Diagnos</span>
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {(child.diagnoses ?? []).map(d => (
                            <span key={d} className="rounded-full bg-(--beige-dark) px-2 py-0.5 text-xs font-medium text-gray-600">
                              {DIAGNOSIS_LABELS[d] ?? d}
                            </span>
                          ))}
                        </div>
                        {child.diagnosisOther && (
                          <p className="mt-1 text-xs text-gray-500">{child.diagnosisOther}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {child.extraInfo && (
                    <div className="flex items-start gap-2">
                      <span className="w-24 shrink-0 text-xs font-semibold uppercase text-gray-400">Övrigt</span>
                      <p className="text-gray-700">{child.extraInfo}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-3">
                  {child.matchStatus === 'matched' ? (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="mb-1 text-sm font-bold text-green-800">Matchad med lärare</p>
                      <p className="text-sm text-green-700">{child.teacherName}</p>
                      <a href={`mailto:${child.teacherEmail}`} className="text-sm text-green-600 underline">
                        {child.teacherEmail}
                      </a>
                      <p className="mt-2 text-xs text-green-600">
                        Läraren hör av sig för att boka in första träffen.
                      </p>
                    </div>
                  ) : child.matchStatus === 'proposed' ? (
                    <div className="rounded-lg bg-yellow-50 p-3">
                      <p className="text-sm font-bold text-yellow-800">Under granskning</p>
                      <p className="text-sm text-yellow-700">
                        Edly granskar ett lärarförslag för ditt barn. Vi hör av oss via mail när det är klart.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-(--teal-light) p-3">
                      <p className="text-sm font-bold text-(--teal)">I kön</p>
                      <p className="text-sm text-(--teal-mid)">
                        Ditt barn är registrerat och vi söker en lämplig lärare. Vi hör av oss via mail.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}

        {/* Lägg till barn */}
        {!showAddChild ? (
          <button
            onClick={() => setShowAddChild(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--beige-dark) py-4 text-sm font-semibold text-(--teal-mid) transition-colors hover:border-(--teal) hover:text-(--teal)"
          >
            + Lägg till ett barn
          </button>
        ) : (
          <Card header="Lägg till barn">
            <form onSubmit={handleAddChild} className="flex flex-col gap-4">
              <Input label="Barnets namn" value={addForm.childName} onChange={e => setAddForm(f => ({ ...f, childName: e.target.value }))} required />
              <Input label="Barnets födelsedatum" type="date" value={addForm.childBirthdate} onChange={e => setAddForm(f => ({ ...f, childBirthdate: e.target.value }))} required />

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-(--text-dark)">
                  Ämnen <span className="text-(--accent-org)">*</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button key={s.value} type="button" onClick={() => toggleSubject(s.value)}
                      className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
                        addForm.subjects.includes(s.value)
                          ? 'border-(--teal) bg-(--teal) text-white'
                          : 'border-(--beige-dark) bg-white text-(--text-dark)'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-(--text-dark)">
                  Diagnos eller svårigheter
                </legend>
                <div className="flex flex-col gap-2">
                  {DIAGNOSES.map(d => (
                    <label key={d.value} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" value={d.value} checked={addForm.diagnoses.includes(d.value)}
                        onChange={() => toggleDiagnosis(d.value)} className="h-4 w-4 accent-(--teal)" />
                      <span className="text-sm text-(--text-dark)">{d.label}</span>
                    </label>
                  ))}
                </div>
                {addForm.diagnoses.includes('annat') && (
                  <textarea value={addForm.diagnosisOther} onChange={e => setAddForm(f => ({ ...f, diagnosisOther: e.target.value }))}
                    rows={2} placeholder="Beskriv vad du menar med Annat…"
                    className="mt-3 w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-sm text-(--text-dark) focus:outline-none focus:ring-2 focus:ring-(--teal)" />
                )}
              </fieldset>

              <div>
                <label className="mb-1 block text-sm font-semibold text-(--text-dark)">Övrig information</label>
                <textarea value={addForm.extraInfo} onChange={e => setAddForm(f => ({ ...f, extraInfo: e.target.value }))}
                  rows={2} placeholder="Frivilligt…"
                  className="w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-sm text-(--text-dark) focus:outline-none focus:ring-2 focus:ring-(--teal)" />
              </div>

              {addError && (
                <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-(--accent-org)">{addError}</p>
              )}

              <div className="flex gap-3">
                <Button type="submit" loading={addLoading} className="flex-1">Lägg till</Button>
                <Button type="button" variant="secondary" onClick={() => { setShowAddChild(false); setAddForm(emptyChildForm); setAddError('') }} className="flex-1">Avbryt</Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <div className="text-center">
            <p className="mb-1 text-sm font-bold text-gray-700">Frågor?</p>
            <p className="text-sm text-gray-500">
              Kontakta oss på{' '}
              <a href="mailto:johan@edly.se" className="text-(--teal) underline">
                johan@edly.se
              </a>
            </p>
          </div>
        </Card>
      </main>
    </div>
  )
}
