'use client'

import { useEffect, useRef } from 'react'

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: object) => string
      reset: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

export function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey || !containerRef.current) return

    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        theme: 'light',
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      window.onTurnstileLoad = renderWidget
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
      script.async = true
      document.head.appendChild(script)
    }

    return () => {
      widgetIdRef.current = null
    }
  }, [])

  return <div ref={containerRef} />
}
