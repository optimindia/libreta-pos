'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { accesoSaasObligatorio, cargarEstadoAcceso, EVENTO_ACCESO, type EstadoAcceso } from '@/datos/nube/acceso'
import { accesoPermitido, diasRestantes, estadoSuscripcion, fechaSuscripcion } from '@/dominio/suscripcion'
import { formatearPesos } from '@/dominio/dinero'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton } from '@/ui/sistema/Boton'
import { IconoAlerta, IconoBloqueo, IconoCalendarioCuenta, IconoCuentaActiva, IconoCuentaCerrada, IconoCuentaSegura, IconoReintentar, IconoTarjeta } from '@/ui/sistema/iconos'

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
    <section className="account-status-card account-status-local" aria-labelledby="account-status-title">
      <div className="account-status-head">
        <div className="account-status-title">
          <span className="account-status-icon is-safe" aria-hidden="true"><IconoCuentaActiva /></span>
          <div><span className="page-kicker">Cuenta y suscripción</span><h2 id="account-status-title">Modo local</h2><p>Este aparato todavía no está vinculado a una cuenta comercial.</p></div>
        </div>
        <span className="account-status-badge" data-status="local">Local</span>
      </div>
      <div className="account-status-local-copy">
        <strong>La suscripción aparecerá cuando vincules tu negocio.</strong>
        <p>En la versión comercial, el estado se consulta contra el servidor y el acceso se bloquea automáticamente al vencer.</p>
      </div>
    </section>
  )
}

export function EstadoCuenta() {
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
      <section className="account-status-card account-status-loading" aria-busy="true" aria-live="polite">
        <span className="account-status-loading-icon"><IconoReintentar /></span>
        <div><strong>Consultando el estado de tu cuenta…</strong><p>Estamos verificando la suscripción en el servidor.</p></div>
      </section>
    )
  }

  if (!estado) {
    return (
      <section className="account-status-card account-status-error" role="alert">
        <div className="account-status-main-copy"><strong>No pudimos cargar el estado de tu cuenta.</strong><p>Probá nuevamente cuando tengas conexión.</p></div>
        <Boton variante="secundario" className="button-with-icon" onClick={() => void refrescar()}><IconoReintentar /> Reintentar</Boton>
      </section>
    )
  }

  if (!estado.autenticado) {
    return (
      <section className="account-status-card account-status-error" aria-labelledby="account-status-title">
        <div className="account-status-main-copy"><span>Cuenta</span><strong>Iniciá sesión para ver tu suscripción</strong><p>El estado comercial sólo está disponible para la cuenta vinculada al negocio.</p></div>
        <Link className="account-refresh-link" href="/">Ingresar</Link>
      </section>
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

  return (
    <section className={`account-status-card${aviso ? ' is-warning' : ''}${bloqueado ? ' is-blocked' : ''}`} aria-labelledby="account-status-title">
      <div className="account-status-head">
        <div className="account-status-title">
          <span className={`account-status-icon${permitido ? ' is-safe' : ''}`} aria-hidden="true"><IconoEstado estado={efectivo} verificado={estado.verificadoRemoto} /></span>
          <div><span className="page-kicker">Cuenta y suscripción</span><h2 id="account-status-title">{nombre}</h2><p>Estado comercial y acceso al POS en tiempo real.</p></div>
        </div>
        <span className="account-status-badge" data-status={bloqueado ? 'blocked' : aviso ? 'warning' : 'active'}>{estadoTexto}</span>
      </div>

      <div className="account-status-main">
        <div className="account-status-main-copy">
          <span>{bloqueado ? 'Acceso operativo' : aviso ? 'Aviso de vencimiento' : 'Acceso operativo'}</span>
          <strong>{copy.titulo}</strong>
          <p>{copy.texto}</p>
        </div>
        {!bloqueado && estado.suscripcion && (
          <div className="account-status-days" aria-label={`${dias} ${dias === 1 ? 'día restante' : 'días restantes'}`}>
            <strong>{dias}</strong><span>{dias === 1 ? 'día restante' : 'días restantes'}</span>
          </div>
        )}
      </div>

      <dl className="account-status-details">
        <div><dt><IconoTarjeta /> Plan</dt><dd>{tipoSuscripcion(estado.suscripcion?.tipo, estado.suscripcion?.planNombre)}</dd></div>
        <div><dt><IconoCalendarioCuenta /> Vencimiento</dt><dd>{fecha}</dd></div>
        <div><dt><IconoBloqueo /> Acceso</dt><dd>{permitido ? 'Habilitado' : 'Bloqueado'}</dd></div>
        {Boolean(estado.suscripcion?.importeCentavos) && <div><dt><IconoTarjeta /> Importe registrado</dt><dd>{formatearPesos(estado.suscripcion?.importeCentavos ?? 0)}</dd></div>}
      </dl>

      {aviso && (
        <div className="account-renewal-alert" role="alert">
          <IconoAlerta />
          <div><strong>Tu suscripción vence pronto</strong><p>Te quedan {dias} {dias === 1 ? 'día' : 'días'}. Escribinos para renovar y seguir trabajando sin cortes.</p></div>
        </div>
      )}

      {bloqueado && estado.verificadoRemoto && (
        <div className="account-blocked-alert" role="alert">
          <IconoBloqueo />
          <div><strong>El POS está bloqueado</strong><p>Tus datos siguen guardados; se habilitarán únicamente cuando el administrador confirme la renovación.</p></div>
        </div>
      )}

      {!estado.verificadoRemoto && (
        <div className="account-blocked-alert" role="alert">
          <IconoAlerta />
          <div><strong>Verificación pendiente</strong><p>Por seguridad, no se habilita el POS sin una validación reciente del servidor.</p></div>
        </div>
      )}

      <div className="account-status-footer">
        <div className="account-security-note"><IconoCuentaSegura /><span><strong>Acceso protegido</strong><small>La fecha y el estado se validan en Supabase. La copia local nunca puede habilitar una cuenta vencida.</small></span></div>
        <div className="account-status-actions">
          {necesitaContacto && <a className="account-contact-button" href={enlaceWhatsApp('', `Hola, necesito revisar la suscripción de ${nombre}.`)} target="_blank" rel="noreferrer">Hablar por WhatsApp</a>}
          <Link className="account-refresh-link" href="/cuenta">Ver detalle completo</Link>
        </div>
      </div>
    </section>
  )
}
