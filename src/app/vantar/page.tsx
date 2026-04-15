import { AuthLayout } from '@/components/ui/AuthLayout'

export default function Väntar() {
  return (
    <AuthLayout title="Din ansökan granskas">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--teal-light) text-3xl">
          ⏳
        </div>
        <p className="text-(--text-mid)">
          Tack för att du registrerade dig! Edly granskar din ansökan och du får ett mejl när den är godkänd.
        </p>
        <p className="text-sm text-(--text-mid)">
          Har du frågor? Kontakta oss på{' '}
          <a href="mailto:info@edly.se" className="text-(--teal) underline">
            info@edly.se
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}
