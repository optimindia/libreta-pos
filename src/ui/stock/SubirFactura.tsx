'use client'

import { useRef, useState } from 'react'
import { repos } from '@/datos/local/repos'
import { cliente } from '@/datos/nube/cliente'
import { formatearPesos } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Hoja } from '@/ui/sistema/Hoja'
import { IconoSubir } from '@/ui/sistema/iconos'

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
      // Se revisa antes de crear nada: si una cantidad está mal, no queda un
      // producto nuevo a medio cargar.
      if (items.some((item) => !Number.isInteger(item.cantidad) || item.cantidad <= 0)) {
        mostrarAviso('Revisá las cantidades: cada producto tiene que entrar con un número entero mayor a cero.')
        return
      }
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
    <div className="f-stock-factura">
      <Tarjeta className="f-stock-subir">
        <span className="f-stock-escanear-icono" aria-hidden="true"><IconoSubir /></span>
        <span className="f-stock-escanear-texto"><strong>{leyendo ? 'Leyendo factura…' : 'Leer una factura'}</strong><small>Elegí una foto clara y revisá los datos antes de sumar.</small></span>
        <Boton variante="secundario" disabled={leyendo} onClick={() => archivo.current?.click()}>
          {leyendo ? 'Procesando' : 'Elegir foto'}
        </Boton>
        <input
          ref={archivo}
          type="file" accept="image/*" capture="environment"
          aria-label="Foto de la factura"
          className="f-sr"
          onChange={(evento) => {
            const foto = evento.target.files?.[0]
            if (foto) void leer(foto)
            evento.currentTarget.value = ''
          }}
        />
      </Tarjeta>

      {aviso && !items && (
        <p role={avisoTipo === 'success' ? 'status' : 'alert'} className={avisoTipo === 'success' ? 'f-aviso f-stock-ok' : 'f-aviso'} data-tono={avisoTipo === 'success' ? undefined : 'ambar'}>{aviso}</p>
      )}

      <Hoja abierta={items !== null} onCerrar={() => setItems(null)} titulo="Revisá la factura">
        {items && <form className="f-stock-form" onSubmit={(evento) => void confirmar(evento)}>
          <p className="f-hoja-ayuda">La lectura es una sugerencia: corregí cantidades y costos antes de confirmar.</p>
          <label className="f-campo">
            <span>Proveedor <em>opcional</em></span>
            <input aria-label="Proveedor de la factura" placeholder="Ej. Mayorista El Sol" className="f-entrada" value={proveedor} onChange={(evento) => setProveedor(evento.target.value)} />
          </label>
          <ul className="f-stock-items">
            {items.map((item, indice) => (
              <li key={`${item.nombre}-${indice}`} className="f-stock-item">
                <span className="f-renglon-titulo">{item.nombre}</span>
                <label className="f-campo"><span>Unidades</span><input aria-label={`Cantidad de ${item.nombre}`} inputMode="numeric" className="f-entrada" value={item.cantidad} onChange={(evento) => cambiar(indice, 'cantidad', evento.target.value)} /></label>
                <label className="f-campo"><span>Costo unitario</span><div className="f-stock-prefijo"><span aria-hidden="true">$</span><input aria-label={`Costo de ${item.nombre}`} inputMode="decimal" className="f-entrada" value={item.costoUnitario / 100} onChange={(evento) => cambiar(indice, 'costoUnitario', String(Number(evento.target.value) * 100))} /></div></label>
              </li>
            ))}
          </ul>
          <div className="f-stock-total"><span className="f-renglon-titulo">Total de la compra</span><strong className="f-plata-36">{formatearPesos(items.reduce((total, item) => total + item.costoUnitario * item.cantidad, 0))}</strong></div>
          {aviso && <p role="alert" className="f-aviso" data-tono="ambar">{aviso}</p>}
          <div className="f-stock-acciones">
            <Boton type="submit" variante="principal" disabled={confirmando}>{confirmando ? 'Sumando…' : 'Sumar al stock'}</Boton>
            <Boton type="button" variante="secundario" onClick={() => setItems(null)}>Cancelar</Boton>
          </div>
        </form>}
      </Hoja>
    </div>
  )
}
