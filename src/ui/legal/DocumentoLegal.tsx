import type { ReactNode } from 'react'
import Link from 'next/link'

/** Fecha desde la que rigen los términos y la política de privacidad. */
export const VIGENCIA_LEGAL = '28 de octubre de 2026'

/** Datos del prestador. Los corchetes son marcadores a completar por el
 *  dueño del servicio antes de publicar: se buscan fácil con "[". */
export const PRESTADOR = {
  razonSocial: '[RAZÓN SOCIAL]',
  cuit: '[CUIT]',
  domicilio: '[DOMICILIO]',
  email: '[EMAIL DE CONTACTO]',
  whatsapp: '[WHATSAPP DE CONTACTO]',
  jurisdiccion: '[CIUDAD DE LOS TRIBUNALES]',
} as const

export function DocumentoLegal({ titulo, bajada, otro, children }: {
  titulo: string
  bajada: string
  otro: { href: '/terminos' | '/privacidad'; texto: string }
  children: ReactNode
}) {
  return (
    <div className="legal-page">
      <header className="legal-top">
        <Link href="/" className="legal-brand" aria-label="Ir a Libreta">
          <span className="access-brand-mark" aria-hidden="true">L</span>
          <strong>Libreta</strong>
        </Link>
        <Link href="/" className="legal-back">Volver a Libreta</Link>
      </header>
      <article className="legal-doc">
        <span className="page-kicker">Legales</span>
        <h1>{titulo}</h1>
        <p className="legal-vigencia">Vigente desde el {VIGENCIA_LEGAL}</p>
        <p className="legal-bajada">{bajada}</p>
        {children}
        <footer className="legal-pie">
          <p>¿Dudas? Escribinos a {PRESTADOR.email}.</p>
          <Link href={otro.href}>{otro.texto}</Link>
        </footer>
      </article>
    </div>
  )
}

export function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className="legal-seccion" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  )
}
