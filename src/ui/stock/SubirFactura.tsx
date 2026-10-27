'use client'

import { useRef, useState } from 'react'
import { repos } from '@/datos/local/repos'
import { cliente } from '@/datos/nube/cliente'
import { formatearPesos } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'
import { IconoHistorial, IconoSubir } from '@/ui/sistema/iconos'

interface ItemLeido {
  nombre: string
  cantidad: number
  costoUnitario: number
}

/** La foto nunca escribe sola en el stock: el almacenero revisa fila por
 *  fila y confirma. Un precio mal leído se arregla acá, no después. */
export function SubirFactura() {
  const archivo = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ItemLeido[] | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [avisoTipo, setAvisoTipo] = useState<'error' | 'success'>('error')
  const [proveedor, setProveedor] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  function mostrarAviso(mensaje: string, tipo: 'error' | 'success' = 'error') {
    setAviso(mensaje)
    setAvisoTipo(tipo)
  }

  async function leer(archivo: File) {
    setLeyendo(true)
    setAviso(null)
    try {
      const imagenBase64 = await new Promise<string>((listo, falla) => {
        const lector = new FileReader()
        lector.onload = () => listo(String(lector.result))
        lector.onerror = () => falla(new Error('no se pudo leer el archivo'))
        lector.readAsDataURL(archivo)
      })

      const sesion = await cliente?.auth.getSession()
      const token = sesion?.data.session?.access_token
      const respuesta = await fetch('/api/factura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imagenBase64 }),
      })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        mostrarAviso(datos.error ?? 'No se pudo leer la factura.')
        return
      }
      if (!Array.isArray(datos.items) || datos.items.length === 0) {
        mostrarAviso('No se reconoció ningún producto. Probá con una foto más nítida.')
        return
      }
      setItems(datos.items)
    } catch {
      mostrarAviso('No se pudo leer la factura. Cargala a mano y seguí vendiendo.')
    } finally {
      setLeyendo(false)
    }
  }

  async function confirmar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    if (!items) return
    const invalido = items.find((item) => !Number.isInteger(item.cantidad) || item.cantidad <= 0 || !Number.isFinite(item.costoUnitario) || item.costoUnitario < 0)
    if (invalido) {
      mostrarAviso(`Revisá “${invalido.nombre}”: la cantidad debe ser mayor a cero y el costo no puede ser negativo.`)
      return
    }

    setConfirmando(true)
    setAviso(null)
    try {
      const productos = await repos.productos.todos()
      const ingresos: { productoId: string; cantidad: number; costoUnitario: number }[] = []
      for (const item of items) {
        const existente = productos.find(
          (producto) => producto.nombre.toLowerCase() === item.nombre.toLowerCase(),
        )
        const producto =
          existente ??
          (await repos.productos.guardar({
            nombre: item.nombre,
            codigoBarras: null,
            costo: item.costoUnitario,
            precio: 0,
            stock: 0,
            stockMinimo: 0,
          }))

        ingresos.push({ productoId: producto.id, cantidad: item.cantidad, costoUnitario: item.costoUnitario })
      }

      await repos.ingresos.registrar({ proveedor: proveedor.trim() || null, origen: 'foto', items: ingresos })

      setItems(null)
      setProveedor('')
      mostrarAviso('Listo, se sumó al stock.', 'success')
    } catch {
      mostrarAviso('No se pudo sumar la factura al stock. Revisá la conexión e intentá de nuevo.')
    } finally {
      setConfirmando(false)
    }
  }

  function cambiar(indice: number, campo: 'cantidad' | 'costoUnitario', valor: string) {
    setItems((actuales) =>
      actuales!.map((item, i) =>
        i === indice ? { ...item, [campo]: Number(valor) || 0 } : item,
      ),
    )
  }

  return (
    <div>
      <div className="invoice-upload-picker">
        <span className="invoice-upload-icon"><IconoSubir /></span>
        <span className="invoice-upload-copy"><strong>{leyendo ? 'Leyendo factura…' : 'Leer una factura'}</strong><small>Elegí una foto clara y revisá los datos antes de sumar.</small></span>
        <button type="button" className="button-with-icon invoice-upload-button" disabled={leyendo} onClick={() => archivo.current?.click()}>
          <IconoSubir /> {leyendo ? 'Procesando' : 'Elegir foto'}
        </button>
        <input
          ref={archivo}
          type="file" accept="image/*" capture="environment"
          aria-label="Foto de la factura"
          className="sr-only"
          onChange={(evento) => {
            const foto = evento.target.files?.[0]
            if (foto) void leer(foto)
            evento.currentTarget.value = ''
          }}
        />
      </div>

      {leyendo && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Leyendo la factura…
        </p>
      )}

      {aviso && (
        <p role={avisoTipo === 'success' ? 'status' : 'alert'} className={`form-message ${avisoTipo === 'success' ? 'form-message-success' : 'form-message-error'}`}>{aviso}</p>
      )}

      {items && (
        <form className="form-shell form-card invoice-review-form mt-3" onSubmit={(evento) => void confirmar(evento)}>
          <div className="form-section-heading">
            <span className="form-intro-icon" aria-hidden="true"><IconoHistorial /></span>
            <div><h3>Revisá la factura</h3><p>La lectura es una sugerencia: corregí cantidades y costos antes de confirmar.</p></div>
          </div>
          <label className="form-field">
            <span className="form-field-label">Proveedor <em>opcional</em></span>
            <input aria-label="Proveedor de la factura" placeholder="Ej. Mayorista El Sol" className="form-input" value={proveedor} onChange={(evento) => setProveedor(evento.target.value)} />
          </label>
          <div className="invoice-items-heading"><span>Producto</span><span>Unidades</span><span>Costo unitario</span></div>
          <ul className="invoice-items-list">
            {items.map((item, indice) => (
              <li
                key={`${item.nombre}-${indice}`}
                className="invoice-item-row"
              >
                <span className="invoice-item-name">{item.nombre}</span>
                <label className="invoice-item-field"><span className="sr-only">Unidades de {item.nombre}</span><input aria-label={`Cantidad de ${item.nombre}`} inputMode="numeric" className="form-input form-input-small tabular" value={item.cantidad} onChange={(evento) => cambiar(indice, 'cantidad', evento.target.value)} /></label>
                <label className="invoice-item-field invoice-cost-field"><span className="invoice-cost-prefix" aria-hidden="true">$</span><span className="sr-only">Costo unitario de {item.nombre}</span><input aria-label={`Costo de ${item.nombre}`} inputMode="decimal" className="form-input form-input-small tabular" value={item.costoUnitario / 100} onChange={(evento) => cambiar(indice, 'costoUnitario', String(Number(evento.target.value) * 100))} /></label>
              </li>
            ))}
          </ul>
          <div className="invoice-total-card"><span>Total de la compra</span><strong>{formatearPesos(items.reduce((total, item) => total + item.costoUnitario * item.cantidad, 0))}</strong></div>
          <div className="form-actions">
            <Boton type="submit" variante="principal" disabled={confirmando}>{confirmando ? 'Sumando…' : 'Sumar al stock'}</Boton>
            <Boton type="button" variante="secundario" onClick={() => setItems(null)}>Cancelar</Boton>
          </div>
        </form>
      )}
    </div>
  )
}
