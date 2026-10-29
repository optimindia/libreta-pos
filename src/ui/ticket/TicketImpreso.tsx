import { resumenTicket, type AnchoPapel, type DatosTicket } from '@/dominio/ticketImpreso'

/** El ticket para la impresora térmica. En pantalla está oculto; sólo se ve
 *  al imprimir (ver ticket.css). Se arma con los mismos datos que el texto
 *  que se comparte, así los dos dicen lo mismo. */
export function TicketImpreso({ datos, ancho }: { datos: DatosTicket; ancho: AnchoPapel }) {
  const r = resumenTicket(datos)
  return (
    <article className="f-ticket-impreso" data-ancho={ancho} aria-label="Ticket de la venta">
      {/* El tamaño de página depende del rollo elegido. */}
      <style>{`@page { size: ${ancho}mm auto; margin: 2mm; }`}</style>
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
