'use client'

import { useRef, useState } from 'react'
import type { Producto } from '@/dominio/tipos'
import { normalizarTexto } from '@/dominio/validaciones'
import { descargarCsv, productosACsv, productosDesdeCsv } from '@/datos/local/csv'
import { repos } from '@/datos/local/repos'
import { Boton } from '@/ui/sistema/Boton'
import { IconoDescargar, IconoSubir } from '@/ui/sistema/iconos'

export function HerramientasCatalogo({ productos }: { productos: Producto[] }) {
  const archivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)

  function exportar() {
    descargarCsv(`catalogo-${new Date().toISOString().slice(0, 10)}.csv`, productosACsv(productos))
    setAviso(`Se exportaron ${productos.length} productos.`)
  }

  async function importar(file: File) {
    setImportando(true)
    try {
      const candidatos = productosDesdeCsv(await file.text())
      const actuales = await repos.productos.todos()
      let guardados = 0
      let omitidos = 0
      for (const candidato of candidatos) {
        const duplicado = actuales.some((producto) => normalizarTexto(producto.nombre) === normalizarTexto(candidato.nombre) || (candidato.codigoBarras !== null && producto.codigoBarras === candidato.codigoBarras))
        if (duplicado) {
          omitidos += 1
          continue
        }
        const guardado = await repos.productos.guardar(candidato)
        actuales.push(guardado)
        guardados += 1
      }
      setAviso(candidatos.length === 0 ? 'El archivo no tiene filas válidas.' : `Importados ${guardados} productos${omitidos > 0 ? ` · ${omitidos} duplicados omitidos` : ''}.`)
    } catch {
      setAviso('No se pudo leer el CSV. Usá el formato exportado por la app.')
    } finally {
      setImportando(false)
      if (archivo.current) archivo.current.value = ''
    }
  }

  return (
    <section className="mt-6 rounded-2xl px-3.5 py-3" style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)' }}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Herramientas del catálogo</h2>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--tenue)' }}>Mové tus productos entre dispositivos con un CSV. Los duplicados no se pisan.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Boton variante="secundario" className="button-with-icon !py-2.5 !text-[11px]" onClick={exportar}><IconoDescargar /> Exportar CSV</Boton>
        <Boton variante="principal" className="button-with-icon !py-2.5 !text-[11px]" disabled={importando} onClick={() => archivo.current?.click()}>{importando ? 'Importando…' : <><IconoSubir /> Importar CSV</>}</Boton>
      </div>
      <input ref={archivo} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV del catálogo" onChange={(evento) => { const file = evento.target.files?.[0]; if (file) void importar(file) }} />
      {aviso && <p role="status" className="mt-2 text-[11px]" style={{ color: 'var(--verde)' }}>{aviso}</p>}
    </section>
  )
}
