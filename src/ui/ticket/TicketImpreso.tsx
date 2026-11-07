import { resumenTicket, type AnchoPapel, type DatosTicket } from '@/dominio/ticketImpreso'

/** El ticket para la impresora térmica. En pantalla está oculto; sólo se ve
 *  al imprimir (ver ticket.css). Se arma con los mismos datos que el texto
 *  que se comparte, así los dos dicen lo mismo. */
/** `vista`: la copia en pantalla (vista previa). No define la página de
 *  impresión ni se anuncia como el ticket que se imprime. */
export function TicketImpreso({ datos, ancho, vista = false }: { datos: DatosTicket; ancho: AnchoPapel; vista?: boolean }) {
  const r = resumenTicket(datos)
  return (
    <article className={vista ? 'f-ticket-impreso f-ticket-vista' : 'f-ticket-impreso'} data-ancho={ancho} aria-label={vista ? 'Así sale el ticket' : 'Ticket de la venta'}>
      {/* El tamaño de página depende del rollo elegido. */}
      {!vista && <style>{`@page { size: ${ancho}mm auto; margin: 2mm; }`}</style>}
      <header className="f-ticket-cabecera">
        <h1>{r.negocio}</h1>
        <p>{r.fecha}</p>
      </header>
      <ul className="f-ticket-renglones">
        {r.renglones.map((renglon, indice) => (
          <li key={indice}>
            <span className="f-ticket-cantidad">{renglon.cantidad} x</span>
            <span className="f-ticket-nombre">{renglon.nombre}</span>
            <span className="f-ticket-importe">{renglon.importe}</span>
          </li>
        ))}
      </ul>
      <dl className="f-ticket-totales">
        <div className="f-ticket-total"><dt>TOTAL</dt><dd>{r.total}</dd></div>
        <div><dt>Pago</dt><dd>{r.medioPago}</dd></div>
        {r.pagoCon && r.vuelto && (
          <>
            <div><dt>Pagó con</dt><dd>{r.pagoCon}</dd></div>
            <div><dt>Vuelto</dt><dd>{r.vuelto}</dd></div>
          </>
        )}
        {r.vendedor && <div><dt>Vendedor</dt><dd>{r.vendedor}</dd></div>}
      </dl>
      {r.leyenda && <p className="f-ticket-leyenda">{r.leyenda}</p>}
    </article>
  )
}
