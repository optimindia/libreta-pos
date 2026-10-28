'use client'

import { useRef, useState } from 'react'
import { crearRespaldoLocal, restaurarRespaldoLocal, validarRespaldoLocal, type RespaldoLocal } from '@/datos/local/respaldo'
import { Boton } from '@/ui/sistema/Boton'
import { IconoDescargar, IconoSubir } from '@/ui/sistema/iconos'

export function RespaldoLocal() {
  const archivo = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<RespaldoLocal | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  async function descargar() {
    const respaldo = await crearRespaldoLocal()
    const contenido = JSON.stringify(respaldo, null, 2)
    const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `libreta-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    enlace.click()
    URL.revokeObjectURL(url)
    setAviso('Copia descargada en este aparato.')
  }

  async function leer(file: File) {
    setAviso(null)
    try {
      const contenido = JSON.parse(await file.text()) as unknown
      if (!validarRespaldoLocal(contenido)) throw new Error('inválido')
      setPendiente(contenido)
    } catch {
      setAviso('Ese archivo no es una copia válida de Libreta.')
    }
  }

  async function restaurar() {
    if (!pendiente) return
    setTrabajando(true)
    try {
      const cantidad = await restaurarRespaldoLocal(pendiente)
      setPendiente(null)
      setAviso(`Listo: se recuperaron ${cantidad} registros. Lo que ya tenías quedó intacto.`)
    } catch {
      setAviso('No se pudo restaurar la copia.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>Copia en este aparato</h2>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>Descargá un archivo para guardarlo o pasarlo a otro celular. Al restaurar, se mezclan los datos y no se borra lo actual.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Boton variante="secundario" className="button-with-icon !py-3 !text-[12px]" onClick={() => void descargar()}><IconoDescargar /> Descargar copia</Boton>
        <Boton variante="secundario" className="button-with-icon !py-3 !text-[12px]" onClick={() => archivo.current?.click()}><IconoSubir /> Restaurar copia</Boton>
      </div>
      <input ref={archivo} type="file" accept="application/json,.json" className="hidden" aria-label="Archivo de respaldo" onChange={(evento) => { const file = evento.target.files?.[0]; if (file) void leer(file); evento.currentTarget.value = '' }} />
      {pendiente && (
        <div className="mt-3 rounded-xl px-3 py-3" style={{ background: 'var(--ambar-fondo)', border: '1px solid var(--ambar)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ambar)' }}>Encontré una copia del {new Date(pendiente.creadoEn).toLocaleDateString('es-AR')}. ¿Querés mezclarla?</p>
          <div className="mt-2 flex gap-2"><Boton variante="fiado" className="flex-1 !py-2.5 !text-[12px]" disabled={trabajando} onClick={() => void restaurar()}>Sí, restaurar</Boton><Boton variante="secundario" className="flex-1 !py-2.5 !text-[12px]" onClick={() => setPendiente(null)}>Cancelar</Boton></div>
        </div>
      )}
      {aviso && <p role="status" className="mt-2 text-[12px]" style={{ color: 'var(--verde)' }}>{aviso}</p>}
    </section>
  )
}
