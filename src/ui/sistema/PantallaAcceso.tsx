'use client'

import { useState } from 'react'
import { entrar } from '@/datos/nube/sesion'
import { bajarTodo, sincronizar, subirASupabase, traerDeSupabase } from '@/datos/nube/sincronizar'
import { notificarCambioAcceso } from '@/datos/nube/acceso'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton } from './Boton'
import { IconoNube } from './iconos'

export function PantallaAcceso({ modo = 'negocio' }: { modo?: 'negocio' | 'admin' }) {
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const esAdmin = modo === 'admin'

  async function iniciar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    setTrabajando(true)
    try {
      const resultado = await entrar(telefono, pin)
      if (!resultado.ok) {
        setAviso(resultado.motivo)
        return
      }
      // Primero enviamos lo que este aparato pudo haber cargado antes de
      // vincular la cuenta (caso típico al activar el negocio por WhatsApp).
      // Después hacemos una bajada completa para que un aparato nuevo reciba
      // todo el catálogo, incluido el stock actual.
      try {
        await sincronizar(subirASupabase(resultado.negocioId))
        await bajarTodo(traerDeSupabase)
      } catch {
        // El acceso ya quedó validado; si justo se corta la red, el
        // sincronizador automático lo reintentará sin bloquear la entrada.
      }
      notificarCambioAcceso()
    } catch {
      setAviso('No se pudo validar el acceso. Revisá la señal y probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="access-page">
      <div className="access-card form-shell form-card">
        <div className="access-brand">
          <span className="access-brand-mark">L</span>
          <div><strong>Libreta</strong><span>{esAdmin ? 'Administración privada' : 'POS de barrio'}</span></div>
        </div>
        <div className="form-intro access-intro">
          <span className="form-intro-icon" aria-hidden="true"><IconoNube /></span>
          <div>
            <strong>{esAdmin ? 'Ingresá al panel de cuentas' : 'Ingresá a tu negocio'}</strong>
            <p>{esAdmin ? 'Sólo las cuentas autorizadas pueden gestionar clientes y vencimientos.' : 'Tu cuenta mantiene el negocio protegido y sincronizado en todos tus aparatos.'}</p>
          </div>
        </div>
        <p className="form-callout">
          Usá el teléfono y el PIN que te entregó el administrador de Libreta.
        </p>
        <form className="form-shell" onSubmit={(evento) => void iniciar(evento)}>
          <label className="form-field">
            <span className="form-field-label">Teléfono <em>de la cuenta</em></span>
            <input aria-label="Tu teléfono" inputMode="tel" autoComplete="username" placeholder="Ej. 261 555 1234" className="form-input tabular" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field-label">PIN <em>6 números</em></span>
            <input aria-label="PIN de 6 números" inputMode="numeric" type="password" autoComplete="current-password" maxLength={6} placeholder="PIN de 6 números" className="form-input tabular" value={pin} onChange={(evento) => setPin(evento.target.value.replace(/\D/g, '').slice(0, 6))} required />
          </label>
          <Boton variante="principal" type="submit" className="w-full" disabled={trabajando}>
            {trabajando ? 'Verificando…' : esAdmin ? 'Entrar al panel' : 'Entrar a mi negocio'}
          </Boton>
        </form>
        {aviso && <p className="form-message form-message-error" role="alert">{aviso}</p>}
        <div className="access-footnote">
          <span>¿Todavía no tenés una cuenta?</span>
          <a href={enlaceWhatsApp('', 'Hola, quiero solicitar acceso a Libreta.')} target="_blank" rel="noreferrer">Solicitar acceso por WhatsApp</a>
        </div>
      </div>
    </div>
  )
}
