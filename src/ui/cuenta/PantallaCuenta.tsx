'use client'

import Link from 'next/link'
import { EstadoCuenta } from './EstadoCuenta'

export function PantallaCuenta() {
  return (
    <div className="page-account">
      <div className="page-module-head account-page-head">
        <div><span className="page-kicker">Cuenta</span><h1 className="page-title">Tu suscripción</h1><p className="page-description">Consultá tu plan, vencimiento y estado de acceso.</p></div>
        <Link className="account-back-link" href="/vender">Volver a vender</Link>
      </div>
      <EstadoCuenta />
      <div className="account-page-note"><IconoCuentaMini /><div><strong>¿Necesitás renovar?</strong><p>Escribinos por WhatsApp y el administrador actualizará tu cuenta manualmente.</p></div></div>
    </div>
  )
}

function IconoCuentaMini() {
  return <span className="account-page-note-icon" aria-hidden="true">✓</span>
}
