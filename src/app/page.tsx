import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--beige) px-6">
      <div className="w-full max-w-sm text-center">

        {/* Logo / rubrik */}
        <h1 className="text-5xl font-bold tracking-tight text-(--teal)">Edly</h1>
        <p className="mt-3 text-(--text-mid)">
          Vi matchar barn med rätt lärare — enkelt och tryggt.
        </p>

        {/* Rollval */}
        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/familj/logga-in"
            className="flex min-h-[56px] items-center justify-center rounded-xl bg-(--teal) px-6 text-base font-bold text-white transition-colors hover:bg-(--teal-mid)"
          >
            Jag är förälder
          </Link>
          <Link
            href="/larare/logga-in"
            className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-(--teal) px-6 text-base font-bold text-(--teal) transition-colors hover:bg-(--teal-light)"
          >
            Jag är lärare
          </Link>
        </div>

        {/* Registreringslänkar */}
        <div className="mt-6 grid grid-cols-1 gap-3 text-left min-[380px]:grid-cols-2">
          <Link
            href="/familj/registrera"
            className="rounded-xl border border-(--beige-dark) bg-white px-4 py-3 transition-colors hover:border-(--teal) hover:bg-(--teal-light)"
          >
            <p className="text-sm font-bold text-(--teal)">Ny som förälder?</p>
            <p className="mt-0.5 text-xs text-(--text-mid)">Registrera ditt barn och kom igång</p>
          </Link>
          <Link
            href="/larare/registrera"
            className="rounded-xl border border-(--beige-dark) bg-white px-4 py-3 transition-colors hover:border-(--teal) hover:bg-(--teal-light)"
          >
            <p className="text-sm font-bold text-(--teal)">Bli lärare</p>
            <p className="mt-0.5 text-xs text-(--text-mid)">Ansök och hjälp barn att lyckas</p>
          </Link>
        </div>

        <div className="mt-8">
          <Link href="/integritetspolicy" className="text-xs text-(--text-mid) hover:text-(--teal) hover:underline">
            Dataskyddspolicy
          </Link>
        </div>

        {/* Admin — dold länk */}
        <div className="mt-4">
          <Link href="/admin/logga-in" className="text-xs text-(--beige-dark) hover:text-(--text-mid)">
            ●
          </Link>
        </div>

      </div>
    </div>
  )
}
