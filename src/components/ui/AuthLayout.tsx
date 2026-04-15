interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a href="/" className="inline-block">
            <span className="text-2xl font-bold text-(--teal)">📖 Edly</span>
          </a>
          <h1 className="mt-4 text-2xl font-bold text-(--teal)">{title}</h1>
          {subtitle && <p className="mt-2 text-(--text-mid)">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  )
}
