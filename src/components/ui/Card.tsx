import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: string
}

export function Card({ header, children, className = '', ...props }: CardProps) {
  return (
    <div className={`rounded-xl bg-white shadow-sm ${className}`} {...props}>
      {header && (
        <div className="rounded-t-xl bg-(--teal-light) px-5 py-3">
          <h3 className="font-bold text-(--teal)">{header}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
