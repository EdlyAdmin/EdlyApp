import { AuthLayout } from '@/components/ui/AuthLayout'

export default function Nekad() {
  return (
    <AuthLayout title="Ansökan nekad">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-3xl">
          📭
        </div>
        <p className="text-(--text-mid)">
          Tyvärr gick det inte att godkänna din ansökan den här gången. Du borde ha fått mer information via mejl.
        </p>
        <p className="text-sm text-(--text-mid)">
          Frågor? Hör av dig till{' '}
          <a href="mailto:johan@edly.se" className="text-(--teal) underline">
            johan@edly.se
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}
