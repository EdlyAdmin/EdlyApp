'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface ChildSummary { teachersCreated: number; childrenCreated: number; groupsCreated: number }
interface TeacherSummary { created: number; skipped: number }
interface GroupSummary { groupsCreated: number }

function DropZone({ file, onChange, accept = '.xlsx' }: { file: File | null; onChange: (f: File) => void; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 cursor-pointer hover:border-(--teal) transition-colors"
      onClick={() => ref.current?.click()}
    >
      <p className="text-sm text-gray-500">
        {file ? <span className="font-medium text-gray-900">{file.name}</span> : <>Klicka för att välja Excel-fil (.xlsx)</>}
      </p>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f) }} />
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return <p className="text-sm text-green-700 font-medium">✓ Inga fel.</p>
  return (
    <div>
      <p className="text-sm font-semibold text-orange-700 mb-2">{errors.length} varning{errors.length !== 1 ? 'ar' : ''}:</p>
      <ul className="space-y-1">
        {errors.map((e, i) => <li key={i} className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">{e}</li>)}
      </ul>
    </div>
  )
}

export default function ImportPage() {
  const router = useRouter()

  // Barn-import
  const [barnFile, setBarnFile] = useState<File | null>(null)
  const [barnLoading, setBarnLoading] = useState(false)
  const [barnResult, setBarnResult] = useState<{ summary: ChildSummary; errors: string[] } | null>(null)
  const [barnError, setBarnError] = useState<string | null>(null)

  // Lärare-import
  const [lararFile, setLararFile] = useState<File | null>(null)
  const [lararLoading, setLararLoading] = useState(false)
  const [lararResult, setLararResult] = useState<{ summary: TeacherSummary; errors: string[] } | null>(null)
  const [lararError, setLararError] = useState<string | null>(null)

  // Grupp-import
  const [gruppFile, setGruppFile] = useState<File | null>(null)
  const [gruppLoading, setGruppLoading] = useState(false)
  const [gruppResult, setGruppResult] = useState<{ summary: GroupSummary; errors: string[] } | null>(null)
  const [gruppError, setGruppError] = useState<string | null>(null)

  async function handleBarnImport() {
    if (!barnFile) return
    setBarnLoading(true); setBarnResult(null); setBarnError(null)
    const form = new FormData()
    form.append('file', barnFile)
    const res = await fetch('/api/admin/import', { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setBarnError(body.error ?? 'Något gick fel.')
    else setBarnResult({ summary: body.summary, errors: body.errors ?? [] })
    setBarnLoading(false)
  }

  async function handleLararImport() {
    if (!lararFile) return
    setLararLoading(true); setLararResult(null); setLararError(null)
    const form = new FormData()
    form.append('file', lararFile)
    const res = await fetch('/api/admin/import-teachers', { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setLararError(body.error ?? 'Något gick fel.')
    else setLararResult({ summary: { created: body.created, skipped: body.skipped }, errors: body.errors ?? [] })
    setLararLoading(false)
  }

  async function handleGruppImport() {
    if (!gruppFile) return
    setGruppLoading(true); setGruppResult(null); setGruppError(null)
    const form = new FormData()
    form.append('file', gruppFile)
    const res = await fetch('/api/admin/import-groups', { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setGruppError(body.error ?? 'Något gick fel.')
    else setGruppResult({ summary: { groupsCreated: body.groupsCreated }, errors: body.errors ?? [] })
    setGruppLoading(false)
  }

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Edly — Importera data</h1>
            <p className="text-sm text-(--teal-mid)">Importera lärare och barn från Excel</p>
          </div>
          <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => router.push('/admin')}>
            ← Tillbaka
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-8">

        {/* Importera lärare */}
        <section className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Importera lärare</h2>
            <p className="text-sm text-gray-500 mt-1">
              Läser kolumnerna: Namn, Telefon, E-post, Ämne. Befintliga lärare (samma e-post) hoppas över.
            </p>
          </div>
          <DropZone file={lararFile} onChange={f => { setLararFile(f); setLararResult(null); setLararError(null) }} />
          {lararFile && <Button variant="primary" className="w-full" loading={lararLoading} onClick={handleLararImport}>Importera lärare</Button>}
          {lararError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{lararError}</div>}
          {lararResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Lärare skapade', value: lararResult.summary.created },
                  { label: 'Redan inlagda', value: lararResult.summary.skipped },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-(--teal-light) p-4 text-center">
                    <p className="text-2xl font-bold text-(--teal)">{s.value}</p>
                    <p className="text-xs text-(--teal-mid) mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <ErrorList errors={lararResult.errors} />
            </div>
          )}
        </section>

        {/* Importera barn */}
        <section className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Importera barn</h2>
            <p className="text-sm text-gray-500 mt-1">
              Kolumner: Barnets namn, Födelsedatum, Ämne, Övrig info, Hur länge, Förälderns namn, Förälderns e-post.
              Inga e-postmeddelanden skickas.
            </p>
          </div>
          <DropZone file={barnFile} onChange={f => { setBarnFile(f); setBarnResult(null); setBarnError(null) }} />
          {barnFile && <Button variant="primary" className="w-full" loading={barnLoading} onClick={handleBarnImport}>Importera barn</Button>}
          {barnError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{barnError}</div>}
          {barnResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Barn skapade', value: barnResult.summary.childrenCreated },
                  { label: 'Grupper skapade', value: barnResult.summary.groupsCreated },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-(--teal-light) p-4 text-center">
                    <p className="text-2xl font-bold text-(--teal)">{s.value}</p>
                    <p className="text-xs text-(--teal-mid) mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <ErrorList errors={barnResult.errors} />
            </div>
          )}
        </section>

        {/* Importera grupper */}
        <section className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Importera grupper</h2>
            <p className="text-sm text-gray-500 mt-1">
              Kolumner: Lärare, Barnet, Förälder (e-post), Diagnos, Ämne, Ålder.
              Läraren förs vidare när cellen är tom. Barn och lärare måste redan finnas i systemet.
            </p>
          </div>
          <DropZone file={gruppFile} onChange={f => { setGruppFile(f); setGruppResult(null); setGruppError(null) }} />
          {gruppFile && <Button variant="primary" className="w-full" loading={gruppLoading} onClick={handleGruppImport}>Importera grupper</Button>}
          {gruppError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{gruppError}</div>}
          {gruppResult && (
            <div className="space-y-3">
              <div className="rounded-lg bg-(--teal-light) p-4 text-center">
                <p className="text-2xl font-bold text-(--teal)">{gruppResult.summary.groupsCreated}</p>
                <p className="text-xs text-(--teal-mid) mt-1">Grupper skapade</p>
              </div>
              <ErrorList errors={gruppResult.errors} />
            </div>
          )}
        </section>

        <div className="text-center">
          <Button variant="secondary" className="text-sm" onClick={() => router.push('/admin')}>
            Gå till adminpanelen
          </Button>
        </div>

      </main>
    </div>
  )
}
