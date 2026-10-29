// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TEXTOS, noSePudo } from '@/ui/sistema/textos'

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

const fuente = archivos('src/ui')
  .filter((ruta) => !ruta.endsWith('textos.ts'))
  .map((ruta) => [ruta, readFileSync(ruta, 'utf8')] as const)

describe('textos centralizados', () => {
  it('un solo verbo para la misma acción', () => {
    expect(TEXTOS.agregarCliente).toBe('Agregar cliente')
    expect(TEXTOS.agregarPedido).toBe('Agregar pedido')
    expect(TEXTOS.cargarProducto).toBe('Cargar producto')
    expect(TEXTOS.reintentar).toBe('Reintentar')
  })

  it('los errores de guardado salen todos igual, en voseo', () => {
    expect(noSePudo('guardar', 'el cliente')).toBe('No se pudo guardar el cliente. Probá de nuevo.')
  })

  it.each([
    'Sincronizar ahora',
    'Todo sincronizado',
    'se sincronizará',
    'esperan sincronización',
    'Probá nuevamente',
    'intentá de nuevo',
    'Agregar primer',
    'Cargar primer',
    'Crear primer',
    'Crear cliente rápido',
  ])('ninguna pantalla dice "%s"', (prohibido) => {
    const hallazgos = fuente.filter(([, texto]) => texto.includes(prohibido)).map(([ruta]) => ruta)
    expect(hallazgos).toEqual([])
  })

  it('los vacíos, cargas y errores sueltos usan los componentes compartidos', () => {
    const sueltos = fuente.filter(([ruta, texto]) =>
      !/Estado(Vacio|Carga|Error)\.tsx$/.test(ruta) &&
      /className="[^"]*(f-admin-vacio|fp-vacio|f-pro-vacio|f-catalogo-vacio|f-venta-vacia\b|f-stock-vacio|f-fiados-vacio|f-clientes-vacio|f-pedidos-vacio|fh-vacio|page-loading-state)/.test(texto))
    expect(sueltos.map(([ruta]) => ruta)).toEqual([])
  })
})
