'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'

export default function LarareInstallningarPage() {
  const [notifyNewChildren, setNotifyNewChildren] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [teacherId, setTeacherId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: teacher } = await supabase
        .from('teachers')
        .select('id, notify_new_children')
        .eq('profile_id', user.id)
        .single()

      if (teacher) {
        setTeacherId(teacher.id)
        setNotifyNewChildren(teacher.notify_new_children)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!teacherId) return
    setSaving(true)
    await supabase
      .from('teachers')
      .update({ notify_new_children: notifyNewChildren })
      .eq('id', teacherId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
          <h1 className="text-lg font-bold text-(--teal) sm:text-xl">Notifierings&shy;inställningar</h1>
          <HeaderMenu items={[
            { label: '← Tillbaka', onClick: () => window.location.href = '/larare/uppdragsbank' },
          ]} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Card header="E-postnotiser">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-4">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={notifyNewChildren}
                  onChange={e => setNotifyNewChildren(e.target.checked)}
                />
                <div
                  onClick={() => setNotifyNewChildren(v => !v)}
                  className={`h-6 w-11 rounded-full transition-colors ${
                    notifyNewChildren ? 'bg-(--teal)' : 'bg-gray-300'
                  } cursor-pointer`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifyNewChildren ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <div>
                <p className="font-bold text-gray-900">Nytt barn i uppdragsbanken</p>
                <p className="text-sm text-gray-500">
                  Få ett mail när ett nytt barn registreras inom ditt ämnesområde.
                </p>
              </div>
            </label>

            <div className="border-t border-gray-100 pt-4">
              <Button
                variant="primary"
                loading={saving}
                onClick={handleSave}
              >
                {saved ? 'Sparat!' : 'Spara inställningar'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="mt-6 rounded-xl bg-(--teal-light) p-4">
          <p className="text-sm text-(--teal)">
            Du prenumererar bara på ämnen som matchar din kompetens. Edly skickar aldrig personuppgifter i notis-mailen.
          </p>
        </div>
      </main>
    </div>
  )
}
