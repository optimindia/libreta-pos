'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { accesoSaasObligatorio } from '@/datos/nube/acceso'
import { crearRespaldo } from '@/datos/nube/sesion'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

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

  async function respaldar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    setTrabajando(true)
    setAviso(null)
    try {
      const resultado = await crearRespaldo(telefono, pin)
      setAviso(
        resultado.ok
          ? 'Listo. Tus datos ahora se guardan también en la nube.'
          : resultado.motivo,
      )
    } catch {
      setAviso('No se pudo crear el respaldo. Probá de nuevo cuando tengas señal.')
    } finally {
      setTrabajando(false)
    }
  }

  if (!datos) return null
  if (accesoSaasObligatorio()) return null
  if (!convieneRespaldarAhora(datos.ventas, datos.productos)) return null

  if (!nubeActiva()) {
    return (
      <Tarjeta como="section" className="f-config-bloque">
        <p className="f-dato">Tus datos están guardados en este celular. El respaldo en la nube todavía no está activado.</p>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-nube">
      <form className="f-config-form" onSubmit={(evento) => void respaldar(evento)}>
        <div>
          <h2 id="config-nube" className="f-seccion">Guardá una copia en la nube</h2>
          <p className="f-dato">Tu negocio queda protegido aunque cambies o pierdas el celular.</p>
        </div>
        <p className="f-texto">
          Ya tenés {datos.productos} productos y {datos.ventas} ventas anotadas. Con tu teléfono y un
          PIN te guardamos una copia, por si el celu se pierde o se rompe.
        </p>
        {datos.negocio?.negocioId ? (
          <p className="f-aviso f-config-ok" role="status">
            Ya tenés tu copia guardada. Se actualiza sola cuando hay señal.
          </p>
        ) : (
          <>
            <label className="f-campo">
              <span>Teléfono <em>para recuperar tu negocio</em></span>
              <input
                aria-label="Tu teléfono"
                inputMode="tel"
                placeholder="Ej. 261 555 1234"
                className="f-entrada"
                value={telefono}
                onChange={(evento) => setTelefono(evento.target.value)}
              />
              <small className="f-config-ayuda">Usá el mismo número si después querés entrar desde otro aparato.</small>
            </label>
            <label className="f-campo">
              <span>PIN <em>6 números · privado</em></span>
              <input
                aria-label="PIN de 6 números"
                inputMode="numeric"
                placeholder="PIN de 6 números"
                type="password"
                autoComplete="new-password"
                className="f-entrada"
                value={pin}
                onChange={(evento) => setPin(evento.target.value)}
              />
              <small className="f-config-ayuda">Elegí un PIN que puedas recordar y no compartas.</small>
            </label>
            {aviso && (
              <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>
            )}
            <Boton variante="secundario" type="submit" ancho disabled={trabajando}>
              {trabajando ? 'Guardando…' : 'Crear mi copia de seguridad'}
            </Boton>
          </>
        )}
      </form>
    </Tarjeta>
  )
}
