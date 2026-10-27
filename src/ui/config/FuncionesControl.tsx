'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { repos } from '@/datos/local/repos'
import {
  cambiarFuncion,
  cantidadFuncionesActivas,
  DEFINICIONES_FUNCION,
  definicionesPorGrupo,
  funcionActiva,
  type ClaveFuncion,
  type GrupoFuncion,
} from '@/dominio/funciones'
import { IconoAlerta, IconoBloqueo, IconoConfig, IconoConfirmar, IconoNube } from '@/ui/sistema/iconos'
import { useFuncionesNegocio } from '@/ui/sistema/usoFuncionesNegocio'

const GRUPOS: readonly GrupoFuncion[] = ['Módulos', 'Herramientas', 'Productividad']

export function FuncionesControl() {
  const { funciones, cargando } = useFuncionesNegocio()
  const negocio = useLiveQuery(() => db.negocio.get('unico'), [], undefined)
  const [guardando, setGuardando] = useState<ClaveFuncion | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [avisoTipo, setAvisoTipo] = useState<'ok' | 'error'>('ok')

  async function alternar(clave: ClaveFuncion) {
    const definicion = DEFINICIONES_FUNCION.find((item) => item.clave === clave)
    if (!definicion || definicion.fija || guardando) return
    const activa = funcionActiva(funciones, clave)
    setGuardando(clave)
    setAviso(null)
    try {
      await repos.preferencias.guardarFunciones(cambiarFuncion(funciones, clave, !activa))
      const alcance = negocio?.negocioId
        ? 'Se aplicará en todos tus dispositivos.'
        : 'Quedó guardada en este aparato; al vincular tu cuenta se replicará.'
      setAviso(`${definicion.titulo} ${activa ? 'desactivada' : 'activada'}. ${alcance}`)
      setAvisoTipo('ok')
    } catch {
      setAviso('No se pudo guardar esta preferencia. Probá de nuevo.')
      setAvisoTipo('error')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <section id="funciones" className="config-functions-card" aria-busy={cargando || guardando !== null}>
      <div className="config-functions-head">
        <div className="config-functions-title-wrap">
          <span className="config-functions-icon" aria-hidden="true"><IconoConfig /></span>
          <div>
            <span className="form-field-label">Personalización</span>
            <h2>Funciones visibles</h2>
            <p>Dejá a la vista sólo lo que tu negocio necesita. Ventas, cuenta y configuración quedan siempre disponibles.</p>
          </div>
        </div>
        <div className="config-functions-count" aria-label={`${cantidadFuncionesActivas(funciones)} de ${DEFINICIONES_FUNCION.length} funciones activas`}>
          <strong>{cantidadFuncionesActivas(funciones)}</strong>
          <span>de {DEFINICIONES_FUNCION.length} activas</span>
        </div>
      </div>

      <div className="config-functions-sync">
        <span aria-hidden="true"><IconoNube /></span>
        <span>{negocio?.negocioId ? 'Configuración sincronizada: todos tus dispositivos reciben estos cambios.' : 'Se guarda en este aparato. Al vincular tu cuenta, se replicará entre tus dispositivos.'}</span>
      </div>

      <div className="config-function-groups">
        {GRUPOS.map((grupo) => (
          <div className="config-function-group" key={grupo}>
            <div className="config-function-group-heading"><span>{grupo}</span><small>{definicionesPorGrupo(grupo).length} opciones</small></div>
            <div className="config-function-grid">
              {definicionesPorGrupo(grupo).map((definicion) => {
                const activa = funcionActiva(funciones, definicion.clave)
                const estaGuardando = guardando === definicion.clave
                return (
                  <button
                    type="button"
                    key={definicion.clave}
                    className={`config-function-card${activa ? '' : ' is-off'}`}
                    role="switch"
                    aria-checked={activa}
                    aria-label={`${definicion.titulo}: ${activa ? 'activa' : 'desactivada'}`}
                    disabled={Boolean(guardando) || Boolean(definicion.fija)}
                    onClick={() => void alternar(definicion.clave)}
                  >
                    <span className="config-function-card-icon" aria-hidden="true">{activa ? <IconoConfirmar /> : <IconoBloqueo />}</span>
                    <span className="config-function-card-copy"><strong>{definicion.titulo}</strong><small>{definicion.descripcion}</small></span>
                    <span className={`config-function-switch${activa ? ' is-on' : ''}${estaGuardando ? ' is-loading' : ''}`} aria-hidden="true"><i /></span>
                    {definicion.fija && <span className="config-function-fixed"><IconoAlerta /> Siempre activa</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {aviso && <p className={`config-functions-notice${avisoTipo === 'error' ? ' is-error' : ''}`} role="status">{aviso}</p>}
      <div className="config-functions-foot"><IconoAlerta /><span>Ocultar una función no borra sus datos. Si la volvés a activar, todo sigue ahí.</span></div>
    </section>
  )
}
