'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  consultarEstadoPin,
  generarCodigoRecuperacion,
  restablecerPinVendedor,
  type EstadoPin,
  type VendedorPinPendiente,
} from '@/datos/nube/pin'
import { Boton } from '@/ui/sistema/Boton'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { EstadoError } from '@/ui/sistema/EstadoError'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { CambiarPin } from './CambiarPin'
import { CampoPin } from './CampoPin'
import { ValorUnaVez } from './ValorUnaVez'
import './pin.css'

type Secreto = { tipo: 'codigo' | 'temporal'; valor: string; nombre?: string }

/** Seguridad del PIN dentro de Cuenta: cambiar el propio, el código de
 *  recuperación del dueño y el restablecimiento del PIN de sus vendedores.
 *  Todo lo decide la función Edge; esta pantalla sólo pide y muestra. */
export function SeguridadPin() {
  const [estado, setEstado] = useState<EstadoPin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cambiando, setCambiando] = useState(false)
  const [secreto, setSecreto] = useState<Secreto | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const resultado = await consultarEstadoPin()
    if (resultado.ok) setEstado(resultado)
    else setError(resultado.error)
    setCargando(false)
  }, [])

  useEffect(() => {
    // Carga inicial: el estado llega de la función Edge, no hay otra fuente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  if (secreto) {
    const esCodigo = secreto.tipo === 'codigo'
    return (
      <ValorUnaVez
        titulo={esCodigo ? 'Tu código de recuperación' : `PIN temporal de ${secreto.nombre ?? 'tu vendedor'}`}
        valor={secreto.valor}
        aviso={
          esCodigo
            ? 'Guardalo en un lugar seguro: no lo vas a poder ver de nuevo. Sirve una sola vez y reemplaza al anterior. Si te olvidás el PIN, con este código lo recuperás.'
            : 'Pasáselo a tu vendedor en persona. No lo vas a poder ver de nuevo. Al ingresar, tiene que cambiarlo por uno propio.'
        }
        etiquetaCopiar={esCodigo ? 'Copiar código' : 'Copiar PIN'}
        imprimible={esCodigo}
        onListo={() => {
          setSecreto(null)
          void cargar()
        }}
      />
    )
  }

  if (cargando && !estado) return <EstadoCarga texto="Cargando la seguridad de tu PIN…" filas={2} />
  if (error && !estado) {
    return <EstadoError titulo="No pudimos cargar la seguridad de tu PIN" texto={error} onReintentar={() => void cargar()} />
  }
  if (!estado) return null

  return (
    <section className="f-pin-seguridad f-tarjeta" data-relleno="normal" aria-labelledby="f-pin-seguridad-titulo">
      <h2 id="f-pin-seguridad-titulo" className="f-seccion">Seguridad de tu PIN</h2>

      <div className="f-pin-bloque">
        <h3 className="f-texto"><strong>Tu PIN</strong></h3>
        {cambiando ? (
          <CambiarPin
            onCancelar={() => setCambiando(false)}
            onListo={() => {
              setCambiando(false)
              void cargar()
            }}
          />
        ) : (
          <div className="f-pin-acciones">
            <Boton variante="secundario" onClick={() => setCambiando(true)}>Cambiar mi PIN</Boton>
          </div>
        )}
      </div>

      {estado.rol === 'dueno' && (
        <>
          <BloqueCodigo
            tieneCodigo={estado.tieneCodigo === true}
            onCodigo={(valor) => setSecreto({ tipo: 'codigo', valor })}
          />
          <BloqueVendedores
            vendedores={estado.vendedores ?? []}
            onTemporal={(valor, nombre) => setSecreto({ tipo: 'temporal', valor, nombre })}
          />
        </>
      )}
    </section>
  )
}

