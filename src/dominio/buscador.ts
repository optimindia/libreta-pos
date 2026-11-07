import type { Centavos, Cliente, Producto, Proveedor } from './tipos'
import { normalizarTexto } from './validaciones'

export type TipoResultado = 'seccion' | 'producto' | 'cliente' | 'proveedor'

export interface Resultado {
  tipo: TipoResultado
  id: string
  titulo: string
  detalle: string
  /** A dónde lleva al elegirlo. */
  href: string
  puntaje: number
}

export interface SeccionBuscable {
  id: string
  texto: string
  href: string
  /** Otras palabras con las que alguien la buscaría. */
  sinonimos?: string[]
}

/** Qué tan bien coincide: 3 empieza igual, 2 alguna palabra empieza igual,
 *  1 lo contiene en el medio, 0 no coincide. Todas las palabras buscadas
 *  tienen que estar. */
export function coincidencia(texto: string, busqueda: string): number {
  const heno = normalizarTexto(texto)
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return 0
  let peor = 3
  for (const palabra of palabras) {
    let valor = 0
    if (heno.startsWith(palabra)) valor = 3
    else if (heno.split(/[\s,.\-/()]+/).some((parte) => parte.startsWith(palabra))) valor = 2
    else if (heno.includes(palabra)) valor = 1
    if (valor === 0) return 0
    peor = Math.min(peor, valor)
  }
  return peor
}

export interface FuentesBusqueda {
  secciones: SeccionBuscable[]
  productos: Producto[]
  clientes: Cliente[]
  proveedores: Proveedor[]
  /** Lo que debe cada cliente, para mostrarlo al lado. */
  deudas: Map<string, Centavos>
  formatearPesos: (centavos: Centavos) => string
}

const POR_GRUPO = 6

function mejores(resultados: Resultado[]): Resultado[] {
  return resultados
    .filter((r) => r.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.titulo.localeCompare(b.titulo, 'es'))
    .slice(0, POR_GRUPO)
}

const deParametro = (valor: string) => encodeURIComponent(valor)

/** Busca en secciones, productos (nombre o código), clientes (nombre o
 *  teléfono) y proveedores. Devuelve los grupos con algo, en ese orden. */
export function buscarEnTodo(busqueda: string, fuentes: FuentesBusqueda): Array<{ tipo: TipoResultado; resultados: Resultado[] }> {
  const texto = busqueda.trim()
  if (texto === '') return []
  const soloDigitos = texto.replace(/\D/g, '')
  const esCodigo = soloDigitos.length >= 4 && soloDigitos.length === texto.replace(/\s/g, '').length

  const secciones = mejores(fuentes.secciones.map((s) => ({
    tipo: 'seccion' as const,
    id: s.id,
    titulo: s.texto,
    detalle: 'Ir a la sección',
    href: s.href,
    puntaje: Math.max(coincidencia(s.texto, texto), ...(s.sinonimos ?? []).map((otro) => coincidencia(otro, texto) - 0.5)),
  })))

  const productos = mejores(fuentes.productos.map((p) => {
    const porCodigo = esCodigo && p.codigoBarras ? (p.codigoBarras === soloDigitos ? 4 : p.codigoBarras.includes(soloDigitos) ? 2 : 0) : 0
    return {
      tipo: 'producto' as const,
      id: p.id,
      titulo: p.nombre,
      detalle: p.sinControlStock ? fuentes.formatearPesos(p.precio) : `${fuentes.formatearPesos(p.precio)} · ${p.stock <= 0 ? 'sin stock' : `quedan ${p.stock}`}`,
      href: `/stock?buscar=${deParametro(p.nombre)}`,
      puntaje: Math.max(porCodigo, coincidencia(p.nombre, texto)),
    }
  }))

  const clientes = mejores(fuentes.clientes.map((c) => {
    const tel = (c.telefono ?? '').replace(/\D/g, '')
    const porTelefono = soloDigitos.length >= 3 && tel.includes(soloDigitos) ? 2 : 0
    const debe = fuentes.deudas.get(c.id) ?? 0
    return {
      tipo: 'cliente' as const,
      id: c.id,
      titulo: c.nombre,
      detalle: debe > 0 ? `Debe ${fuentes.formatearPesos(debe)}` : c.telefono ?? 'Sin deuda',
      href: debe > 0 ? `/fiados?cliente=${deParametro(c.id)}` : `/clientes?buscar=${deParametro(c.nombre)}`,
      puntaje: Math.max(porTelefono, coincidencia(c.nombre, texto)),
    }
  }))

  const proveedores = mejores(fuentes.proveedores.map((p) => ({
    tipo: 'proveedor' as const,
    id: p.id,
    titulo: p.nombre,
    detalle: p.deuda && p.deuda > 0 ? `Le debés ${fuentes.formatearPesos(p.deuda)}` : p.visita ? `Pasa ${p.visita}` : 'Proveedor',
    href: `/stock?pestana=proveedores&proveedor=${deParametro(p.id)}`,
    puntaje: coincidencia(p.nombre, texto),
  })))

  return ([
    { tipo: 'seccion', resultados: secciones },
    { tipo: 'producto', resultados: productos },
    { tipo: 'cliente', resultados: clientes },
    { tipo: 'proveedor', resultados: proveedores },
  ] as const).filter((grupo) => grupo.resultados.length > 0).map((grupo) => ({ tipo: grupo.tipo, resultados: [...grupo.resultados] }))
}
