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
      <section className="account-legal" aria-labelledby="account-legal-title">
        <h2 id="account-legal-title">Legales</h2>
        <p>Las reglas del servicio y cómo cuidamos tus datos y los de tus clientes.</p>
        <ul>
          <li><Link href="/terminos">Términos y condiciones</Link></li>
          <li><Link href="/privacidad">Política de privacidad</Link></li>
        </ul>
      </section>
    </div>
  )
}

function IconoCuentaMini() {
  return <span className="account-page-note-icon" aria-hidden="true">✓</span>
}
