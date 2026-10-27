'use client'

import { useEffect, useState } from 'react'
import { Boton } from '@/ui/sistema/Boton'

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

  if (instalada) return <p className="mt-2 text-[12px]" style={{ color: 'var(--verde)' }}>Libreta ya está instalada en este aparato.</p>
  if (!evento) return null
  return (
    <div className="mt-6 rounded-2xl px-3.5 py-3" style={{ background: 'var(--chip-fondo)' }}>
      <p className="text-[13px] font-semibold">Instalá Libreta</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>Abrila desde el ícono del celu y trabajá más rápido, incluso sin señal.</p>
      <Boton variante="principal" className="mt-3 w-full !py-3 !text-[13px]" onClick={() => void instalar()}>Instalar aplicación</Boton>
    </div>
  )
}
