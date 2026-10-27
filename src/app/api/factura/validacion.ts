import { pesosACentavos } from '@/dominio/dinero'

export const MAX_IMAGEN_DATA_URL = 12_000_000
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export interface ItemFactura {
  nombre: string
  cantidad: number
  costoUnitario: number
}

export function validarPedido(cuerpo: unknown): { ok: boolean; motivo?: string } {
  const imagen = (cuerpo as { imagenBase64?: unknown }).imagenBase64
  if (typeof imagen !== 'string' || imagen === '') {
    return { ok: false, motivo: 'falta la imagen' }
  }
  if (imagen.length > MAX_IMAGEN_DATA_URL) {
    return { ok: false, motivo: 'la imagen es demasiado grande' }
  }
  if (!/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(imagen)) {
    return { ok: false, motivo: 'la imagen no es válida' }
  }
  return { ok: true }
}

/** El modelo devuelve pesos; adentro todo es centavos. Y lo que venga
 *  incompleto se descarta: es preferible que falte una fila a que el
 *  almacenero cargue stock inventado. */
export function normalizarItems(items: unknown[]): ItemFactura[] {
  return items
    .slice(0, 300)
    .filter((item): item is ItemFactura => {
      if (typeof item !== 'object' || item === null) return false
      const posible = item as Partial<ItemFactura>
      return (
        typeof posible.nombre === 'string' &&
        posible.nombre.trim() !== '' &&
        posible.nombre.trim().length <= 160 &&
        typeof posible.cantidad === 'number' &&
        Number.isFinite(posible.cantidad) &&
        posible.cantidad >= 1 &&
        posible.cantidad <= 100_000 &&
        typeof posible.costoUnitario === 'number' &&
        Number.isFinite(posible.costoUnitario) &&
        posible.costoUnitario >= 0 &&
        posible.costoUnitario <= 10_000_000
      )
    })
    .map((item) => ({
      nombre: item.nombre.trim(),
      cantidad: Math.floor(item.cantidad),
      costoUnitario: pesosACentavos(item.costoUnitario),
    }))
}

/** Separa el data URL en el tipo de imagen y los bytes en base64,
 *  que es como los espera la API. */
export function partirDataUrl(dataUrl: string): { tipo: string; datos: string } | null {
  const partes = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl)
  if (!partes) return null
  if (!TIPOS_IMAGEN.has(partes[1]) || dataUrl.length > MAX_IMAGEN_DATA_URL) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(partes[2])) return null
  return { tipo: partes[1], datos: partes[2] }
}
