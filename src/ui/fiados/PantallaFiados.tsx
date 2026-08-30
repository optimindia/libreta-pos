'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { deudaPorCliente } from '@/dominio/fiado'
import { mensajeCobro, enlaceWhatsApp } from '@/dominio/mensajes'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'

export function PantallaFiados() {
  const deudas = useLiveQuery(async () => {
    const [fiados, pagos, clientes] = await Promise.all([
      db.fiados.toArray(),
      repos.fiados.pagos(),
      repos.clientes.todos(),
    ])
    const ahora = Date.now()
    return deudaPorCliente(fiados, pagos, ahora)
      .map((deuda) => ({
        ...deuda,
        cliente: clientes.find((cliente) => cliente.id === deuda.clienteId),
        fiadosDelCliente: fiados.filter((fiado) => fiado.clienteId === deuda.clienteId),
      }))
      .filter((deuda) => deuda.cliente !== undefined)
  }, [], [])

  async function cobrarTodo(fiadosDelCliente: { id: string; monto: number }[]) {
    const pagos = await repos.fiados.pagos()
    for (const fiado of fiadosDelCliente) {
      const yaPagado = pagos
        .filter((pago) => pago.fiadoId === fiado.id)
        .reduce((total, pago) => total + pago.monto, 0)
      const resta = fiado.monto - yaPagado
      if (resta > 0) await repos.fiados.pagar(fiado.id, resta)
    }
  }

  if (deudas.length === 0) {
    return (
      <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--tenue)' }}>
        No te debe nadie. Todo cobrado.
      </p>
    )
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
        Te deben
      </h1>

      <ul className="mt-3">
        {deudas.map((deuda) => (
          <li key={deuda.clienteId} className="py-4" style={{ borderBottom: '1px solid var(--linea)' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">{deuda.cliente!.nombre}</span>
              <Importe centavos={deuda.saldo} style={{ color: 'var(--ambar)' }} />
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--tenue)' }}>
              {deuda.diasDelMasViejo === 0
                ? 'anotado hoy'
                : `desde hace ${deuda.diasDelMasViejo} ${deuda.diasDelMasViejo === 1 ? 'día' : 'días'}`}
            </div>

            <div className="mt-3 flex gap-2">
              <Boton
                variante="principal"
                className="flex-1 !py-2.5 !text-[12px]"
                onClick={() => cobrarTodo(deuda.fiadosDelCliente)}
              >
                Cobrar todo
              </Boton>
              {deuda.cliente!.telefono && (
                <a
                  className="flex-1 rounded-2xl py-2.5 text-center text-[12px] font-semibold"
                  style={{ background: 'var(--hueso-2)', border: '1px solid var(--linea)', color: 'var(--tinta)' }}
                  target="_blank"
                  rel="noreferrer"
                  href={enlaceWhatsApp(
                    deuda.cliente!.telefono!,
                    mensajeCobro(deuda.cliente!, deuda.saldo, deuda.diasDelMasViejo),
                  )}
                >
                  Mandar mensaje
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
