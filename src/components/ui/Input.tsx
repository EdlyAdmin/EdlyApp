import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold text-(--text-dark)">
        {label}
        {props.required && <span className="ml-1 text-(--accent-org)" aria-hidden>*</span>}
      </label>
      <input
        id={inputId}
        className={`rounded-lg border border-(--beige-dark) bg-white px-4 py-3 text-base text-(--text-dark) placeholder:text-(--text-mid) focus:border-(--teal) focus:outline-none focus:ring-2 focus:ring-(--teal-light) min-h-[44px] ${error ? 'border-(--accent-org)' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-(--accent-org)" role="alert">{error}</p>}
    </div>
  )
}
