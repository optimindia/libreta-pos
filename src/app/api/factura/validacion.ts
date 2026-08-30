import { pesosACentavos } from '@/dominio/dinero'

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
  if (!imagen.startsWith('data:image/')) {
    return { ok: false, motivo: 'la imagen no es válida' }
  }
  return { ok: true }
}

/** El modelo devuelve pesos; adentro todo es centavos. Y lo que venga
 *  incompleto se descarta: es preferible que falte una fila a que el
 *  almacenero cargue stock inventado. */
export function normalizarItems(items: unknown[]): ItemFactura[] {
  return items
    .filter((item): item is ItemFactura => {
      if (typeof item !== 'object' || item === null) return false
      const posible = item as Partial<ItemFactura>
      return (
        typeof posible.nombre === 'string' &&
        posible.nombre.trim() !== '' &&
        typeof posible.cantidad === 'number' &&
        posible.cantidad >= 1 &&
        typeof posible.costoUnitario === 'number'
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
  return { tipo: partes[1], datos: partes[2] }
}
