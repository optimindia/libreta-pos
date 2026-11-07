'use client'

import { useEffect } from 'react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { avisosPendientes, claveDia, type DatosAvisos, type IdAviso } from '@/dominio/avisosLocales'
import { cumplesProximos } from '@/dominio/cumpleanos'
import { formatearPesos } from '@/dominio/dinero'
import { fiadosVencidos, porReponer } from '@/dominio/inicio'
import { porVencer } from '@/dominio/vencimientos'

const CLAVE_ACTIVOS = 'libreta.avisos.activos'
const CLAVE_DIA = 'libreta.avisos.dia'
const CADA = 30 * 60 * 1000

export function avisosSoportados(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function avisosActivos(): boolean {
  try { return avisosSoportados() && Notification.permission === 'granted' && window.localStorage.getItem(CLAVE_ACTIVOS) === '1' } catch { return false }
}

export function guardarAvisosActivos(activos: boolean): void {
  try {
    if (activos) window.localStorage.setItem(CLAVE_ACTIVOS, '1')
    else window.localStorage.removeItem(CLAVE_ACTIVOS)
  } catch { /* sin almacenamiento: no se recuerda */ }
}

function avisadosHoy(ahora: number): Set<IdAviso> {
  try {
    const dato = JSON.parse(window.localStorage.getItem(CLAVE_DIA) ?? 'null') as { dia?: string; ids?: IdAviso[] } | null
    return new Set(dato?.dia === claveDia(ahora) ? dato.ids ?? [] : [])
  } catch {
    return new Set()
  }
}

function marcarAvisados(ahora: number, ids: Set<IdAviso>) {
  try { window.localStorage.setItem(CLAVE_DIA, JSON.stringify({ dia: claveDia(ahora), ids: [...ids] })) } catch { /* nada */ }
}

/** Muestra un aviso del sistema. Con service worker (app instalada) se usa
 *  ese, que funciona también con la app en segundo plano. */
export async function mostrarAviso(titulo: string, cuerpo: string, url: string, etiqueta: string): Promise<void> {
  const opciones: NotificationOptions = { body: cuerpo, icon: '/icon-192.png', badge: '/icon-192.png', tag: `libreta-${etiqueta}`, data: { url } }
  try {
    const registro = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registro) {
      await registro.showNotification(titulo, opciones)
      return
    }
  } catch { /* sin service worker: va directo */ }
  const aviso = new Notification(titulo, opciones)
  aviso.onclick = () => { window.focus(); window.location.assign(url) }
}

async function datosParaAvisos(ahora: number): Promise<DatosAvisos> {
  const [productos, fiados, pagos, clientes, ventas, cierres] = await Promise.all([
    repos.productos.todos(), db.fiados.toArray(), repos.fiados.pagos(), repos.clientes.todos(),
    db.ventas.where('fecha').above(new Date(new Date(ahora).setHours(0, 0, 0, 0)).getTime()).toArray(),
    db.cierres.toArray(),
  ])
  const inicioHoy = new Date(new Date(ahora).setHours(0, 0, 0, 0)).getTime()
  const vencidos = fiadosVencidos(fiados, pagos, ahora)
  return {
    porVencer: porVencer(productos, ahora).filter((item) => item.dias <= 1).map((item) => item.producto.nombre),
    fiadosVencidos: { cantidad: vencidos.cantidad, total: vencidos.monto },
    cajaAbierta: ventas.some((venta) => venta.estado !== 'anulada') && !cierres.some((cierre) => cierre.fecha >= inicioHoy && cierre.alcance !== 'turno'),
    reponer: porReponer(productos, 10).nombres,
    cumpleHoy: cumplesProximos(clientes, ahora, 0).map((item) => item.cliente.nombre),
  }
}

/** Revisa y avisa lo que corresponda (cada aviso, una vez por día). */
export async function revisarAvisos(ahora = Date.now()): Promise<number> {
  if (!avisosActivos()) return 0
  const yaAvisados = avisadosHoy(ahora)
  const nuevos = avisosPendientes(await datosParaAvisos(ahora), ahora, yaAvisados, formatearPesos)
  for (const aviso of nuevos) {
    await mostrarAviso(aviso.titulo, aviso.cuerpo, aviso.url, aviso.id)
    yaAvisados.add(aviso.id)
  }
  if (nuevos.length > 0) marcarAvisados(ahora, yaAvisados)
  return nuevos.length
}

/** Mientras la app está abierta: revisa al entrar, al volver a la app y
 *  cada media hora. */
export function useAvisosLocales(activo: boolean): void {
  useEffect(() => {
    if (!activo || !avisosSoportados()) return
    const revisar = () => { void revisarAvisos().catch(() => undefined) }
    const primera = window.setTimeout(revisar, 4000)
    const intervalo = window.setInterval(revisar, CADA)
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearTimeout(primera)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [activo])
}
