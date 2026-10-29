'use client'

import { useRef, useState } from 'react'
import { db } from '@/datos/local/db'
import { descargarArchivo } from '@/datos/local/descarga'
import { crearRespaldoLocal, planRestauracion, restaurarRespaldoLocal } from '@/datos/local/respaldo'
import {
  interpretarCopia, resumirCopia, totalAfectado,
  type Copia, type MotivoRechazo, type PlanFusion,
} from '@/dominio/copia'
import {
  csvFiados, csvProductos, csvVentas, diaArgentino, fechaArgentina, filtrarVentasPorRango,
  nombreArchivoCsv, rangoDeDiasArgentina,
} from '@/dominio/exportar'
import { funcionActiva } from '@/dominio/funciones'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoDescargar, IconoSubir } from '@/ui/sistema/iconos'
import { noSePudo } from '@/ui/sistema/textos'
import { useRol } from '@/ui/sistema/usoRol'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'

const TIPO_CSV = 'text/csv;charset=utf-8'

const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  corrupto: 'Ese archivo no es una copia de Libreta o está dañado. No se cambió nada.',
  invalida: 'Esa copia tiene datos dañados y no se puede restaurar. No se cambió nada.',
  'version-futura': 'Esa copia es de una versión más nueva de Libreta. Actualizá la app y probá de nuevo. No se cambió nada.',
}

interface Pendiente { copia: Copia; plan: PlanFusion }

