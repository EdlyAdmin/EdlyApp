'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/ui/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Subject } from '@/lib/supabase/types'
import { Turnstile } from '@/components/ui/Turnstile'

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

export default function FamiljRegistrera() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const [memberConsent, setMemberConsent] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    childName: '',
    childBirthdate: '',
    subjects: [] as Subject[],
    diagnoses: [] as string[],
    diagnosisOther: '',
    extraInfo: '',
  })

  function toggleSubject(subject: Subject) {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(subject)
        ? f.subjects.filter(s => s !== subject)
        : [...f.subjects, subject],
    }))
  }

  function toggleDiagnosis(value: string) {
    setForm(f => ({
      ...f,
      diagnoses: f.diagnoses.includes(value)
        ? f.diagnoses.filter(d => d !== value)
        : [...f.diagnoses, value],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!memberConsent) { setError('Du behöver godkänna medlemskapet för ditt barn.'); return }
    if (!consent) { setError('Du behöver godkänna dataskyddspolicyn.'); return }
    if (!turnstileToken) { setError('Vänligen bekräfta att du inte är en robot.'); return }
    if (form.subjects.length === 0) { setError('Välj minst ett ämne.'); return }
    if (form.diagnoses.includes('annat') && !form.diagnosisOther.trim()) {
      setError('Beskriv gärna vad du menar med "Annat".'); return
    }

    setLoading(true)

    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { role: 'family' } },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Något gick fel. Försök igen.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/register-child', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id,
        parentName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email,
        childName: form.childName,
        childBirthdate: form.childBirthdate,
        subjects: form.subjects,
        diagnoses: form.diagnoses,
        diagnosisOther: form.diagnosisOther,
        extraInfo: form.extraInfo,
        turnstileToken,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Något gick fel vid registreringen. Kontakta Edly.')
      setLoading(false)
      return
    }

    router.push('/hem')
  }

  return (
    <AuthLayout title="Anmäl ditt barn" subtitle="Skapa ett konto för din familj">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="rounded-lg bg-(--teal-light) px-4 py-3">
          <p className="text-sm font-semibold text-(--teal)">Dina uppgifter</p>
        </div>

        <Input label="Förnamn" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
        <Input label="Efternamn" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
        <Input label="E-postadress" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        <Input label="Välj lösenord" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />

        <div className="rounded-lg bg-(--teal-light) px-4 py-3">
          <p className="text-sm font-semibold text-(--teal)">Barnets uppgifter</p>
        </div>

        <Input label="Barnets namn" value={form.childName} onChange={e => setForm(f => ({ ...f, childName: e.target.value }))} required />
        <Input label="Barnets födelsedatum" type="date" value={form.childBirthdate} onChange={e => setForm(f => ({ ...f, childBirthdate: e.target.value }))} required />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-(--text-dark)">
            Vilket ämne behöver ditt barn hjälp med? <span className="text-(--accent-org)">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSubject(s.value)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
                  form.subjects.includes(s.value)
                    ? 'border-(--teal) bg-(--teal) text-white'
                    : 'border-(--beige-dark) bg-white text-(--text-dark)'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-(--text-dark)">
            Diagnos eller svårigheter <span className="text-xs font-normal text-(--text-mid)">(välj alla som stämmer)</span>
          </legend>
          <div className="flex flex-col gap-2">
            {DIAGNOSES.map(d => (
              <label key={d.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  value={d.value}
                  checked={form.diagnoses.includes(d.value)}
                  onChange={() => toggleDiagnosis(d.value)}
                  className="h-4 w-4 accent-(--teal)"
                />
                <span className="text-sm text-(--text-dark)">{d.label}</span>
              </label>
            ))}
          </div>

          {form.diagnoses.includes('annat') && (
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium text-(--text-dark)">
                Beskriv vad du menar med "Annat" <span className="text-(--accent-org)">*</span>
              </label>
              <textarea
                value={form.diagnosisOther}
                onChange={e => setForm(f => ({ ...f, diagnosisOther: e.target.value }))}
                rows={2}
                placeholder="Beskriv svårigheter eller diagnos här…"
                className="w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-sm text-(--text-dark) focus:outline-none focus:ring-2 focus:ring-(--teal)"
              />
            </div>
          )}
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-semibold text-(--text-dark)">
            Övrig information
          </label>
          <p className="mb-2 text-xs text-(--text-mid)">
            Finns det annat som kan vara bra för läraren att veta? T.ex. tidigare insatser, skolsituation, personlighet eller önskemål.
          </p>
          <textarea
            value={form.extraInfo}
            onChange={e => setForm(f => ({ ...f, extraInfo: e.target.value }))}
            rows={3}
            placeholder="Frivilligt…"
            className="w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-sm text-(--text-dark) focus:outline-none focus:ring-2 focus:ring-(--teal)"
          />
        </div>

        <div className="rounded-lg border border-(--beige-dark) bg-(--beige) p-4 space-y-1">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={memberConsent}
              onChange={e => setMemberConsent(e.target.checked)}
              className="mt-1 h-4 w-4 accent-(--teal)"
            />
            <span className="text-sm font-semibold text-(--text-dark)">
              Jag godkänner att {form.childName.trim() || 'mitt barn'} blir medlem i Edlys ideella förening
            </span>
          </label>
          <p className="pl-7 text-xs text-(--text-mid)">
            Att bli medlem är gratis och binder inte dig till något — det är endast för att Edly ska kunna söka ekonomiskt stöd.
          </p>
        </div>

        <div className="rounded-lg border border-(--beige-dark) bg-(--beige) p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 accent-(--teal)"
            />
            <span className="text-sm text-(--text-mid)">
              <strong>Jag godkänner att</strong> Edly lagrar uppgifterna ovan enligt{' '}
              <a href="/integritetspolicy" className="text-(--teal) underline" target="_blank">
                dataskyddspolicyn
              </a>
              .
            </span>
          </label>
        </div>

        <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

        {error && (
          <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-(--accent-org)" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Skapa konto och anmäl barn
        </Button>
      </form>

      <div className="mt-6 border-t border-(--beige-dark) pt-6 text-center">
        <p className="text-sm text-(--text-mid)">
          Har du redan ett konto?{' '}
          <a href="/familj/logga-in" className="font-semibold text-(--teal) hover:underline">
            Logga in
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}
