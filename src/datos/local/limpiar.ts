import { db } from './db'

/** Borra la copia local de un negocio al cerrar sesión o cambiar de cuenta.
 *  La nube sigue siendo la fuente de recuperación; esto evita que un aparato
 *  compartido muestre datos del usuario anterior. */
export async function limpiarDatosLocales(): Promise<void> {
  await db.transaction(
    'rw',
    [db.productos, db.ventas, db.clientes, db.fiados, db.fiadoPagos, db.ingresos, db.cierres, db.movimientosCaja, db.pedidos, db.preferencias, db.negocio, db.cola],
    async () => {
      await Promise.all([
        db.productos.clear(),
        db.ventas.clear(),
        db.clientes.clear(),
        db.fiados.clear(),
        db.fiadoPagos.clear(),
        db.ingresos.clear(),
        db.cierres.clear(),
        db.movimientosCaja.clear(),
        db.pedidos.clear(),
        db.preferencias.clear(),
        db.negocio.clear(),
        db.cola.clear(),
      ])
    },
  )
}
