'use client'

import { useEffect, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { avisosActivos, avisosSoportados, guardarAvisosActivos, mostrarAviso, revisarAvisos } from '@/ui/sistema/avisosLocales'

type Estado = 'cargando' | 'no-soportado' | 'bloqueado' | 'apagado' | 'activo'

function estadoActual(): Estado {
  if (!avisosSoportados()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  return avisosActivos() ? 'activo' : 'apagado'
}

/** Avisos en este celu: vencimientos, fiados vencidos, caja sin cerrar,
 *  reponer y cumpleaños. Los arma el aparato; no hace falta ningún servidor. */
export function AvisosControl() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [mensaje, setMensaje] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el permiso sólo se conoce en el navegador
    setEstado(estadoActual())
  }, [])

  async function activar() {
    setMensaje(null)
    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') {
      setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado')
      return
    }
    guardarAvisosActivos(true)
    setEstado('activo')
    const enviados = await revisarAvisos().catch(() => 0)
    if (enviados === 0) setMensaje('Listo. Ahora no hay nada que avisar: te avisamos cuando haga falta.')
  }

  function apagar() {
    guardarAvisosActivos(false)
    setEstado('apagado')
    setMensaje(null)
  }

  return (
    <Tarjeta como="section" className="f-config-bloque f-avisos" aria-labelledby="config-avisos">
      <h2 id="config-avisos" className="f-seccion">Avisos en este aparato</h2>
      <p className="f-dato">Te avisamos de productos por vencer, fiados vencidos, lo que hay que reponer, cumpleaños de clientes y si a la noche falta cerrar la caja. Uno por tema, una vez por día.</p>
      {estado === 'no-soportado' && <p className="f-aviso" data-tono="ambar">Este navegador no muestra avisos. En el iPhone, instalá Libreta en la pantalla de inicio para activarlos.</p>}
      {estado === 'bloqueado' && <p className="f-aviso" data-tono="ambar">Los avisos están bloqueados para Libreta. Habilitalos en los permisos del navegador y volvé a esta pantalla.</p>}
      {estado === 'apagado' && <Boton variante="principal" onClick={() => void activar()}>Activar avisos</Boton>}
      {estado === 'activo' && (
        <div className="f-avisos-acciones">
          <span className="f-avisos-estado"><span aria-hidden="true" />Avisos activos</span>
          <Boton variante="secundario" onClick={() => void mostrarAviso('Así se ve un aviso de Libreta', 'Tocalo para abrir la app.', '/', 'prueba')}>Probar</Boton>
          <Boton variante="secundario" onClick={apagar}>Apagar</Boton>
        </div>
      )}
      {mensaje && <p className="f-dato" role="status">{mensaje}</p>}
    </Tarjeta>
  )
}
