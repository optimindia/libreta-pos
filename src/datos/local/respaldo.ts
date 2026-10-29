import { db } from './db'
import { normalizarFunciones } from '@/dominio/funciones'
import type { PreferenciasNegocio } from '@/dominio/tipos'
import {
  ESQUEMA_ACTUAL, TABLAS_DATOS, VERSION_COPIA, planificarFusion, validarCopiaObjeto,
  type Copia, type FilasActuales, type PlanFusion, type TablaDatos,
} from '@/dominio/copia'

export type RespaldoLocal = Copia

/** Copia completa desde Dexie. La cola de sincronización queda afuera a
 *  propósito: es estado de este aparato, no datos del negocio. */
export async function crearRespaldoLocal(): Promise<RespaldoLocal> {
  const [productos, ventas, clientes, fiados, fiadoPagos, ingresos, cierres, negocio, movimientosCaja, pedidos, preferencias] =
    await Promise.all([
      db.productos.toArray(), db.ventas.toArray(), db.clientes.toArray(), db.fiados.toArray(),
      db.fiadoPagos.toArray(), db.ingresos.toArray(), db.cierres.toArray(), db.negocio.toArray(),
      db.movimientosCaja.toArray(), db.pedidos.toArray(), db.preferencias.toArray(),
    ])
  return {
    version: VERSION_COPIA, esquema: ESQUEMA_ACTUAL, creadoEn: Date.now(),
    productos, ventas, clientes, fiados, fiadoPagos, ingresos, cierres, negocio, movimientosCaja, pedidos, preferencias,
  } as unknown as RespaldoLocal
}

export function validarRespaldoLocal(valor: unknown): valor is RespaldoLocal {
  return validarCopiaObjeto(valor).ok
}

async function filasActuales(): Promise<FilasActuales> {
  const entradas = await Promise.all(
    TABLAS_DATOS.map(async (tabla) => [tabla, await db[tabla].toArray()] as const),
  )
  return Object.fromEntries(entradas) as FilasActuales
}

/** Qué pasaría al restaurar, sin tocar nada: sirve para mostrar el resumen. */
export async function planRestauracion(respaldo: RespaldoLocal, reemplazar = false): Promise<PlanFusion> {
  return planificarFusion(respaldo, await filasActuales(), { reemplazar })
}

/** Restaura fusionando por id. Con `reemplazar` borra además lo que la copia
 *  no trae (el pedido explícito de la persona). Nunca toca la cola de sync ni
 *  el vínculo del aparato con la nube. Devuelve cuántos registros escribió. */
export async function restaurarRespaldoLocal(respaldo: RespaldoLocal, opciones: { reemplazar?: boolean } = {}): Promise<number> {
  if (!validarRespaldoLocal(respaldo)) throw new Error('respaldo inválido')
  let restauradas = 0
  await db.transaction('rw', [db.productos, db.ventas, db.clientes, db.fiados, db.fiadoPagos, db.ingresos, db.cierres, db.movimientosCaja, db.pedidos, db.preferencias, db.negocio], async () => {
    const actual = await db.negocio.get('unico')
    const actualPreferencias = await db.preferencias.get('unico')
    const plan = planificarFusion(respaldo, await filasActuales(), { reemplazar: opciones.reemplazar })
    for (const tabla of TABLAS_DATOS as readonly TablaDatos[]) {
      const p = plan.tablas[tabla]
      const aEscribir = [...p.agregar, ...p.actualizar]
      const destino = db[tabla] as unknown as { bulkPut(filas: unknown[]): Promise<unknown> }
      if (aEscribir.length > 0) await destino.bulkPut(aEscribir)
      if (p.borrar.length > 0) await db[tabla].bulkDelete(p.borrar)
      restauradas += aEscribir.length
    }
    const filaPreferencias = respaldo.preferencias?.[0] as unknown as Partial<PreferenciasNegocio> | undefined
    if (
      filaPreferencias &&
      typeof filaPreferencias.actualizadoEn === 'number' &&
      (!actualPreferencias || actualPreferencias.actualizadoEn <= filaPreferencias.actualizadoEn)
    ) {
      await db.preferencias.put({
        id: 'unico',
        negocioId: actual?.negocioId ?? filaPreferencias.negocioId,
        funciones: normalizarFunciones(filaPreferencias.funciones),
        actualizadoEn: filaPreferencias.actualizadoEn,
      })
      restauradas++
    }
    const filaNegocio = respaldo.negocio[0]
    if (filaNegocio) {
      // La identidad visual viene de la copia; el vínculo con la nube, el rol y
      // la suscripción son de este aparato y no se pisan.
      const { nombre, logo, color } = filaNegocio as unknown as { nombre: string; logo: string | null; color: string | null }
      await db.negocio.put((actual ? { ...actual, nombre, logo, color } : filaNegocio) as never)
      restauradas++
    }
  })
  return restauradas
}
