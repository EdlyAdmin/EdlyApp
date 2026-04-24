'use client'

import { useState, useRef, useEffect } from 'react'

export interface HeaderMenuItem {
  label: string
  onClick: () => void
  variant?: 'primary' | 'danger'
  loading?: boolean
}

export function HeaderMenu({ items }: { items: HeaderMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      {/* Desktop: knappar i rad */}
      <div className="hidden sm:flex flex-wrap justify-end gap-2">
        {items.map(item => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.loading}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] transition-colors disabled:opacity-60 ${
              item.variant === 'primary'
                ? 'bg-(--teal) text-white hover:bg-(--teal-dark)'
                : item.variant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.loading && (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {item.label}
          </button>
        ))}
      </div>

      {/* Mobil: hamburgermeny */}
      <div className="relative sm:hidden" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Meny"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {open ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
            {items.map(item => (
              <button
                key={item.label}
                disabled={item.loading}
                onClick={() => { item.onClick(); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                  item.variant === 'primary'
                    ? 'bg-(--teal-light) text-(--teal) hover:bg-(--teal) hover:text-white'
                    : item.variant === 'danger'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.loading && (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
