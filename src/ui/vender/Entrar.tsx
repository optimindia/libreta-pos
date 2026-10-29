'use client'

import { useRef, useState } from 'react'
import { entrar } from '@/datos/nube/sesion'
import { accesoSaasObligatorio } from '@/datos/nube/acceso'
import { bajarTodo, traerDeSupabase } from '@/datos/nube/sincronizar'
import { Boton } from '@/ui/sistema/Boton'
import '@/ui/sistema/acceso.css'
import { IconoNube } from '@/ui/sistema/iconos'
import { claveTurnstile, VerificacionHumana, type ControlVerificacion } from '@/ui/sistema/VerificacionHumana'
import { TEXTOS } from '@/ui/sistema/textos'

/** La puerta de un aparato nuevo: o traés el negocio que ya está en la
 *  nube, o empezás uno nuevo acá. Sólo se muestra con la base vacía. */
export function Entrar({ onListo }: { onListo: () => void }) {
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const verificacion = useRef<ControlVerificacion>(null)
  const clave = claveTurnstile()

  async function traerMiNegocio(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    setTrabajando(true)
    setAviso(null)
    try {
      const resultado = await entrar(telefono, pin, captchaToken ? { captchaToken } : {})
      if (!resultado.ok) {
        setAviso(resultado.motivo)
        verificacion.current?.reiniciar()
        return
      }
      await bajarTodo(traerDeSupabase)
      onListo()
    } catch {
      setAviso(`No se pudo traer el negocio. ${TEXTOS.revisarSenal}`)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <form className="f-tarjeta f-acceso-entrar" data-relleno="normal" onSubmit={(evento) => void traerMiNegocio(evento)}>
      <div className="f-acceso-intro">
        <span className="f-acceso-icono" aria-hidden="true"><IconoNube /></span>
        <div><strong className="f-seccion">¿Ya usás Libreta en otro aparato?</strong><p className="f-texto">Traé tu negocio a este dispositivo en unos segundos.</p></div>
      </div>
      <p className="f-acceso-nota">
        Entrá con tu teléfono y el mismo PIN, y este aparato queda con todo tu negocio.
      </p>

      <label className="f-campo">
        <span>Teléfono <em>de tu negocio</em></span>
        <input aria-label="Tu teléfono" inputMode="tel" placeholder="Ej. 261 555 1234" className="f-entrada" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} />
      </label>
      <label className="f-campo">
        <span>PIN <em>6 números</em></span>
        <input aria-label="PIN de 6 números" inputMode="numeric" type="password" autoComplete="current-password" placeholder="PIN de 6 números" className="f-entrada" value={pin} onChange={(evento) => setPin(evento.target.value)} />
        <small className="f-acceso-ayuda">Es el mismo PIN que elegiste al crear tu respaldo.</small>
      </label>

      {clave && <VerificacionHumana ref={verificacion} clave={clave} onToken={setCaptchaToken} />}

      <Boton
        variante="principal"
        type="submit"
        ancho
        disabled={trabajando || (clave !== null && !captchaToken)}
      >
        {trabajando ? 'Bajando tu negocio…' : 'Traer mi negocio'}
      </Boton>

      {aviso && (
        <p className="f-aviso" role="alert">{aviso}</p>
      )}

      {!accesoSaasObligatorio() && (
        <>
          <Boton
            type="button"
            variante="secundario"
            ancho
            onClick={onListo}
          >
            Empezar de cero acá
          </Boton>

          <p className="f-acceso-ayuda">
            Si cargaste algo acá y traés tu negocio, las dos cosas quedan: no se borra nada.
          </p>
        </>
      )}
    </form>
  )
}
