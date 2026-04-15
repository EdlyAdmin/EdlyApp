'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthLayout } from '@/components/ui/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function NyttLösenord() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Lösenorden stämmer inte överens.')
      return
    }
    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Något gick fel. Länken kanske har gått ut — begär en ny.')
      setLoading(false)
      return
    }

    router.push('/familj/logga-in')
  }

  return (
    <AuthLayout title="Välj nytt lösenord">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Nytt lösenord"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <Input
          label="Bekräfta lösenord"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />

        {error && (
          <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-(--accent-org)" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Spara nytt lösenord
        </Button>
      </form>
    </AuthLayout>
  )
}
