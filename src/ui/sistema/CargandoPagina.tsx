export function CargandoPagina({ texto = 'Preparando la pantalla…' }: { texto?: string }) {
  return (
    <div className="page-loading-state" role="status" aria-live="polite" aria-busy="true">
      <span className="page-loading-spinner" aria-hidden="true" />
      <div>
        <strong>{texto}</strong>
        <p>Un segundo, estamos ordenando tus datos.</p>
      </div>
    </div>
  )
}
