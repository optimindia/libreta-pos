'use client'

import { useState } from 'react'
import { cambiarMiPin } from '@/datos/nube/pin'
import { validarPin } from '@/dominio/credenciales'
import { Boton } from '@/ui/sistema/Boton'
import { EstadoError } from '@/ui/sistema/EstadoError'
import { CampoPin } from './CampoPin'
import { ValorUnaVez } from './ValorUnaVez'
import './pin.css'

/** Cambiar el PIN propio, con el actual (o el temporal) por delante. Si quien
 *  lo cambia es el dueño, después se muestra su código de recuperación nuevo,
 *  una sola vez. `onListo` se llama cuando todo terminó. */
export function CambiarPin({
  actualEtiqueta = 'PIN actual',
  onListo,
  onCancelar,
}: {
  actualEtiqueta?: string
  onListo: () => void
  onCancelar?: () => void
}) {
  const [actual, setActual] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [repetido, setRepetido] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    setFallo(null)
    if (!validarPin(nuevo)) return setAviso('Elegí un PIN de 6 números que no sean todos iguales.')
    if (nuevo === actual) return setAviso('El PIN nuevo tiene que ser distinto del actual.')
    if (nuevo !== repetido) return setAviso('Los dos PIN nuevos tienen que ser iguales.')
    setTrabajando(true)
    try {
      const resultado = await cambiarMiPin(actual, nuevo)
      if (!resultado.ok) return setFallo(resultado.error)
      setActual('')
      setNuevo('')
      setRepetido('')
      if (resultado.codigoRecuperacion) setCodigo(resultado.codigoRecuperacion)
      else onListo()
    } finally {
      setTrabajando(false)
    }
  }

  if (codigo) {
    return (
      <ValorUnaVez
        titulo="Tu código de recuperación nuevo"
        valor={codigo}
        aviso="Tu PIN ya cambió. Este código reemplaza al anterior: guardalo en un lugar seguro, porque no lo vas a poder ver de nuevo. Si te olvidás el PIN, con este código lo recuperás."
        etiquetaCopiar="Copiar código"
        imprimible
        onListo={() => {
          setCodigo(null)
          onListo()
        }}
      />
    )
  }

  return (
    <form className="f-pin-form" onSubmit={(evento) => void enviar(evento)}>
      <CampoPin etiqueta={actualEtiqueta} valor={actual} onCambio={setActual} autoFocus />
      <CampoPin etiqueta="PIN nuevo" valor={nuevo} onCambio={setNuevo} nuevo />
      <CampoPin etiqueta="Repetí el PIN nuevo" ayuda="igual al de arriba" valor={repetido} onCambio={setRepetido} nuevo />
      {aviso && <p className="f-aviso" role="alert">{aviso}</p>}
      {fallo && <EstadoError compacto titulo="No pudimos cambiar el PIN" texto={fallo} />}
      <div className="f-pin-acciones">
        <Boton type="submit" variante="principal" disabled={trabajando}>{trabajando ? 'Cambiando…' : 'Cambiar mi PIN'}</Boton>
        {onCancelar && <Boton variante="secundario" onClick={onCancelar} disabled={trabajando}>Cancelar</Boton>}
      </div>
    </form>
  )
}
