'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ItemVenta, UUID } from '@/dominio/tipos'
import { nuevoId } from '@/dominio/id'
import { db } from '@/datos/local/db'
import {
  conRenglones, limpiarNombre, MAX_VENTAS_ABIERTAS, ventaConContenido, ventaNueva,
  type Descuento, type VentaAbierta,
} from '@/dominio/ventaAbierta'

const CLAVE_ACTIVA = 'libreta.ventaActiva'

interface Estado {
  ventas: VentaAbierta[]
  activaId: UUID
}

function leerActiva(): string | null {
  try { return window.localStorage.getItem(CLAVE_ACTIVA) } catch { return null }
}

function recordarActiva(id: UUID) {
  try { window.localStorage.setItem(CLAVE_ACTIVA, id) } catch { /* sin almacenamiento: se abre la última tocada */ }
}

/** Las ventas abiertas del mostrador. Cada cambio se guarda en el aparato en
 *  el momento: cambiar de pantalla, recargar o cerrar la app no pierde lo que
 *  se lleva armado. Una venta vacía y sin nombre no se guarda. */
export function useVentasAbiertas() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const actual = useRef<Estado | null>(null)
  // Las escrituras salen en el mismo orden en que se pidieron.
  const escritura = useRef<Promise<unknown>>(Promise.resolve())

  const aplicar = useCallback((siguiente: Estado, guardar: VentaAbierta[] = [], borrar: UUID[] = []) => {
    actual.current = siguiente
    setEstado(siguiente)
    recordarActiva(siguiente.activaId)
    escritura.current = escritura.current.then(async () => {
      try {
        for (const venta of guardar) {
          if (ventaConContenido(venta)) await db.ventasAbiertas.put(venta)
          else await db.ventasAbiertas.delete(venta.id)
        }
        if (borrar.length > 0) await db.ventasAbiertas.bulkDelete(borrar)
      } catch (error) {
        console.error('No se pudo guardar la venta en curso', error)
      }
    })
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const filas = await db.ventasAbiertas.toArray()
      if (!vivo) return
      const ventas = filas.sort((a, b) => a.creada - b.creada)
      if (ventas.length === 0) ventas.push(ventaNueva(nuevoId()))
      const recordada = leerActiva()
      const masReciente = [...ventas].sort((a, b) => b.actualizada - a.actualizada)[0]
      const activaId = ventas.find((venta) => venta.id === recordada)?.id ?? masReciente.id
      actual.current = { ventas, activaId }
      setEstado(actual.current)
    })()
    return () => { vivo = false }
  }, [])

  const cambiarActiva = useCallback((cambio: (venta: VentaAbierta) => VentaAbierta) => {
    const previo = actual.current
    if (!previo) return
    const venta = previo.ventas.find((candidata) => candidata.id === previo.activaId)
    if (!venta) return
    const nueva = cambio(venta)
    if (nueva === venta) return
    aplicar({ ...previo, ventas: previo.ventas.map((candidata) => (candidata.id === venta.id ? nueva : candidata)) }, [nueva])
  }, [aplicar])

  const setItems = useCallback((cambio: ItemVenta[] | ((actuales: ItemVenta[]) => ItemVenta[])) => {
    cambiarActiva((venta) => conRenglones(venta, typeof cambio === 'function' ? cambio(venta.items) : cambio))
  }, [cambiarActiva])

  const setNombre = useCallback((texto: string) => {
    cambiarActiva((venta) => ({ ...venta, nombre: limpiarNombre(texto), actualizada: Date.now() }))
  }, [cambiarActiva])

  const setDescuentoItem = useCallback((productoId: UUID, descuento: Descuento | null) => {
    cambiarActiva((venta) => {
      const descuentoItems = { ...venta.descuentoItems }
      if (descuento) descuentoItems[productoId] = descuento
      else delete descuentoItems[productoId]
      return { ...venta, descuentoItems, actualizada: Date.now() }
    })
  }, [cambiarActiva])

  const setDescuentoTotal = useCallback((descuento: Descuento | null) => {
    cambiarActiva((venta) => ({ ...venta, descuentoTotal: descuento, actualizada: Date.now() }))
  }, [cambiarActiva])

  /** Suelta la venta activa si quedó vacía, para que no se acumulen pestañas
   *  en blanco al ir de una a otra. */
  const sinVaciaActiva = (previo: Estado): { ventas: VentaAbierta[]; sacada: UUID | null } => {
    const venta = previo.ventas.find((candidata) => candidata.id === previo.activaId)
    if (venta && !ventaConContenido(venta) && previo.ventas.length > 1) {
      return { ventas: previo.ventas.filter((candidata) => candidata.id !== venta.id), sacada: venta.id }
    }
    return { ventas: previo.ventas, sacada: null }
  }

  /** Abre una venta nueva y deja la actual guardada. Devuelve `false` si ya
   *  hay demasiadas abiertas; si la actual está vacía no hace falta otra. */
  const nueva = useCallback((): boolean => {
    const previo = actual.current
    if (!previo) return false
    const venta = previo.ventas.find((candidata) => candidata.id === previo.activaId)
    if (venta && !ventaConContenido(venta)) return true
    if (previo.ventas.length >= MAX_VENTAS_ABIERTAS) return false
    const creada = ventaNueva(nuevoId())
    aplicar({ ventas: [...previo.ventas, creada], activaId: creada.id })
    return true
  }, [aplicar])

  const elegir = useCallback((id: UUID) => {
    const previo = actual.current
    if (!previo || previo.activaId === id || !previo.ventas.some((venta) => venta.id === id)) return
    const { ventas, sacada } = sinVaciaActiva(previo)
    aplicar({ ventas, activaId: id }, [], sacada ? [sacada] : [])
  }, [aplicar])

  /** Descarta una venta (cobrada o abandonada). Siempre queda al menos una. */
  const cerrar = useCallback((id: UUID) => {
    const previo = actual.current
    if (!previo) return
    const indice = previo.ventas.findIndex((venta) => venta.id === id)
    if (indice < 0) return
    const restantes = previo.ventas.filter((venta) => venta.id !== id)
    if (restantes.length === 0) {
      const creada = ventaNueva(nuevoId())
      aplicar({ ventas: [creada], activaId: creada.id }, [], [id])
      return
    }
    const activaId = previo.activaId === id ? restantes[Math.max(0, indice - 1)].id : previo.activaId
    aplicar({ ventas: restantes, activaId }, [], [id])
  }, [aplicar])

  const activa = estado ? estado.ventas.find((venta) => venta.id === estado.activaId) ?? null : null

  return {
    cargada: estado !== null && activa !== null,
    ventas: estado?.ventas ?? [],
    activa,
    items: activa?.items ?? [],
    setItems,
    setNombre,
    setDescuentoItem,
    setDescuentoTotal,
    nueva,
    elegir,
    cerrar,
  }
}
