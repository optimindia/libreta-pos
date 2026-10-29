'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { accesoSaasObligatorio, cargarEstadoAcceso, EVENTO_ACCESO, type EstadoAcceso } from '@/datos/nube/acceso'
import { accesoPermitido, diasRestantes, estadoSuscripcion, fechaSuscripcion } from '@/dominio/suscripcion'
import { formatearPesos } from '@/dominio/dinero'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { clasesBoton } from '@/ui/sistema/Boton'
import { Etiqueta } from '@/ui/sistema/Etiqueta'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import { IconoAlerta, IconoBloqueo, IconoCalendarioCuenta, IconoCuentaActiva, IconoCuentaCerrada, IconoCuentaSegura, IconoTarjeta } from '@/ui/sistema/iconos'
import './cuenta.css'
import { EstadoCarga } from '@/ui/sistema/EstadoCarga'
import { EstadoError } from '@/ui/sistema/EstadoError'

const DIAS_AVISO = 3

function tipoSuscripcion(tipo: string | undefined, nombre?: string | null): string {
  if (nombre?.trim()) return nombre
  if (tipo === 'prueba') return 'Prueba gratuita'
  if (tipo === 'mensual') return 'Plan mensual'
  if (tipo === 'cortesia') return 'Cortesía'
  if (tipo === 'manual') return 'Activación manual'
  return 'Sin plan'
}

function nombreEstado(estado: ReturnType<typeof estadoSuscripcion>, verificado: boolean): string {
  if (!verificado) return 'Sin verificar'
  if (estado === 'prueba') return 'Prueba activa'
  if (estado === 'activa') return 'Activa'
  if (estado === 'gracia') return 'No habilitada'
  if (estado === 'suspendida') return 'Suspendida'
  if (estado === 'vencida') return 'Vencida'
  return 'Sin activar'
}

function copyPrincipal(
  estado: ReturnType<typeof estadoSuscripcion>,
  verificado: boolean,
  motivo?: 'sin_red' | 'error_red' | 'vencimiento_local',
  dias = 0,
): { titulo: string; texto: string } {
  if (motivo === 'vencimiento_local') {
    return { titulo: 'El acceso está bloqueado', texto: 'La fecha de vencimiento llegó y el POS se bloqueó automáticamente. Renová para continuar.' }
  }
  if (!verificado) {
    return motivo === 'sin_red'
      ? { titulo: 'Conectate para validar tu cuenta', texto: 'El POS permanece bloqueado hasta confirmar tu suscripción en el servidor.' }
      : { titulo: 'Estamos verificando tu cuenta', texto: 'El POS permanece bloqueado hasta completar una comprobación segura.' }
  }
  if (estado === 'sin_suscripcion') return { titulo: 'Cuenta pendiente de activación', texto: 'Tu acceso existe, pero todavía no tiene una prueba o suscripción habilitada.' }
  if (estado === 'suspendida') return { titulo: 'Cuenta pausada', texto: 'Contactanos para revisar la situación y volver a habilitar tu negocio.' }
  if (estado === 'gracia') return { titulo: 'Cuenta no habilitada', texto: 'La ventana de gracia no habilita el POS. Necesitás regularizar la suscripción.' }
  if (estado === 'vencida') return { titulo: 'El acceso está bloqueado', texto: 'La suscripción venció y el negocio queda protegido hasta que se confirme la renovación.' }
  if (dias > 0 && dias <= DIAS_AVISO) {
    return { titulo: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, texto: 'Renová antes de la fecha para mantener el acceso sin interrupciones.' }
  }
  return { titulo: 'Tu cuenta está al día', texto: 'La suscripción está vigente y el acceso al POS se encuentra habilitado.' }
}

function IconoEstado({ estado, verificado }: { estado: ReturnType<typeof estadoSuscripcion>; verificado: boolean }) {
  if (!verificado) return <IconoAlerta />
  if (estado === 'vencida' || estado === 'suspendida' || estado === 'sin_suscripcion' || estado === 'gracia') return <IconoCuentaCerrada />
  return <IconoCuentaActiva />
}

