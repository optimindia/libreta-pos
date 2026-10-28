'use client'

import { useEffect, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [instalada, setInstalada] = useState(false)

  useEffect(() => {
    const disponible = (event: Event) => {
      event.preventDefault()
      setEvento(event as EventoInstalacion)
    }
    const terminada = () => { setInstalada(true); setEvento(null) }
    window.addEventListener('beforeinstallprompt', disponible)
    window.addEventListener('appinstalled', terminada)
    return () => {
      window.removeEventListener('beforeinstallprompt', disponible)
      window.removeEventListener('appinstalled', terminada)
    }
  }, [])

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const eleccion = await evento.userChoice
    if (eleccion.outcome === 'accepted') setInstalada(true)
    setEvento(null)
  }

  if (instalada) return <p className="f-aviso f-config-ok">Libreta ya está instalada en este aparato.</p>
  if (!evento) return null
  return (
    <Tarjeta como="section" className="f-config-bloque">
      <div>
        <h2 className="f-seccion">Instalá Libreta</h2>
        <p className="f-dato">Abrila desde el ícono del celu y trabajá más rápido, incluso sin señal.</p>
      </div>
      <Boton variante="secundario" ancho onClick={() => void instalar()}>Instalar aplicación</Boton>
    </Tarjeta>
  )
}
