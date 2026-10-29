'use client'

import Link from 'next/link'
import { clasesBoton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { SeguridadPin } from '@/ui/pin/SeguridadPin'
import { EstadoCuenta } from './EstadoCuenta'
import './cuenta.css'

export function PantallaCuenta() {
  return (
    <div className="page-account f-cuenta">
      <header className="f-cuenta-encabezado">
        <div>
          <span className="f-dato">Cuenta</span>
          <h1 className="f-titulo">Tu suscripción</h1>
          <p className="f-texto f-cuenta-subtitulo">Consultá tu plan, vencimiento y estado de acceso.</p>
        </div>
        <Link className={clasesBoton('secundario')} href="/vender">Volver a vender</Link>
      </header>
      <div className="f-cuenta-cuerpo">
        <EstadoCuenta destacar />
        <div className="f-cuenta-lateral">
          <SeguridadPin />
          <Tarjeta className="f-cuenta-nota">
            <IconoCuentaMini />
            <div><strong className="f-renglon-texto">¿Necesitás renovar?</strong><p className="f-texto">Escribinos por WhatsApp y el administrador actualizará tu cuenta manualmente.</p></div>
          </Tarjeta>
          <Tarjeta como="section" className="f-cuenta-legal" aria-labelledby="account-legal-title">
            <h2 id="account-legal-title" className="f-seccion">Legales</h2>
            <p className="f-dato">Las reglas del servicio y cómo cuidamos tus datos y los de tus clientes.</p>
            <ul>
              <li><Link href="/terminos">Términos y condiciones</Link></li>
              <li><Link href="/privacidad">Política de privacidad</Link></li>
            </ul>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}

function IconoCuentaMini() {
  return <span className="f-cuenta-nota-icono" aria-hidden="true">✓</span>
}
