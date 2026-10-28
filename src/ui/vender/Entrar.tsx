'use client'

import { useRef, useState } from 'react'
import { entrar } from '@/datos/nube/sesion'
import { accesoSaasObligatorio } from '@/datos/nube/acceso'
import { bajarTodo, traerDeSupabase } from '@/datos/nube/sincronizar'
import { Boton } from '@/ui/sistema/Boton'
import { IconoNube } from '@/ui/sistema/iconos'
import { claveTurnstile, VerificacionHumana, type ControlVerificacion } from '@/ui/sistema/VerificacionHumana'

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
      setAviso('No se pudo traer el negocio. Revisá la señal y probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <form className="vender-entry form-shell form-card mt-6" onSubmit={(evento) => void traerMiNegocio(evento)}>
      <div className="form-intro">
        <span className="form-intro-icon" aria-hidden="true"><IconoNube /></span>
        <div><strong>¿Ya usás Libreta en otro aparato?</strong><p>Traé tu negocio a este dispositivo en unos segundos.</p></div>
      </div>
      <p className="form-callout">
        Entrá con tu teléfono y el mismo PIN, y este aparato queda con todo tu negocio.
      </p>

      <label className="form-field">
        <span className="form-field-label">Teléfono <em>de tu negocio</em></span>
        <input aria-label="Tu teléfono" inputMode="tel" placeholder="Ej. 261 555 1234" className="form-input tabular" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} />
      </label>
      <label className="form-field">
        <span className="form-field-label">PIN <em>6 números</em></span>
        <input aria-label="PIN de 6 números" inputMode="numeric" type="password" autoComplete="current-password" placeholder="PIN de 6 números" className="form-input tabular" value={pin} onChange={(evento) => setPin(evento.target.value)} />
        <span className="form-field-help">Es el mismo PIN que elegiste al crear tu respaldo.</span>
      </label>

      {clave && <VerificacionHumana ref={verificacion} clave={clave} onToken={setCaptchaToken} />}

      <Boton
        variante="principal"
        type="submit"
        className="w-full !py-3 !text-[13px]"
        disabled={trabajando || (clave !== null && !captchaToken)}
      >
        {trabajando ? 'Bajando tu negocio…' : 'Traer mi negocio'}
      </Boton>

      {aviso && (
        <p className="form-message form-message-error" role="alert">{aviso}</p>
      )}

      {!accesoSaasObligatorio() && (
        <>
          <Boton
            type="button"
            variante="secundario"
            className="w-full !py-3 !text-[13px]"
            onClick={onListo}
          >
            Empezar de cero acá
          </Boton>

          <p className="form-field-help">
            Si cargaste algo acá y traés tu negocio, las dos cosas quedan: no se borra nada.
          </p>
        </>
      )}
    </form>
  )
}
