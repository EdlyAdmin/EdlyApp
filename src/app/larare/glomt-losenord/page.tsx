'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/ui/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function GlömtLösenordLärare() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nytt-losenord`,
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <AuthLayout title="Glömt lösenordet?" subtitle="Vi skickar en länk till din e-post">
      {sent ? (
        <div className="rounded-lg bg-(--teal-light) px-5 py-4 text-center">
          <p className="font-semibold text-(--teal)">Kolla din e-post!</p>
          <p className="mt-1 text-sm text-(--text-mid)">
            Om {email} finns registrerat har vi skickat en återställningslänk.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input label="E-postadress" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">Skicka länk</Button>
        </form>
      )}
      <div className="mt-6 text-center">
        <a href="/larare/logga-in" className="text-sm text-(--teal) hover:underline">← Tillbaka till inloggning</a>
      </div>
    </AuthLayout>
  )
}
