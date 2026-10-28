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
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
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
    <Tarjeta como="section" id="funciones" className="f-config-bloque" aria-busy={cargando || guardando !== null} aria-labelledby="config-funciones">
      <div className="f-config-cabeza">
        <div>
          <h2 id="config-funciones" className="f-seccion">Funciones visibles</h2>
          <p className="f-dato">Dejá a la vista sólo lo que tu negocio necesita. Ventas, cuenta y configuración quedan siempre disponibles.</p>
        </div>
        <span className="f-etiqueta" data-tono="gris" aria-label={`${cantidadFuncionesActivas(funciones)} de ${DEFINICIONES_FUNCION.length} funciones activas`}>
          {cantidadFuncionesActivas(funciones)} de {DEFINICIONES_FUNCION.length} activas
        </span>
      </div>

      <p className="f-dato f-config-nube">{negocio?.negocioId ? 'Configuración sincronizada: todos tus dispositivos reciben estos cambios.' : 'Se guarda en este aparato. Al vincular tu cuenta, se replicará entre tus dispositivos.'}</p>

      {GRUPOS.map((grupo) => (
        <div className="f-config-grupo" key={grupo}>
          <h3 className="f-config-grupo-titulo">{grupo} <span>{definicionesPorGrupo(grupo).length} opciones</span></h3>
          <div className="f-config-lista">
            {definicionesPorGrupo(grupo).map((definicion) => {
              const activa = funcionActiva(funciones, definicion.clave)
              const estaGuardando = guardando === definicion.clave
              return (
                <button
                  type="button"
                  key={definicion.clave}
                  className="f-config-fila"
                  role="switch"
                  aria-checked={activa}
                  aria-label={`${definicion.titulo}: ${activa ? 'activa' : 'desactivada'}`}
                  disabled={Boolean(guardando) || Boolean(definicion.fija)}
                  onClick={() => void alternar(definicion.clave)}
                >
                  <span className="f-config-fila-texto">
                    <strong>{definicion.titulo}</strong>
                    <small>{definicion.descripcion}</small>
                    {definicion.fija && <Etiqueta tono="gris">Siempre activa</Etiqueta>}
                  </span>
                  <span className="f-config-interruptor" data-activa={activa ? 'true' : 'false'} data-cargando={estaGuardando ? 'true' : undefined} aria-hidden="true"><i /></span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {aviso && <p className={avisoTipo === 'error' ? 'f-aviso' : 'f-aviso f-config-ok'} data-tono={avisoTipo === 'error' ? 'ambar' : undefined} role="status">{aviso}</p>}
      <p className="f-dato">Ocultar una función no borra sus datos. Si la volvés a activar, todo sigue ahí.</p>
    </Tarjeta>
  )
}
