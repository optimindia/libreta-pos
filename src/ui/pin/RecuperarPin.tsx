'use client'

import { useRef, useState } from 'react'
import { recuperarConCodigo } from '@/datos/nube/pin'
import { validarPin } from '@/dominio/credenciales'
import { Boton } from '@/ui/sistema/Boton'
import { EstadoError } from '@/ui/sistema/EstadoError'
import { claveTurnstile, VerificacionHumana, type ControlVerificacion } from '@/ui/sistema/VerificacionHumana'
import { CampoPin } from './CampoPin'
import { ValorUnaVez } from './ValorUnaVez'
import './pin.css'

/** "Me olvidé el PIN" para el dueño: teléfono, código de recuperación y un PIN
 *  nuevo. El código sirve una sola vez; al terminar se muestra uno nuevo. Si
 *  es un vendedor el que olvidó el PIN, lo restablece su dueño desde Cuenta. */
export function RecuperarPin({ onVolver }: { onVolver: () => void }) {
  const [telefono, setTelefono] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [repetido, setRepetido] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const verificacion = useRef<ControlVerificacion>(null)
  const clave = claveTurnstile()

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    setFallo(null)
    if (!validarPin(nuevo)) return setAviso('Elegí un PIN de 6 números que no sean todos iguales.')
    if (nuevo !== repetido) return setAviso('Los dos PIN nuevos tienen que ser iguales.')
    setTrabajando(true)
    try {
      const resultado = await recuperarConCodigo(telefono, codigo, nuevo, captchaToken ?? undefined)
      if (!resultado.ok) {
        setFallo(resultado.error)
        verificacion.current?.reiniciar()
        return
      }
      setCodigo('')
      setNuevo('')
      setRepetido('')
      setCodigoNuevo(resultado.codigoRecuperacion)
    } finally {
      setTrabajando(false)
    }
  }

  if (codigoNuevo) {
    return (
      <div className="f-pin-recuperar">
        <p className="f-aviso" role="status" data-tono="ambar">
          <strong>Listo, tu PIN ya cambió.</strong>
          <span>Ya podés ingresar con el PIN nuevo.</span>
        </p>
        <ValorUnaVez
          titulo="Tu código de recuperación nuevo"
          valor={codigoNuevo}
          aviso="El código que usaste ya no sirve. Guardá este en un lugar seguro: no lo vas a poder ver de nuevo."
          etiquetaCopiar="Copiar código"
          imprimible
          textoListo="Ya lo guardé, ir a ingresar"
          onListo={onVolver}
        />
      </div>
    )
  }

  return (
    <form className="f-pin-recuperar f-pin-form" onSubmit={(evento) => void enviar(evento)}>
      <div>
        <h2 className="f-seccion">Recuperá tu PIN</h2>
        <p className="f-texto">Ingresá el teléfono de tu negocio, el código de recuperación que guardaste y elegí un PIN nuevo.</p>
      </div>
      <label className="f-campo">
        <span>Teléfono <em>de tu negocio</em></span>
        <input className="f-entrada" inputMode="tel" autoComplete="username" placeholder="Ej. 261 555 1234" value={telefono} onChange={(evento) => setTelefono(evento.target.value)} required autoFocus />
      </label>
      <label className="f-campo">
        <span>Código de recuperación <em>16 letras y números</em></span>
        <input className="f-entrada f-pin-codigo" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} value={codigo} onChange={(evento) => setCodigo(evento.target.value.toUpperCase())} required />
      </label>
      <CampoPin etiqueta="PIN nuevo" valor={nuevo} onCambio={setNuevo} nuevo />
      <CampoPin etiqueta="Repetí el PIN nuevo" ayuda="igual al de arriba" valor={repetido} onCambio={setRepetido} nuevo />
      {clave && <VerificacionHumana ref={verificacion} clave={clave} onToken={setCaptchaToken} />}
      {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
      {fallo && <EstadoError compacto titulo="No pudimos recuperar tu PIN" texto={fallo} />}
      <div className="f-pin-acciones">
        <Boton type="submit" variante="principal" disabled={trabajando || (clave !== null && !captchaToken)}>
          {trabajando ? 'Verificando…' : 'Cambiar mi PIN'}
        </Boton>
        <Boton variante="secundario" onClick={onVolver} disabled={trabajando}>Volver a ingresar</Boton>
      </div>
      <p className="f-dato">¿Sos vendedor? Pedile a tu dueño que te restablezca el PIN desde Cuenta.</p>
    </form>
  )
}
