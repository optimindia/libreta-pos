'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { Boton } from '@/ui/sistema/Boton'

const VENTAS_PARA_OFRECER = 10
const PRODUCTOS_PARA_OFRECER = 5

/** El registro se pide cuando el almacenero ya tiene algo que perder,
 *  no antes: pedirlo el primer minuto mata la demostración. */
export function convieneRespaldarAhora(
  cantidadVentas: number,
  cantidadProductos: number,
): boolean {
  return cantidadVentas >= VENTAS_PARA_OFRECER || cantidadProductos >= PRODUCTOS_PARA_OFRECER
}

export function Respaldo() {
  const datos = useLiveQuery(async () => ({
    ventas: await db.ventas.count(),
    productos: await db.productos.count(),
  }))

  if (!datos) return null
  if (!convieneRespaldarAhora(datos.ventas, datos.productos)) return null

  if (!nubeActiva()) {
    return (
      <p className="mt-6 text-[12px]" style={{ color: 'var(--tenue)' }}>
        Tus datos están guardados en este celular. El respaldo en la nube todavía no está activado.
      </p>
    )
  }

  return (
    <div className="mt-6 rounded-xl px-3.5 py-3.5" style={{ background: 'var(--chip-fondo)' }}>
      <p className="text-[13px] font-semibold">Guardá una copia</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
        Ya tenés {datos.productos} productos y {datos.ventas} ventas anotadas. Con tu teléfono y un
        PIN te guardamos una copia, por si el celu se pierde o se rompe.
      </p>
      <Boton variante="principal" className="mt-3 w-full !py-3 !text-[13px]">
        Crear mi copia de seguridad
      </Boton>
    </div>
  )
}
