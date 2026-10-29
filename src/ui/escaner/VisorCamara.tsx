'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { escanear, type ControlEscaner } from '@/ui/vender/escaner'
import { avisarLectura } from './sonido'
import { pesosDeTexto } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoEscanear } from '@/ui/sistema/iconos'
import './escaner.css'

/** `codigo` viene cuando el código no es de ningún producto: es lo que
 *  permite ofrecer cargarlo ahí mismo. */
export type RespuestaLectura = { tipo: 'ok' | 'falta'; texto: string; codigo?: string }

export type DatosProductoNuevo = { codigo: string; nombre: string; precio: number; costo: number; stock: number }

/** La cámara a pantalla completa para leer códigos de barras.
 *
 *  - `continuo`: en la venta se queda abierta y suma producto tras producto;
 *    en la carga se cierra con la primera lectura.
 *  - Cada lectura suena (pi), vibra y muestra qué pasó con el código.
 *  - Siempre hay salida: escribir el código a mano, y linterna si el
 *    teléfono la tiene. */
export function VisorCamara({
  titulo,
  ayuda,
  continuo = false,
  textoListo = 'Listo',
  alLeer,
  alCargar,
  onCerrar,
}: {
  titulo: string
  ayuda: string
  continuo?: boolean
  textoListo?: string
  /** Decide qué pasó con el código; el visor lo cuenta, suena y lo muestra. */
  alLeer: (codigo: string) => Promise<RespuestaLectura> | RespuestaLectura
  /** Si viene, un código desconocido ofrece "Cargarlo ahora" (alta rápida). */
  alCargar?: (datos: DatosProductoNuevo) => Promise<RespuestaLectura>
  onCerrar: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const control = useRef<ControlEscaner | null>(null)
  const ultimo = useRef({ codigo: '', momento: 0 })
  const ocupado = useRef(false)
  const alLeerRef = useRef(alLeer)
  const onCerrarRef = useRef(onCerrar)
  useEffect(() => {
    alLeerRef.current = alLeer
    onCerrarRef.current = onCerrar
  })
  const [resultado, setResultado] = useState<(RespuestaLectura & { n: number }) | null>(null)
  const [leidos, setLeidos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [linterna, setLinterna] = useState<'no' | 'apagada' | 'prendida'>('no')
  const [manual, setManual] = useState('')
  const [nuevo, setNuevo] = useState<{ codigo: string; nombre: string; precio: string; costo: string; stock: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)
  // Qué campo causó el error, para marcarlo y enlazarlo con el mensaje.
  const [campoError, setCampoError] = useState<'nombre' | 'precio' | 'costo' | 'stock' | null>(null)
  const idErrorNuevo = useId()

  async function procesar(codigo: string, deLaCamara: boolean) {
    const ahora = Date.now()
    // La cámara ve el mismo código muchas veces por segundo: se lee una vez
    // y, si el producto sigue enfrente, otra recién pasado un rato.
    if (deLaCamara && ultimo.current.codigo === codigo && ahora - ultimo.current.momento < 2000) {
      ultimo.current.momento = ahora
      return
    }
    if (ocupado.current || nuevo) return
    ocupado.current = true
    ultimo.current = { codigo, momento: ahora }
    try {
      const respuesta = await alLeerRef.current(codigo)
      avisarLectura(respuesta.tipo)
      if (respuesta.tipo === 'ok') setLeidos((n) => n + 1)
      setResultado({ ...respuesta, n: ahora })
      if (respuesta.tipo === 'ok' && !continuo) {
        control.current?.()
        onCerrarRef.current()
      }
    } finally {
      ocupado.current = false
    }
  }
  const procesarRef = useRef(procesar)
  useEffect(() => { procesarRef.current = procesar })

  useEffect(() => {
    let vivo = true
    let propio: ControlEscaner | null = null
    async function abrir() {
      if (!video.current) return
      try {
        const nuevo = await escanear(video.current, (codigo) => void procesarRef.current(codigo, true))
        if (!vivo) { nuevo(); return }
        propio = nuevo
        control.current = nuevo
        setLinterna(nuevo.hayLinterna ? 'apagada' : 'no')
      } catch {
        if (vivo) setError('No pudimos abrir la cámara. Revisá el permiso del navegador o escribí el código abajo.')
      }
    }
    void abrir()
    return () => {
      vivo = false
      propio?.()
      control.current = null
    }
  }, [])

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') onCerrarRef.current() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  async function alternarLinterna() {
    try {
      const prendida = await control.current?.alternarLinterna?.()
      setLinterna(prendida ? 'prendida' : 'apagada')
    } catch {
      setLinterna('no')
    }
  }

  function falla(campo: NonNullable<typeof campoError>, mensaje: string) {
    setCampoError(campo)
    setErrorNuevo(mensaje)
  }

  /** Atributos del campo que causó el error: inválido y descrito por el mensaje. */
  function enlaceError(campo: NonNullable<typeof campoError>) {
    return errorNuevo && campoError === campo
      ? { 'aria-invalid': true as const, 'aria-describedby': idErrorNuevo }
      : {}
  }

  async function guardarNuevo(evento: React.FormEvent) {
    evento.preventDefault()
    if (!nuevo || !alCargar) return
    const nombre = nuevo.nombre.trim()
    const precio = pesosDeTexto(nuevo.precio)
    const costo = nuevo.costo.trim() === '' ? 0 : pesosDeTexto(nuevo.costo)
    const stock = Number(nuevo.stock)
    if (!nombre) return falla('nombre', 'Escribí cómo se llama el producto.')
    if (!(precio > 0)) return falla('precio', 'Poné el precio de venta (mayor a $0).')
    if (!(costo >= 0)) return falla('costo', 'El costo no puede ser negativo.')
    if (!Number.isInteger(stock) || stock < 1) return falla('stock', 'Poné cuántas unidades tenés (al menos 1).')
    setGuardando(true)
    setErrorNuevo(null)
    try {
      const respuesta = await alCargar({ codigo: nuevo.codigo, nombre, precio, costo, stock })
      avisarLectura(respuesta.tipo)
      if (respuesta.tipo === 'ok') setLeidos((n) => n + 1)
      setResultado({ ...respuesta, n: Date.now() })
      setNuevo(null)
      if (respuesta.tipo === 'ok' && !continuo) {
        control.current?.()
        onCerrarRef.current()
      }
    } catch {
      setCampoError(null)
      setErrorNuevo('No se pudo guardar el producto. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function enviarManual(evento: React.FormEvent) {
    evento.preventDefault()
    const codigo = manual.replace(/\s/g, '')
    if (!codigo) return
    setManual('')
    void procesar(codigo, false)
  }

  return (
    <div className="f-visor" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="f-visor-tarjeta">
      <video ref={video} className="f-visor-video" playsInline muted />

      <div className="f-visor-cabeza">
        <div className="f-visor-titulo">
          <span className="f-visor-icono" aria-hidden="true"><IconoEscanear /></span>
          <strong>{titulo}</strong>
        </div>
        <div className="f-visor-herramientas">
          {linterna !== 'no' && (
            <button type="button" className="f-visor-boton" aria-pressed={linterna === 'prendida'} onClick={() => void alternarLinterna()}>
              {linterna === 'prendida' ? 'Apagar luz' : 'Prender luz'}
            </button>
          )}
          <button type="button" className="f-visor-boton f-visor-cerrar" aria-label="Cerrar escáner" onClick={onCerrar}><IconoCerrar /></button>
        </div>
      </div>

      <div className="f-visor-marco" data-estado={resultado?.tipo} key={resultado?.n ?? 'inicio'} aria-hidden="true">
        <i /><i /><i /><i />
        <span className="f-visor-linea" />
      </div>

      <div className="f-visor-pie">
        <p className="f-visor-estado" role="status" aria-live="polite" data-tipo={error ? 'falta' : resultado?.tipo ?? 'espera'}>
          {error ?? resultado?.texto ?? ayuda}
        </p>

        {!nuevo && alCargar && resultado?.tipo === 'falta' && resultado.codigo && (
          <button
            type="button"
            className="f-boton f-boton-secundario f-boton-ancho f-visor-cargar"
            onClick={() => setNuevo({ codigo: resultado.codigo as string, nombre: '', precio: '', costo: '', stock: '' })}
          >
            Cargarlo ahora
          </button>
        )}

        {nuevo ? (
          <form className="f-visor-nuevo" onSubmit={(evento) => void guardarNuevo(evento)}>
            <p className="f-visor-nuevo-titulo">Producto nuevo · código {nuevo.codigo}</p>
            <label className="f-visor-campo f-visor-campo-ancho">
              <span>Nombre</span>
              <input className="f-entrada" autoFocus autoComplete="off" placeholder="Ej. Yerba Playadito 1 kg" {...enlaceError('nombre')} value={nuevo.nombre} onChange={(evento) => setNuevo({ ...nuevo, nombre: evento.target.value })} />
            </label>
            <label className="f-visor-campo">
              <span>Precio de venta ($)</span>
              <input className="f-entrada" inputMode="decimal" autoComplete="off" {...enlaceError('precio')} value={nuevo.precio} onChange={(evento) => setNuevo({ ...nuevo, precio: evento.target.value })} />
            </label>
            <label className="f-visor-campo">
              <span>¿Cuántas tenés?</span>
              <input className="f-entrada" inputMode="numeric" autoComplete="off" {...enlaceError('stock')} value={nuevo.stock} onChange={(evento) => setNuevo({ ...nuevo, stock: evento.target.value.replace(/\D/g, '') })} />
            </label>
            <label className="f-visor-campo f-visor-campo-ancho">
              <span>Costo ($) <em>opcional, para ver tu ganancia</em></span>
              <input className="f-entrada" inputMode="decimal" autoComplete="off" {...enlaceError('costo')} value={nuevo.costo} onChange={(evento) => setNuevo({ ...nuevo, costo: evento.target.value })} />
            </label>
            {errorNuevo && <p id={idErrorNuevo} className="f-visor-estado f-visor-campo-ancho" data-tipo="falta" role="alert">{errorNuevo}</p>}
            <div className="f-visor-nuevo-acciones f-visor-campo-ancho">
              <Boton variante="secundario" onClick={() => { setNuevo(null); setErrorNuevo(null) }}>Cancelar</Boton>
              <Boton variante="principal" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : continuo ? 'Guardar y sumar' : 'Guardar'}</Boton>
            </div>
          </form>
        ) : (
        <form className="f-visor-manual" onSubmit={enviarManual}>
          <label className="f-sr" htmlFor="f-visor-codigo">Código de barras a mano</label>
          <input
            id="f-visor-codigo"
            className="f-entrada"
            inputMode="numeric"
            autoComplete="off"
            placeholder="¿No lee? Escribí el código"
            value={manual}
            onChange={(evento) => setManual(evento.target.value)}
          />
          <button type="submit" className="f-visor-boton" disabled={manual.trim() === ''}>Buscar</button>
        </form>
        )}

        {!nuevo && (continuo ? (
          <Boton variante="principal" tamano="grande" ancho onClick={onCerrar}>
            {leidos > 0 ? `${textoListo} · ${leidos} ${leidos === 1 ? 'producto' : 'productos'}` : textoListo}
          </Boton>
        ) : (
          <Boton variante="secundario" ancho onClick={onCerrar}>Cargar a mano</Boton>
        ))}
      </div>
      </div>
    </div>
  )
}
