'use client'

import { useState } from 'react'
import { repos } from '@/datos/local/repos'
import { formatearPesos } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'

interface ItemLeido {
  nombre: string
  cantidad: number
  costoUnitario: number
}

/** La foto nunca escribe sola en el stock: el almacenero revisa fila por
 *  fila y confirma. Un precio mal leído se arregla acá, no después. */
export function SubirFactura() {
  const [items, setItems] = useState<ItemLeido[] | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

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

      const respuesta = await fetch('/api/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagenBase64 }),
      })
      const datos = await respuesta.json()

      if (!respuesta.ok) {
        setAviso(datos.error ?? 'no se pudo leer la factura')
        return
      }
      if (datos.items.length === 0) {
        setAviso('No se reconoció ningún producto. Probá con una foto más nítida.')
        return
      }
      setItems(datos.items)
    } catch {
      setAviso('No se pudo leer la factura. Cargala a mano y seguí vendiendo.')
    } finally {
      setLeyendo(false)
    }
  }

  async function confirmar() {
    if (!items) return
    const productos = await repos.productos.todos()

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

      await repos.ingresos.registrar({
        proveedor: null,
        origen: 'foto',
        items: [{ productoId: producto.id, cantidad: item.cantidad, costoUnitario: item.costoUnitario }],
      })
    }

    setItems(null)
    setAviso('Listo, se sumó al stock.')
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
      <label>
        <span className="sr-only">Foto de la factura</span>
        <input
          type="file" accept="image/*" capture="environment"
          aria-label="Foto de la factura"
          className="w-full text-[12px]"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0]
            if (archivo) leer(archivo)
          }}
        />
      </label>

      {leyendo && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--tenue)' }}>
          Leyendo la factura…
        </p>
      )}

      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ambar)' }}>{aviso}</p>
      )}

      {items && (
        <div className="mt-3">
          <p className="text-[12px]" style={{ color: 'var(--tenue)' }}>
            Revisá antes de sumarlo al stock:
          </p>
          <ul className="mt-2">
            {items.map((item, indice) => (
              <li
                key={`${item.nombre}-${indice}`}
                className="flex items-center gap-2 py-2"
                style={{ borderBottom: '1px solid var(--linea)' }}
              >
                <span className="flex-1 text-[13px]">{item.nombre}</span>
                <input
                  aria-label={`Cantidad de ${item.nombre}`}
                  inputMode="numeric"
                  className="tabular w-14 rounded-lg px-2 py-1 text-[13px]"
                  style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}
                  value={item.cantidad}
                  onChange={(evento) => cambiar(indice, 'cantidad', evento.target.value)}
                />
                <input
                  aria-label={`Costo de ${item.nombre}`}
                  inputMode="decimal"
                  className="tabular w-20 rounded-lg px-2 py-1 text-[13px]"
                  style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}
                  value={item.costoUnitario / 100}
                  onChange={(evento) =>
                    cambiar(indice, 'costoUnitario', String(Number(evento.target.value) * 100))
                  }
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--tenue)' }}>
            Total de la compra:{' '}
            {formatearPesos(
              items.reduce((total, item) => total + item.costoUnitario * item.cantidad, 0),
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <Boton variante="principal" className="flex-1 !py-3 !text-[13px]" onClick={confirmar}>
              Sumar al stock
            </Boton>
            <Boton
              variante="secundario"
              className="flex-1 !py-3 !text-[13px]"
              onClick={() => setItems(null)}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}
