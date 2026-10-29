'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { entrar } from '@/datos/nube/sesion'
import { bajarTodo, sincronizar, subirASupabase, traerDeSupabase } from '@/datos/nube/sincronizar'
import { notificarCambioAcceso } from '@/datos/nube/acceso'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton, clasesBoton } from './Boton'
import { Tarjeta } from './Tarjeta'
import { IconoNube } from './iconos'
import './acceso.css'
import { claveTurnstile, VerificacionHumana, type ControlVerificacion } from './VerificacionHumana'

export function PantallaAcceso({ modo = 'negocio' }: { modo?: 'negocio' | 'admin' }) {
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const verificacion = useRef<ControlVerificacion>(null)
  const clave = claveTurnstile()
  const esAdmin = modo === 'admin'

  async function iniciar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    setTrabajando(true)
    try {
      const resultado = await entrar(telefono, pin, captchaToken ? { captchaToken } : {})
      if (!resultado.ok) {
        setAviso(resultado.motivo)
        verificacion.current?.reiniciar()
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
    <div className="f-acceso">
      <Tarjeta como="section" relleno="grande" className="f-acceso-tarjeta">
        <div className="f-acceso-marca-fila">
          <span className="f-acceso-marca" aria-hidden="true">L</span>
          <div><strong>Libreta</strong><span>{esAdmin ? 'Administración privada' : 'POS de barrio'}</span></div>
        </div>
        <div className="f-acceso-intro">
          <span className="f-acceso-icono" aria-hidden="true"><IconoNube /></span>
          <div>
            <h1 className="f-seccion">{esAdmin ? 'Ingresá al panel de cuentas' : 'Ingresá a tu negocio'}</h1>
            <p className="f-texto">{esAdmin ? 'Sólo las cuentas autorizadas pueden gestionar clientes y vencimientos.' : 'Tu cuenta mantiene el negocio protegido y sincronizado en todos tus aparatos.'}</p>
          </div>
        </div>
        <p className="f-acceso-nota">
          Usá el teléfono y el PIN que te entregó el administrador de Libreta.
        </p>
        <form className="f-acceso-form" onSubmit={(evento) => void iniciar(evento)}>
          <label className="f-campo">
            <span>Teléfono <em>de la cuenta</em></span>
            <input aria-label="Tu teléfono" inputMode="tel" autoComplete="username" placeholder="Ej. 261 555 1234" className="f-entrada" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} required />
          </label>
          <label className="f-campo">
            <span>PIN <em>6 números</em></span>
            <input aria-label="PIN de 6 números" inputMode="numeric" type="password" autoComplete="current-password" maxLength={6} placeholder="PIN de 6 números" className="f-entrada" value={pin} onChange={(evento) => setPin(evento.target.value.replace(/\D/g, '').slice(0, 6))} required />
          </label>
          {clave && <VerificacionHumana ref={verificacion} clave={clave} onToken={setCaptchaToken} />}
          <Boton variante="principal" type="submit" ancho disabled={trabajando || (clave !== null && !captchaToken)}>
            {trabajando ? 'Verificando…' : esAdmin ? 'Entrar al panel' : 'Entrar a mi negocio'}
          </Boton>
        </form>
        {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
        <p className="f-acceso-legal">
          Al entrar aceptás los <Link href="/terminos">Términos</Link> y la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
        <div className="f-acceso-pie">
          <span>¿Todavía no tenés una cuenta?</span>
          <a className={clasesBoton('secundario')} href={enlaceWhatsApp('', 'Hola, quiero solicitar acceso a Libreta.')} target="_blank" rel="noreferrer">Solicitar acceso por WhatsApp</a>
        </div>
      </Tarjeta>
    </div>
  )
}
