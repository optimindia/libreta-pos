'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { crearRespaldo } from '@/datos/nube/sesion'
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
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const datos = useLiveQuery(async () => ({
    ventas: await db.ventas.count(),
    productos: await db.productos.count(),
    negocio: await db.negocio.get('unico'),
  }))

  async function respaldar() {
    setTrabajando(true)
    setAviso(null)
    const resultado = await crearRespaldo(telefono, pin)
    setAviso(
      resultado.ok
        ? 'Listo. Tus datos ahora se guardan también en la nube.'
        : resultado.motivo,
    )
    setTrabajando(false)
  }

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
      {datos.negocio?.negocioId ? (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--verde)' }}>
          Ya tenés tu copia guardada. Se actualiza sola cuando hay señal.
        </p>
      ) : (
        <>
          <input
            aria-label="Tu teléfono"
            inputMode="tel"
            placeholder="Tu teléfono (261...)"
            className="tabular mt-3 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
          <input
            aria-label="PIN de 6 números"
            inputMode="numeric"
            placeholder="PIN de 6 números"
            className="tabular mt-2 w-full rounded-xl px-3 py-2.5 text-[14px]"
            style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}
            value={pin}
            onChange={(evento) => setPin(evento.target.value)}
          />
          <Boton
            variante="principal"
            className="mt-3 w-full !py-3 !text-[13px]"
            disabled={trabajando}
            onClick={respaldar}
          >
            {trabajando ? 'Guardando…' : 'Crear mi copia de seguridad'}
          </Boton>
          {aviso && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--ambar)' }}>{aviso}</p>
          )}
        </>
      )}
    </div>
  )
}
