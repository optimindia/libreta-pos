'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
import { accesoSaasObligatorio } from '@/datos/nube/acceso'
import { crearRespaldo } from '@/datos/nube/sesion'
import { Boton } from '@/ui/sistema/Boton'
import { IconoNube } from '@/ui/sistema/iconos'

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
      <p className="mt-6 text-[12px]" style={{ color: 'var(--tenue)' }}>
        Tus datos están guardados en este celular. El respaldo en la nube todavía no está activado.
      </p>
    )
  }

  return (
    <form className="form-shell form-card mt-6" onSubmit={(evento) => void respaldar(evento)}>
      <div className="form-intro">
        <span className="form-intro-icon" aria-hidden="true"><IconoNube /></span>
        <div><strong>Guardá una copia en la nube</strong><p>Tu negocio queda protegido aunque cambies o pierdas el celular.</p></div>
      </div>
      <p className="form-callout">
        Ya tenés {datos.productos} productos y {datos.ventas} ventas anotadas. Con tu teléfono y un
        PIN te guardamos una copia, por si el celu se pierde o se rompe.
      </p>
      {datos.negocio?.negocioId ? (
        <p className="form-message form-message-success" role="status">
          Ya tenés tu copia guardada. Se actualiza sola cuando hay señal.
        </p>
      ) : (
        <>
          <label className="form-field">
            <span className="form-field-label">Teléfono <em>para recuperar tu negocio</em></span>
            <input
            aria-label="Tu teléfono"
            inputMode="tel"
            placeholder="Ej. 261 555 1234"
            className="form-input tabular"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            />
            <span className="form-field-help">Usá el mismo número si después querés entrar desde otro aparato.</span>
          </label>
          <label className="form-field">
            <span className="form-field-label">PIN <em>6 números · privado</em></span>
            <input
            aria-label="PIN de 6 números"
            inputMode="numeric"
            placeholder="PIN de 6 números"
            type="password"
            autoComplete="new-password"
            className="form-input tabular"
            value={pin}
            onChange={(evento) => setPin(evento.target.value)}
            />
            <span className="form-field-help">Elegí un PIN que puedas recordar y no compartas.</span>
          </label>
          <Boton
            variante="principal"
            type="submit"
            className="w-full !py-3 !text-[13px]"
            disabled={trabajando}
          >
            {trabajando ? 'Guardando…' : 'Crear mi copia de seguridad'}
          </Boton>
          {aviso && (
            <p className="form-message form-message-error" role="alert">{aviso}</p>
          )}
        </>
      )}
    </form>
  )
}
