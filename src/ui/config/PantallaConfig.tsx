'use client'

import { useEffect, useRef, useState } from 'react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { cerrarSesion } from '@/datos/nube/sesion'
import { Boton } from '@/ui/sistema/Boton'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Respaldo } from './Respaldo'
import { RespaldoLocal } from './RespaldoLocal'
import { TemaControl } from './TemaControl'
import { TicketControl } from './TicketControl'
import { InstalarApp } from './InstalarApp'
import { EstadoSincronizacion } from './EstadoSincronizacion'
import { EstadoCuenta } from '@/ui/cuenta/EstadoCuenta'
import { IconoSubir } from '@/ui/sistema/iconos'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { FuncionesControl } from './FuncionesControl'
import './config.css'

export function PantallaConfig() {
  const archivoLogo = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#0A6F5A')
  const [logo, setLogo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [saliendo, setSaliendo] = useState(false)
  const { funciones } = useFuncionesNegocio()

  useEffect(() => {
    db.negocio.get('unico').then((negocio) => {
      if (!negocio) return
      setNombre(negocio.nombre)
      if (negocio.color) setColor(negocio.color)
      setLogo(negocio.logo)
    })
  }, [])

  async function guardar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault()
    setGuardando(true)
    setGuardado(false)
    setAviso(null)
    try {
      await repos.negocio.guardarAjustes(nombre.trim() || 'Tu almacén', logo, color)
      setGuardado(true)
    } catch {
      setAviso('No se pudieron guardar los cambios. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function leerLogo(archivo: File) {
    const lector = new FileReader()
    lector.onload = () => setLogo(String(lector.result))
    lector.readAsDataURL(archivo)
  }

  async function salir() {
    if (!window.confirm('Se va a cerrar la sesión y quitar la copia local de este aparato. Los datos de tu cuenta no se borran.')) return
    setSaliendo(true)
    await cerrarSesion()
  }

  return (
    <div className="page-config f-config">
      <header>
        <h1 className="f-titulo">Tu negocio</h1>
        <p className="f-texto f-config-subtitulo">Personalizá tu operación y protegé tus datos.</p>
      </header>

      <div className="f-config-cuerpo">
        <div className="f-config-col">
          <EstadoCuenta />

          <Tarjeta como="section" className="f-config-bloque" aria-labelledby="config-identidad">
            <form className="f-config-form" onSubmit={(evento) => void guardar(evento)}>
              <div>
                <h2 id="config-identidad" className="f-seccion">Identidad del negocio</h2>
                <p className="f-dato">Estos datos aparecen en tu encabezado y en los tickets.</p>
              </div>
              <label className="f-campo">
                <span>Nombre del negocio <em>visible para tus clientes</em></span>
                <input
                  aria-label="Nombre del negocio"
                  placeholder="Ej. Almacén Don José"
                  className="f-entrada"
                  value={nombre}
                  onChange={(evento) => { setNombre(evento.target.value); setGuardado(false); setAviso(null) }}
                />
                <small className="f-config-ayuda">Si lo dejás vacío, vamos a mostrar “Tu almacén”.</small>
              </label>

              <label className="f-campo">
                <span>Color <em>identidad visual</em></span>
                <input
                  aria-label="Color" type="color"
                  className="f-config-color"
                  value={color}
                  onChange={(evento) => { setColor(evento.target.value); setGuardado(false); setAviso(null) }}
                />
                <small className="f-config-ayuda">Se usa para destacar tu negocio en la app y los comprobantes.</small>
              </label>

              <div className="f-campo">
                <span>Logo <em>opcional</em></span>
                <div className="f-config-logo">
                  <Boton variante="secundario" onClick={() => archivoLogo.current?.click()}>
                    <IconoSubir />
                    {logo ? 'Cambiar logo' : 'Elegir logo'}
                  </Boton>
                  <span className="f-dato">{logo ? 'Logo listo para guardar' : 'PNG o JPG · opcional'}</span>
                  <input
                    ref={archivoLogo}
                    aria-label="Logo" type="file" accept="image/*"
                    className="f-sr"
                    onChange={(evento) => {
                      const archivo = evento.target.files?.[0]
                      if (archivo) { leerLogo(archivo); setGuardado(false) }
                      evento.currentTarget.value = ''
                    }}
                  />
                </div>
                <small className="f-config-ayuda">Una imagen cuadrada en PNG o JPG se ve mejor en el ticket.</small>
              </div>

              {guardado && <p role="status" className="f-aviso f-config-ok">Cambios guardados.</p>}
              {aviso && <p className="f-aviso" data-tono="ambar" role="alert">{aviso}</p>}
              <Boton type="submit" variante="principal" ancho disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
            </form>
          </Tarjeta>

          <TemaControl />
          <TicketControl />
          <InstalarApp />
        </div>

        <div className="f-config-col">
          <FuncionesControl />
          {funcionActiva(funciones, 'respaldoLocal') && <><Respaldo /><RespaldoLocal /></>}
          <EstadoSincronizacion />
        </div>
      </div>

      <Tarjeta como="section" className="f-config-sesion" aria-labelledby="config-sesion">
        <div>
          <h2 id="config-sesion" className="f-seccion">Sesión de este aparato</h2>
          <p className="f-dato">Cerrá sesión si vas a cambiar de negocio o entregar el dispositivo.</p>
        </div>
        <Boton variante="secundario" disabled={saliendo} onClick={() => void salir()}>
          {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
        </Boton>
      </Tarjeta>
    </div>
  )
}
