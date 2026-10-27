'use client'

import { useEffect, useRef, useState } from 'react'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import { cerrarSesion } from '@/datos/nube/sesion'
import { Boton } from '@/ui/sistema/Boton'
import { Respaldo } from './Respaldo'
import { RespaldoLocal } from './RespaldoLocal'
import { TemaControl } from './TemaControl'
import { InstalarApp } from './InstalarApp'
import { EstadoSincronizacion } from './EstadoSincronizacion'
import { EstadoCuenta } from '@/ui/cuenta/EstadoCuenta'
import { IconoConfig, IconoSubir } from '@/ui/sistema/iconos'
import { funcionActiva } from '@/dominio/funciones'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'
import { FuncionesControl } from './FuncionesControl'

export function PantallaConfig() {
  const archivoLogo = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#12694E')
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
    <div className="page-config px-5 pt-6">
      <div className="page-module-head config-head"><div><span className="page-kicker">Preferencias</span><h1 className="page-title">Tu negocio</h1><p className="page-description">Personalizá tu operación y protegé tus datos.</p></div></div>

      <EstadoCuenta />

      <form className="config-profile-card form-shell form-card mt-3" onSubmit={(evento) => void guardar(evento)}>
        <div className="form-intro">
          <span className="form-intro-icon" aria-hidden="true"><IconoConfig /></span>
          <div><strong>Identidad del negocio</strong><p>Estos datos aparecen en tu encabezado y en los tickets.</p></div>
        </div>
        <label className="form-field">
          <span className="form-field-label">Nombre del negocio <em>visible para tus clientes</em></span>
          <input
            aria-label="Nombre del negocio"
            placeholder="Ej. Almacén Don José"
            className="form-input"
            value={nombre}
            onChange={(evento) => { setNombre(evento.target.value); setGuardado(false); setAviso(null) }}
          />
          <span className="form-field-help">Si lo dejás vacío, vamos a mostrar “Tu almacén”.</span>
        </label>

        <label className="form-field config-color-field">
          <span className="form-field-label">Color <em>identidad visual</em></span>
          <input
            aria-label="Color" type="color"
            className="config-color-control"
            value={color}
            onChange={(evento) => { setColor(evento.target.value); setGuardado(false); setAviso(null) }}
          />
          <span className="form-field-help">Se usa para destacar tu negocio en la app y los comprobantes.</span>
        </label>

        <div className="form-field">
          <span className="form-field-label">Logo <em>opcional</em></span>
          <span className="config-file-picker mt-1">
            <button type="button" className="button-with-icon config-file-button" onClick={(evento) => { evento.preventDefault(); archivoLogo.current?.click() }}>
              <IconoSubir />
              {logo ? 'Cambiar logo' : 'Elegir logo'}
            </button>
            <span className="config-file-meta">{logo ? 'Logo listo para guardar' : 'PNG o JPG · opcional'}</span>
            <input
              ref={archivoLogo}
              aria-label="Logo" type="file" accept="image/*"
              className="sr-only"
              onChange={(evento) => {
                const archivo = evento.target.files?.[0]
                if (archivo) { leerLogo(archivo); setGuardado(false) }
                evento.currentTarget.value = ''
              }}
            />
          </span>
          <span className="form-field-help">Una imagen cuadrada en PNG o JPG se ve mejor en el ticket.</span>
        </div>

        <Boton type="submit" variante="principal" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
        {guardado && (
          <p role="status" className="text-[12px]" style={{ color: 'var(--verde)' }}>
            Cambios guardados.
          </p>
        )}
        {aviso && <p className="form-error form-error-banner" role="alert">{aviso}</p>}
      </form>

      <FuncionesControl />
      {funcionActiva(funciones, 'respaldoLocal') && <><Respaldo /><RespaldoLocal /></>}
      <TemaControl />
      <InstalarApp />
      <EstadoSincronizacion />
      <section className="config-session-card">
        <div>
          <h2>Sesión de este aparato</h2>
          <p>Cerrá sesión si vas a cambiar de negocio o entregar el dispositivo.</p>
        </div>
        <Boton variante="secundario" disabled={saliendo} onClick={() => void salir()}>
          {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
        </Boton>
      </section>
    </div>
  )
}
