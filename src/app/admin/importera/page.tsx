'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface Summary {
  teachersCreated: number
  childrenCreated: number
  groupsCreated: number
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ summary: Summary; errors: string[] } | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResult(null)
    setFatalError(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/admin/import', { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      setFatalError(body.error ?? 'Något gick fel.')
    } else {
      setResult({ summary: body.summary, errors: body.errors ?? [] })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-(--beige)">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-(--teal)">Edly — Importera data</h1>
            <p className="text-sm text-(--teal-mid)">Importera lärare, barn och grupper från Excel</p>
          </div>
          <Button variant="secondary" className="text-xs px-3 py-2 min-h-[36px]" onClick={() => router.push('/admin')}>
            ← Tillbaka
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">

        {/* Ladda ner mall */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">1. Fyll i importmallen</h2>
          <p className="text-sm text-gray-500 mb-4">
            Excelfilen ska ha tre flikar: <strong>Barn</strong>, <strong>Lärare</strong> och <strong>Grupper</strong>.
            Se fliken Instruktioner i mallen för giltiga värden.
          </p>
          <a
            href="/api/admin/export-template"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Ladda ner tom mall
          </a>
        </div>

        {/* Ladda upp */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">2. Ladda upp ifylld fil</h2>
          <p className="text-sm text-gray-500 mb-4">
            Befintliga lärare och barn (matchas på e-post) hoppas över — inga dubbletter skapas.
            Inga e-postmeddelanden skickas vid import.
          </p>

          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 cursor-pointer hover:border-(--teal) transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <p className="text-sm text-gray-500">
              {file ? (
                <span className="font-medium text-gray-900">{file.name}</span>
              ) : (
                <>Klicka för att välja Excel-fil (.xlsx)</>
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setFatalError(null) }}
            />
          </div>

          {file && (
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={loading}
              onClick={handleImport}
            >
              Importera
            </Button>
          )}
        </div>

        {/* Fel */}
        {fatalError && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{fatalError}</div>
        )}

        {/* Resultat */}
        {result && (
          <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Importresultat</h2>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Lärare skapade', value: result.summary.teachersCreated },
                { label: 'Barn skapade', value: result.summary.childrenCreated },
                { label: 'Grupper skapade', value: result.summary.groupsCreated },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg bg-(--teal-light) p-4 text-center">
                  <p className="text-2xl font-bold text-(--teal)">{stat.value}</p>
                  <p className="text-xs text-(--teal-mid) mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-orange-700 mb-2">{result.errors.length} varning{result.errors.length !== 1 ? 'ar' : ''}:</p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-green-700 font-medium">✓ Inga fel — importen gick igenom utan problem.</p>
            )}

            <Button variant="secondary" className="w-full text-sm" onClick={() => router.push('/admin')}>
              Gå till adminpanelen
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