function BloqueCodigo({ tieneCodigo, onCodigo }: { tieneCodigo: boolean; onCodigo: (valor: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [pin, setPin] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  async function generar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setFallo(null)
    setTrabajando(true)
    try {
      const resultado = await generarCodigoRecuperacion(pin)
      if (!resultado.ok) return setFallo(resultado.error)
      setPin('')
      onCodigo(resultado.codigoRecuperacion)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="f-pin-bloque">
      <h3 className="f-texto"><strong>Código de recuperación</strong></h3>
      <p className="f-dato">
        {tieneCodigo
          ? 'Ya tenés un código. Si lo perdiste, generá uno nuevo: el anterior deja de servir.'
          : 'Todavía no generaste un código. Sin él, si te olvidás el PIN no vas a poder recuperarlo vos.'}
      </p>
      {abierto ? (
        <form className="f-pin-form" onSubmit={(evento) => void generar(evento)}>
          <CampoPin etiqueta="Tu PIN actual" valor={pin} onCambio={setPin} autoFocus />
          {fallo && <EstadoError compacto titulo="No pudimos generar el código" texto={fallo} />}
          <div className="f-pin-acciones">
            <Boton type="submit" variante="principal" disabled={trabajando}>{trabajando ? 'Generando…' : 'Generar código'}</Boton>
            <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={trabajando}>Cancelar</Boton>
          </div>
        </form>
      ) : (
        <div className="f-pin-acciones">
          <Boton variante="secundario" onClick={() => setAbierto(true)}>{tieneCodigo ? 'Generar código nuevo' : 'Generar código'}</Boton>
        </div>
      )}
    </div>
  )
}

function BloqueVendedores({
  vendedores,
  onTemporal,
}: {
  vendedores: VendedorPinPendiente[]
  onTemporal: (valor: string, nombre: string) => void
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function restablecer(vendedor: VendedorPinPendiente) {
    setFallo(null)
    setTrabajando(true)
    try {
      const resultado = await restablecerPinVendedor(vendedor.usuarioId)
      if (!resultado.ok) return setFallo(resultado.error)
      setConfirmando(null)
      onTemporal(resultado.pinTemporal, vendedor.nombre ?? vendedor.telefono ?? 'tu vendedor')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="f-pin-bloque">
      <h3 className="f-texto"><strong>PIN de tus vendedores</strong></h3>
      {vendedores.length === 0 ? (
        <p className="f-dato">Todavía no tenés vendedores con acceso propio.</p>
      ) : (
        <ul className="f-pin-lista">
          {vendedores.map((vendedor) => {
            const nombre = vendedor.nombre ?? vendedor.telefono ?? 'Vendedor'
            return (
              <li key={vendedor.usuarioId} className="f-pin-fila">
                <div className="f-pin-fila-datos">
                  <strong className="f-texto">{nombre}</strong>
                  {vendedor.pendiente && <Etiqueta tono="ambar">Pendiente de cambio</Etiqueta>}
                </div>
                {confirmando === vendedor.usuarioId ? (
                  <div className="f-pin-confirmar" role="group" aria-label={`Restablecer el PIN de ${nombre}`}>
                    <p className="f-texto">¿Restablecer el PIN de {nombre}? Va a tener que usar uno temporal que no se vuelve a mostrar.</p>
                    <div className="f-pin-acciones">
                      <Boton variante="principal" onClick={() => void restablecer(vendedor)} disabled={trabajando}>
                        {trabajando ? 'Restableciendo…' : 'Sí, restablecer'}
                      </Boton>
                      <Boton variante="secundario" onClick={() => setConfirmando(null)} disabled={trabajando}>Cancelar</Boton>
                    </div>
                  </div>
                ) : (
                  <Boton variante="secundario" onClick={() => setConfirmando(vendedor.usuarioId)} aria-label={`Restablecer el PIN de ${nombre}`}>
                    Restablecer PIN
                  </Boton>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {fallo && <EstadoError compacto titulo="No pudimos restablecer el PIN" texto={fallo} />}
    </div>
  )
}