function EstadoCuentaLocal() {
  return (
    <Tarjeta como="section" className="f-cuenta-estado" aria-labelledby="account-status-title">
      <div className="f-cuenta-cabeza">
        <span className="f-cuenta-icono" data-tono="ok" aria-hidden="true"><IconoCuentaActiva /></span>
        <div className="f-cuenta-titulo">
          <span className="f-dato">Cuenta y suscripción</span>
          <h2 id="account-status-title" className="f-seccion">Modo local</h2>
          <p className="f-dato">Este aparato todavía no está vinculado a una cuenta comercial.</p>
        </div>
        <Etiqueta tono="gris">Local</Etiqueta>
      </div>
      <div className="f-cuenta-bloque">
        <strong className="f-renglon-texto">La suscripción aparecerá cuando vincules tu negocio.</strong>
        <p className="f-texto">En la versión comercial, el estado se consulta contra el servidor y el acceso se bloquea automáticamente al vencer.</p>
      </div>
    </Tarjeta>
  )
}

/** `destacar` pinta en lima el botón de WhatsApp: sólo para la pantalla de
 *  Cuenta, donde es la única acción principal (en Ajustes ya hay otra). */
export function EstadoCuenta({ destacar = false }: { destacar?: boolean } = {}) {
  const [estado, setEstado] = useState<EstadoAcceso | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(() => Date.now())
  const saas = accesoSaasObligatorio()

  const refrescar = useCallback(async () => {
    setCargando(true)
    try {
      setEstado(await cargarEstadoAcceso())
      setAhora(Date.now())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!saas) return
    const inicio = window.setTimeout(() => void refrescar(), 0)
    const cambio = () => void refrescar()
    const reloj = window.setInterval(() => {
      setAhora(Date.now())
      void refrescar()
    }, 30_000)
    window.addEventListener(EVENTO_ACCESO, cambio)
    window.addEventListener('online', cambio)
    window.addEventListener('offline', cambio)
    return () => {
      window.clearTimeout(inicio)
      window.clearInterval(reloj)
      window.removeEventListener(EVENTO_ACCESO, cambio)
      window.removeEventListener('online', cambio)
      window.removeEventListener('offline', cambio)
    }
  }, [refrescar, saas])

  if (!saas) return <EstadoCuentaLocal />

  if (cargando && !estado) {
    return (
      <EstadoCarga texto="Consultando el estado de tu cuenta…" filas={2} />
    )
  }

  if (!estado) {
    return (
      <EstadoError titulo="No pudimos cargar el estado de tu cuenta" texto="Revisá la señal y probá de nuevo." onReintentar={() => void refrescar()} />
    )
  }

  if (!estado.autenticado) {
    return (
      <Tarjeta como="section" className="f-cuenta-estado f-cuenta-simple" aria-labelledby="account-status-title">
        <div><span className="f-dato">Cuenta</span><strong id="account-status-title" className="f-renglon-texto">Iniciá sesión para ver tu suscripción</strong><p className="f-dato">El estado comercial sólo está disponible para la cuenta vinculada al negocio.</p></div>
        <Link className={clasesBoton('secundario')} href="/">Ingresar</Link>
      </Tarjeta>
    )
  }

  const efectivo = estadoSuscripcion(estado.suscripcion, ahora)
  const dias = diasRestantes(estado.suscripcion, ahora)
  const permitido = estado.verificadoRemoto && accesoPermitido(estado.suscripcion, ahora)
  const aviso = permitido && dias >= 1 && dias <= DIAS_AVISO
  const copy = copyPrincipal(efectivo, estado.verificadoRemoto, estado.motivoVerificacion, dias)
  const nombre = estado.negocio?.nombre ?? 'Tu negocio'
  const fecha = estado.suscripcion ? fechaSuscripcion(estado.suscripcion.venceEn) : 'Sin fecha'
  const estadoTexto = nombreEstado(efectivo, estado.verificadoRemoto)
  const bloqueado = !permitido
  const necesitaContacto = bloqueado || aviso
  const tono = bloqueado ? 'coral' : aviso ? 'ambar' : 'verde'

  return (
    <Tarjeta como="section" className="f-cuenta-estado" data-estado={bloqueado ? 'bloqueado' : aviso ? 'aviso' : 'activo'} aria-labelledby="account-status-title">
      <div className="f-cuenta-cabeza">
        <span className="f-cuenta-icono" data-tono={permitido ? 'ok' : 'cuidado'} aria-hidden="true"><IconoEstado estado={efectivo} verificado={estado.verificadoRemoto} /></span>
        <div className="f-cuenta-titulo">
          <span className="f-dato">Cuenta y suscripción</span>
          <h2 id="account-status-title" className="f-seccion">{nombre}</h2>
          <p className="f-dato">Estado comercial y acceso al POS en tiempo real.</p>
        </div>
        <Etiqueta tono={tono} punto>{estadoTexto}</Etiqueta>
      </div>

      <div className="f-cuenta-principal">
        <div className="f-cuenta-copia">
          <span className="f-dato">{bloqueado ? 'Acceso operativo' : aviso ? 'Aviso de vencimiento' : 'Acceso operativo'}</span>
          <strong>{copy.titulo}</strong>
          <p className="f-texto">{copy.texto}</p>
        </div>
        {!bloqueado && estado.suscripcion && (
          <div className="f-cuenta-dias" data-aviso={aviso ? 'true' : undefined} aria-label={`${dias} ${dias === 1 ? 'día restante' : 'días restantes'}`}>
            <strong className="f-plata-36">{dias}</strong><span>{dias === 1 ? 'día restante' : 'días restantes'}</span>
          </div>
        )}
      </div>

      <dl className="f-cuenta-datos">
        <div><dt><IconoTarjeta /> Plan</dt><dd>{tipoSuscripcion(estado.suscripcion?.tipo, estado.suscripcion?.planNombre)}</dd></div>
        <div><dt><IconoCalendarioCuenta /> Vencimiento</dt><dd>{fecha}</dd></div>
        <div><dt><IconoBloqueo /> Acceso</dt><dd>{permitido ? 'Habilitado' : 'Bloqueado'}</dd></div>
        {Boolean(estado.suscripcion?.importeCentavos) && <div><dt><IconoTarjeta /> Importe registrado</dt><dd className="f-plata-16">{formatearPesos(estado.suscripcion?.importeCentavos ?? 0)}</dd></div>}
      </dl>

      {aviso && (
        <div className="f-aviso f-cuenta-alerta" data-tono="ambar" role="alert">
          <IconoAlerta />
          <div><strong>Tu suscripción vence pronto</strong><span>Te quedan {dias} {dias === 1 ? 'día' : 'días'}. Escribinos para renovar y seguir trabajando sin cortes.</span></div>
        </div>
      )}

      {bloqueado && estado.verificadoRemoto && (
        <div className="f-aviso f-cuenta-alerta" role="alert">
          <IconoBloqueo />
          <div><strong>El POS está bloqueado</strong><span>Tus datos siguen guardados; se habilitarán únicamente cuando el administrador confirme la renovación.</span></div>
        </div>
      )}

      {!estado.verificadoRemoto && (
        <div className="f-aviso f-cuenta-alerta" role="alert">
          <IconoAlerta />
          <div><strong>Verificación pendiente</strong><span>Por seguridad, no se habilita el POS sin una validación reciente del servidor.</span></div>
        </div>
      )}

      <div className="f-cuenta-pie">
        <div className="f-cuenta-seguro"><IconoCuentaSegura /><span><strong>Acceso protegido</strong><small>La fecha y el estado se validan en Supabase. La copia local nunca puede habilitar una cuenta vencida.</small></span></div>
        <div className="f-cuenta-acciones">
          {necesitaContacto && <a className={clasesBoton(destacar ? 'principal' : 'secundario')} href={enlaceWhatsApp('', `Hola, necesito revisar la suscripción de ${nombre}.`)} target="_blank" rel="noreferrer">Hablar por WhatsApp</a>}
          <Link className={clasesBoton('secundario')} href="/cuenta">Ver detalle completo</Link>
        </div>
      </div>
    </Tarjeta>
  )
}
