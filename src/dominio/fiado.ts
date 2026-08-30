import type { Centavos, Fiado, FiadoPago, UUID } from './tipos'
import { sumar } from './dinero'

const DIA_EN_MS = 24 * 60 * 60 * 1000

export interface DeudaCliente {
  clienteId: UUID
  saldo: Centavos
  diasDelMasViejo: number
}

export function saldoFiado(fiado: Fiado, pagos: FiadoPago[]): Centavos {
  const pagado = sumar(
    ...pagos.filter((pago) => pago.fiadoId === fiado.id).map((pago) => pago.monto),
  )
  return Math.max(0, fiado.monto - pagado)
}

export function estaSaldado(fiado: Fiado, pagos: FiadoPago[]): boolean {
  return saldoFiado(fiado, pagos) === 0
}

export function diasDeAntiguedad(fiado: Fiado, ahora: number): number {
  return Math.floor((ahora - fiado.fecha) / DIA_EN_MS)
}

export function deudaPorCliente(
  fiados: Fiado[],
  pagos: FiadoPago[],
  ahora: number,
): DeudaCliente[] {
  const porCliente = new Map<UUID, DeudaCliente>()

  for (const fiado of fiados) {
    const saldo = saldoFiado(fiado, pagos)
    if (saldo === 0) continue

    const dias = diasDeAntiguedad(fiado, ahora)
    const actual = porCliente.get(fiado.clienteId)
    if (actual) {
      actual.saldo += saldo
      actual.diasDelMasViejo = Math.max(actual.diasDelMasViejo, dias)
    } else {
      porCliente.set(fiado.clienteId, {
        clienteId: fiado.clienteId,
        saldo,
        diasDelMasViejo: dias,
      })
    }
  }

  return [...porCliente.values()].sort((a, b) => b.saldo - a.saldo)
}
