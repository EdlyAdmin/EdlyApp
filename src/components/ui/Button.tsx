import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-bold min-h-[44px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--teal) focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:   'bg-(--teal) text-white hover:bg-(--teal-mid)',
    secondary: 'border-2 border-(--teal) text-(--teal) bg-white hover:bg-(--teal-light)',
    danger:    'bg-(--accent-org) text-white hover:opacity-90',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Laddar…
        </span>
      ) : children}
    </button>
  )
}
