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

export default function LärareRegistrera() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    subjectsCan: [] as Subject[],
    subjectsBlocked: [] as Subject[],
    maxGroups: '2',
    motivation: '',
  })

  function toggleCan(subject: Subject) {
    setForm(f => ({
      ...f,
      subjectsCan: f.subjectsCan.includes(subject)
        ? f.subjectsCan.filter(s => s !== subject)
        : [...f.subjectsCan, subject],
      // Ta bort från blocked om man väljer den som kan
      subjectsBlocked: f.subjectsBlocked.filter(s => s !== subject),
    }))
  }

  function toggleBlocked(subject: Subject) {
    setForm(f => ({
      ...f,
      subjectsBlocked: f.subjectsBlocked.includes(subject)
        ? f.subjectsBlocked.filter(s => s !== subject)
        : [...f.subjectsBlocked, subject],
      subjectsCan: f.subjectsCan.filter(s => s !== subject),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.subjectsCan.length === 0) {
      setError('Välj minst ett ämne du kan undervisa i.')
      return
    }
    if (!turnstileToken) {
      setError('Vänligen bekräfta att du inte är en robot.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { role: 'teacher' } },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Något gick fel. Försök igen.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/register-teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id,
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email,
        phone: form.phone,
        subjectsCan: form.subjectsCan,
        subjectsBlocked: form.subjectsBlocked,
        maxGroups: parseInt(form.maxGroups),
        motivation: form.motivation,
        turnstileToken,
      }),
    })

    if (!res.ok) {
      setError('Något gick fel vid registreringen. Kontakta Edly.')
      setLoading(false)
      return
    }

    router.push('/vantar')
  }

  return (
    <AuthLayout title="Bli lärare hos Edly" subtitle="Din ansökan granskas av Edly innan du aktiveras">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input label="Förnamn" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
        <Input label="Efternamn" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
        <Input label="E-postadress" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        <Input label="Telefonnummer" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07X XXX XX XX" required />
        <Input label="Välj lösenord" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-(--text-dark)">
            Vilka ämnen kan du undervisa i? <span className="text-(--accent-org)">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button key={s.value} type="button" onClick={() => toggleCan(s.value)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
                  form.subjectsCan.includes(s.value)
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
            Finns det något ämne du <em>inte</em> vill undervisa i?
          </legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button key={s.value} type="button" onClick={() => toggleBlocked(s.value)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
                  form.subjectsBlocked.includes(s.value)
                    ? 'border-(--accent-org) bg-(--accent-org) text-white'
                    : 'border-(--beige-dark) bg-white text-(--text-dark)'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="mb-2 block text-sm font-semibold text-(--text-dark)">
            Hur många grupper kan du ta? (max 3 barn per grupp)
          </label>
          <select
            value={form.maxGroups}
            onChange={e => setForm(f => ({ ...f, maxGroups: e.target.value }))}
            className="w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-base text-(--text-dark) min-h-[44px]"
          >
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'grupp' : 'grupper'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-(--text-dark)">
            Varför vill du undervisa hos Edly? <span className="text-(--accent-org)">*</span>
          </label>
          <p className="mb-2 text-xs text-(--text-mid)">
            Berätta om din bakgrund, erfarenhet av barn med inlärningssvårigheter och vad som driver dig.
          </p>
          <textarea
            value={form.motivation}
            onChange={e => setForm(f => ({ ...f, motivation: e.target.value }))}
            rows={4}
            required
            placeholder="Berätta om dig själv och varför du vill hjälpa barn hos Edly…"
            className="w-full rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-sm text-(--text-dark) focus:outline-none focus:ring-2 focus:ring-(--teal)"
          />
        </div>

        <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

        {error && (
          <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-(--accent-org)" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Skicka ansökan
        </Button>
      </form>

      <div className="mt-6 border-t border-(--beige-dark) pt-6 text-center">
        <p className="text-sm text-(--text-mid)">
          Har du redan ett konto?{' '}
          <a href="/larare/logga-in" className="font-semibold text-(--teal) hover:underline">
            Logga in
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}
