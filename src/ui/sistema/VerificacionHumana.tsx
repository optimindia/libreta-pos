'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Cloudflare Turnstile, opcional. Sólo aparece si al compilar existe
// NEXT_PUBLIC_TURNSTILE_SITE_KEY; sin esa variable no carga nada y el ingreso
// queda exactamente como antes. El token lo valida la función `ingresar` con
// TURNSTILE_SECRET_KEY (o Supabase Auth, si se activa su captcha).

const SCRIPT_ID = 'cf-turnstile'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Turnstile {
  render(elemento: HTMLElement, opciones: Record<string, unknown>): string
  reset(id?: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

/** La clave pública del widget, o null si no se configuró. Se lee con la
 *  referencia literal para que Next la incruste al compilar. */
export function claveTurnstile(): string | null {
  const clave = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  return clave && clave.trim() ? clave.trim() : null
}

function cargarScript(): Promise<Turnstile> {
  return new Promise((resolver, rechazar) => {
    if (window.turnstile) return resolver(window.turnstile)
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_URL
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => (window.turnstile ? resolver(window.turnstile) : rechazar(new Error('turnstile'))))
    script.addEventListener('error', () => rechazar(new Error('turnstile')))
  })
}

export interface ControlVerificacion {
  /** Los tokens sirven una sola vez: después de cada intento hay que pedir otro. */
  reiniciar(): void
}

export const VerificacionHumana = forwardRef<ControlVerificacion, {
  clave: string
  onToken: (token: string | null) => void
}>(function VerificacionHumana({ clave, onToken }, ref) {
  const contenedor = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const avisar = useRef(onToken)

  useEffect(() => {
    avisar.current = onToken
  }, [onToken])

  useImperativeHandle(ref, () => ({
    reiniciar() {
      avisar.current(null)
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
    },
  }), [])

  useEffect(() => {
    let cancelado = false
    cargarScript()
      .then((turnstile) => {
        if (cancelado || !contenedor.current) return
        widget.current = turnstile.render(contenedor.current, {
          sitekey: clave,
          language: 'es',
          callback: (token: string) => avisar.current(token),
          'expired-callback': () => avisar.current(null),
          'error-callback': () => avisar.current(null),
        })
      })
      .catch(() => avisar.current(null))
    return () => {
      cancelado = true
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [clave])

  return <div ref={contenedor} data-testid="verificacion-humana" className="min-h-[65px]" />
})
