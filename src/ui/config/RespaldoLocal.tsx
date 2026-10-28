'use client'

import { useRef, useState } from 'react'
import { crearRespaldoLocal, restaurarRespaldoLocal, validarRespaldoLocal, type RespaldoLocal } from '@/datos/local/respaldo'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
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
    <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-copia-local">
      <div>
        <h2 id="config-copia-local" className="f-seccion">Copia en este aparato</h2>
        <p className="f-dato">Descargá un archivo para guardarlo o pasarlo a otro celular. Al restaurar, se mezclan los datos y no se borra lo actual.</p>
      </div>
      <div className="f-config-botones">
        <Boton variante="secundario" onClick={() => void descargar()}><IconoDescargar /> Descargar copia</Boton>
        <Boton variante="secundario" onClick={() => archivo.current?.click()}><IconoSubir /> Restaurar copia</Boton>
      </div>
      <input ref={archivo} type="file" accept="application/json,.json" className="f-sr" aria-label="Archivo de respaldo" onChange={(evento) => { const file = evento.target.files?.[0]; if (file) void leer(file); evento.currentTarget.value = '' }} />
      {pendiente && (
        <div className="f-aviso f-config-pregunta" data-tono="ambar">
          <span>Encontré una copia del {new Date(pendiente.creadoEn).toLocaleDateString('es-AR')}. ¿Querés mezclarla?</span>
          <div className="f-config-botones">
            <Boton variante="secundario" disabled={trabajando} onClick={() => void restaurar()}>Sí, restaurar</Boton>
            <Boton variante="secundario" onClick={() => setPendiente(null)}>Cancelar</Boton>
          </div>
        </div>
      )}
      {aviso && <p role="status" className="f-aviso f-config-ok">{aviso}</p>}
    </Tarjeta>
  )
}
