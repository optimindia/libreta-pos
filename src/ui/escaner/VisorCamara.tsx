'use client'

import { useEffect, useRef, useState } from 'react'
import { escanear, type ControlEscaner } from '@/ui/vender/escaner'
import { avisarLectura } from './sonido'
import { Boton } from '@/ui/sistema/Boton'
import { IconoCerrar, IconoEscanear } from '@/ui/sistema/iconos'
import './escaner.css'

export type RespuestaLectura = { tipo: 'ok' | 'falta'; texto: string }

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
  onCerrar,
}: {
  titulo: string
  ayuda: string
  continuo?: boolean
  textoListo?: string
  /** Decide qué pasó con el código; el visor lo cuenta, suena y lo muestra. */
  alLeer: (codigo: string) => Promise<RespuestaLectura> | RespuestaLectura
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

  async function procesar(codigo: string, deLaCamara: boolean) {
    const ahora = Date.now()
    // La cámara ve el mismo código muchas veces por segundo: se lee una vez
    // y, si el producto sigue enfrente, otra recién pasado un rato.
    if (deLaCamara && ultimo.current.codigo === codigo && ahora - ultimo.current.momento < 2000) {
      ultimo.current.momento = ahora
      return
    }
    if (ocupado.current) return
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

        {continuo ? (
          <Boton variante="principal" tamano="grande" ancho onClick={onCerrar}>
            {leidos > 0 ? `${textoListo} · ${leidos} ${leidos === 1 ? 'producto' : 'productos'}` : textoListo}
          </Boton>
        ) : (
          <Boton variante="secundario" ancho onClick={onCerrar}>Cargar a mano</Boton>
        )}
      </div>
      </div>
    </div>
  )
}
