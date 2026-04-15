'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/ui/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function FamiljLoggaIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Fel e-post eller lösenord. Försök igen.')
      setLoading(false)
      return
    }

    router.push('/hem')
    router.refresh()
  }

  return (
    <AuthLayout title="Logga in" subtitle="Välkommen tillbaka till Edly">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="E-postadress"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          label="Lösenord"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-(--accent-org)" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Logga in
        </Button>

        <a href="/familj/glomt-losenord" className="text-center text-sm text-(--teal) hover:underline">
          Glömt lösenordet?
        </a>
      </form>

      <div className="mt-6 border-t border-(--beige-dark) pt-6 text-center">
        <p className="text-sm text-(--text-mid)">
          Inget konto?{' '}
          <a href="/familj/registrera" className="font-semibold text-(--teal) hover:underline">
            Anmäl ditt barn här
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}