/** "Tus datos": exportar a planillas y copia de seguridad. Sólo el dueño. */
export function TusDatos() {
  const rol = useRol()
  const { funciones } = useFuncionesNegocio()
  const archivo = useRef<HTMLInputElement>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [reemplazar, setReemplazar] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  if (rol !== 'dueno') return null

  const ok = (texto: string) => setAviso({ texto, error: false })
  const error = (texto: string) => setAviso({ texto, error: true })

  async function descargarVentas() {
    setAviso(null)
    const rango = rangoDeDiasArgentina(desde, hasta)
    if (!rango) return error('Revisá las fechas: “Desde” no puede ser posterior a “Hasta”.')
    try {
      const [ventas, clientes] = await Promise.all([db.ventas.toArray(), db.clientes.toArray()])
      const elegidas = filtrarVentasPorRango(ventas, rango)
      if (elegidas.length === 0) return ok('No hay ventas en esas fechas.')
      descargarArchivo(nombreArchivoCsv('ventas', Date.now()), csvVentas(elegidas, clientes), TIPO_CSV)
      ok(`Listo: bajaste ${elegidas.length} ${elegidas.length === 1 ? 'venta' : 'ventas'}.`)
    } catch {
      error(noSePudo('descargar', 'las ventas'))
    }
  }

  async function descargarProductos() {
    setAviso(null)
    try {
      const productos = await db.productos.toArray()
      const vivos = productos.filter((p) => !p.eliminadoEn)
      if (vivos.length === 0) return ok('Todavía no cargaste productos.')
      descargarArchivo(nombreArchivoCsv('productos', Date.now()), csvProductos(productos), TIPO_CSV)
      ok(`Listo: bajaste ${vivos.length} ${vivos.length === 1 ? 'producto' : 'productos'}.`)
    } catch {
      error(noSePudo('descargar', 'los productos'))
    }
  }

  async function descargarFiados() {
    setAviso(null)
    try {
      const [fiados, pagos, clientes] = await Promise.all([db.fiados.toArray(), db.fiadoPagos.toArray(), db.clientes.toArray()])
      if (fiados.length === 0) return ok('Todavía no anotaste fiados.')
      descargarArchivo(nombreArchivoCsv('fiados', Date.now()), csvFiados(fiados, pagos, clientes), TIPO_CSV)
      ok(`Listo: bajaste ${fiados.length} ${fiados.length === 1 ? 'fiado' : 'fiados'}.`)
    } catch {
      error(noSePudo('descargar', 'los fiados'))
    }
  }

  async function descargarCopia() {
    setAviso(null)
    try {
      const copia = await crearRespaldoLocal()
      descargarArchivo(`libreta-copia-${diaArgentino(Date.now())}.json`, JSON.stringify(copia, null, 2), 'application/json')
      ok('Copia descargada en este aparato. Guardala en un lugar seguro.')
    } catch {
      error(noSePudo('crear', 'la copia'))
    }
  }

  async function leer(file: File) {
    setAviso(null)
    setPendiente(null)
    setReemplazar(false)
    try {
      const resultado = interpretarCopia(await file.text())
      if (!resultado.ok) return error(MENSAJE_RECHAZO[resultado.motivo])
      setPendiente({ copia: resultado.copia, plan: await planRestauracion(resultado.copia, false) })
    } catch {
      error(MENSAJE_RECHAZO.corrupto)
    }
  }

  async function cambiarReemplazo(valor: boolean) {
    setReemplazar(valor)
    if (!pendiente) return
    try {
      setPendiente({ copia: pendiente.copia, plan: await planRestauracion(pendiente.copia, valor) })
    } catch {
      error(noSePudo('revisar', 'la copia'))
    }
  }

  async function restaurar() {
    if (!pendiente) return
    if (reemplazar && !window.confirm('Se van a borrar de este aparato los datos que no están en la copia. Esto no se puede deshacer. ¿Seguro?')) return
    setTrabajando(true)
    try {
      const cantidad = await restaurarRespaldoLocal(pendiente.copia, { reemplazar })
      setPendiente(null)
      setReemplazar(false)
      ok(reemplazar
        ? `Listo: se restauraron ${cantidad} registros y se quitó lo que no estaba en la copia.`
        : `Listo: se restauraron ${cantidad} registros. Lo que ya tenías quedó intacto.`)
    } catch {
      error(noSePudo('restaurar', 'la copia'))
    } finally {
      setTrabajando(false)
    }
  }

  const totales = pendiente ? totalAfectado(pendiente.plan) : null

  return (
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-tus-datos">
      <div>
        <h2 id="config-tus-datos" className="f-seccion">Tus datos</h2>
        <p className="f-dato">Bajá tus datos para abrirlos en Excel o guardá una copia completa del negocio.</p>
      </div>

      <div className="f-config-grupo">
        <h3 className="f-config-grupo-titulo">Planillas (CSV)</h3>
        <div className="f-config-rango">
          <label className="f-campo">
            <span>Ventas desde</span>
            <input type="date" aria-label="Ventas desde" className="f-entrada" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="f-campo">
            <span>Ventas hasta</span>
            <input type="date" aria-label="Ventas hasta" className="f-entrada" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
        <small className="f-config-ayuda">Sin fechas, se bajan todas las ventas. Se abren bien en Excel en castellano.</small>
        <div className="f-config-botones">
          <Boton variante="secundario" onClick={() => void descargarVentas()}><IconoDescargar /> Descargar ventas (CSV)</Boton>
          <Boton variante="secundario" onClick={() => void descargarProductos()}><IconoDescargar /> Descargar productos (CSV)</Boton>
          <Boton variante="secundario" onClick={() => void descargarFiados()}><IconoDescargar /> Descargar fiados (CSV)</Boton>
        </div>
      </div>

      {funcionActiva(funciones, 'respaldoLocal') && (
        <div className="f-config-grupo">
          <h3 className="f-config-grupo-titulo">Copia de seguridad</h3>
          <p className="f-dato">Un archivo con todo tu negocio, para guardarlo o pasarlo a otro celular. Al restaurar, se mezclan los datos y no se borra lo actual.</p>
          <div className="f-config-botones">
            <Boton variante="secundario" onClick={() => void descargarCopia()}><IconoDescargar /> Descargar copia</Boton>
            <Boton variante="secundario" onClick={() => archivo.current?.click()}><IconoSubir /> Restaurar copia</Boton>
          </div>
          <input
            ref={archivo} type="file" accept="application/json,.json" className="f-sr" aria-label="Archivo de respaldo"
            onChange={(evento) => { const file = evento.target.files?.[0]; if (file) void leer(file); evento.currentTarget.value = '' }}
          />
        </div>
      )}

      {pendiente && totales && (
        <div className="f-aviso f-config-pregunta" data-tono="ambar" role="group" aria-label="Resumen de la copia">
          <span>
            Encontré una copia del {fechaArgentina(pendiente.copia.creadoEn)}. Tiene:
          </span>
          <ul className="f-config-resumen">
            {resumirCopia(pendiente.copia).filter((f) => f.cantidad > 0).map((f) => (
              <li key={f.tabla}>{f.titulo}: {f.cantidad}</li>
            ))}
          </ul>
          <span>
            Se agregan {totales.agregados + totales.actualizados} registros; {totales.conservados} ya estaban y no se tocan.
            {reemplazar && totales.borrados > 0 ? ` Se borran ${totales.borrados} que no están en la copia.` : ''}
          </span>
          <label className="f-config-casilla">
            <input type="checkbox" checked={reemplazar} onChange={(e) => void cambiarReemplazo(e.target.checked)} />
            <span>También borrar lo que no esté en la copia (no se puede deshacer)</span>
          </label>
          <div className="f-config-botones">
            <Boton variante="secundario" disabled={trabajando} onClick={() => void restaurar()}>
              {reemplazar ? 'Restaurar y borrar el resto' : 'Sí, restaurar'}
            </Boton>
            <Boton variante="secundario" onClick={() => { setPendiente(null); setReemplazar(false) }}>Cancelar</Boton>
          </div>
        </div>
      )}

      {aviso && (
        aviso.error
          ? <p className="f-aviso" data-tono="ambar" role="alert">{aviso.texto}</p>
          : <p role="status" className="f-aviso f-config-ok">{aviso.texto}</p>
      )}
    </Tarjeta>
  )
}
