import { redondearCantidad } from './cantidad'
import type { Producto } from './tipos'

export interface ErroresProducto {
  nombre?: string
  costo?: string
  precio?: string
  codigoBarras?: string
  stockMinimo?: string
  stockInicial?: string
}

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function validarProducto(
  datos: Pick<Producto, 'nombre' | 'costo' | 'precio' | 'codigoBarras' | 'stockMinimo'> & Partial<Pick<Producto, 'unidad'>>,
  existentes: Producto[] = [],
  idActual?: string,
): ErroresProducto {
  const errores: ErroresProducto = {}
  const nombre = datos.nombre.trim()
  if (nombre.length < 2) errores.nombre = 'Escribí un nombre de al menos 2 caracteres.'
  if (!Number.isFinite(datos.costo) || datos.costo < 0) errores.costo = 'El costo no puede ser negativo.'
  if (!Number.isFinite(datos.precio) || datos.precio < 0) errores.precio = 'El precio no puede ser negativo.'
  const porUnidad = (datos.unidad ?? 'unidad') === 'unidad'
  const minimoValido = Number.isFinite(datos.stockMinimo) && datos.stockMinimo >= 0 &&
    (porUnidad ? Number.isInteger(datos.stockMinimo) : redondearCantidad(datos.stockMinimo) === datos.stockMinimo)
  if (!minimoValido) errores.stockMinimo = porUnidad ? 'Usá una cantidad entera desde cero.' : 'Usá una cantidad desde cero (hasta 3 decimales).'

  const codigo = datos.codigoBarras?.trim() ?? ''
  if (codigo !== '' && !/^[a-zA-Z0-9-]{3,32}$/.test(codigo)) {
    errores.codigoBarras = 'Usá entre 3 y 32 letras, números o guiones.'
  }

  const repetido = existentes.find((producto) => {
    if (producto.id === idActual) return false
    const mismoNombre = normalizarTexto(producto.nombre) === normalizarTexto(nombre)
    const mismoCodigo = codigo !== '' && producto.codigoBarras?.trim() === codigo
    return mismoNombre || mismoCodigo
  })
  if (repetido) {
    if (codigo !== '' && repetido.codigoBarras?.trim() === codigo) errores.codigoBarras = 'Ese código ya pertenece a otro producto.'
    if (normalizarTexto(repetido.nombre) === normalizarTexto(nombre)) errores.nombre = 'Ya existe un producto con ese nombre.'
  }

  return errores
}

export function hayErroresProducto(errores: ErroresProducto): boolean {
  return Object.keys(errores).length > 0
}
