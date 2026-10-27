'use client'

import { cerrarSesion } from '@/datos/nube/sesion'
import type { EstadoAcceso } from '@/datos/nube/acceso'
import { estadoSuscripcion, fechaSuscripcion } from '@/dominio/suscripcion'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton } from './Boton'
import { IconoBloqueo, IconoCerrar, IconoCuentaSegura } from './iconos'

function copyEstado(estado: ReturnType<typeof estadoSuscripcion>, verificadoRemoto: boolean, motivo?: 'sin_red' | 'error_red' | 'vencimiento_local') {
  if (motivo === 'vencimiento_local') {
    return { etiqueta: 'Acceso bloqueado', titulo: 'Suscripción vencida', texto: 'La fecha de vencimiento llegó y el POS fue bloqueado. Renová para continuar usando el negocio.' }
  }
  if (!verificadoRemoto) {
    return motivo === 'sin_red'
      ? { etiqueta: 'Verificación requerida', titulo: 'Conectate para continuar', texto: 'Por seguridad, Libreta no habilita el POS sin confirmar tu suscripción en el servidor.' }
      : { etiqueta: 'Verificación requerida', titulo: 'No pudimos validar tu cuenta', texto: 'El acceso queda pausado hasta confirmar en el servidor que tu suscripción sigue vigente.' }
  }
  if (estado === 'sin_suscripcion') return { etiqueta: 'Cuenta sin activar', titulo: 'Cuenta pendiente de activación', texto: 'Tu cuenta existe, pero todavía no tiene una prueba o suscripción habilitada.' }
  if (estado === 'suspendida') return { etiqueta: 'Acceso suspendido', titulo: 'Cuenta pausada', texto: 'El acceso está pausado. Escribinos para revisar el estado de tu cuenta.' }
  if (estado === 'gracia') return { etiqueta: 'Acceso restringido', titulo: 'Cuenta no habilitada', texto: 'La ventana de gracia no habilita el uso del POS. Contactanos para regularizar el acceso.' }
  if (estado === 'vencida') return { etiqueta: 'Acceso bloqueado', titulo: 'Suscripción vencida', texto: 'El negocio sigue guardado. Cuando regularices el pago, el administrador puede reactivarlo sin perder datos.' }
  return { etiqueta: 'Acceso restringido', titulo: 'No pudimos habilitar el negocio', texto: 'Revisá el estado de tu cuenta con el administrador de Libreta.' }
}

export function PantallaEstadoAcceso({ estado }: { estado: EstadoAcceso }) {
  const efectivo = estadoSuscripcion(estado.suscripcion)
  const copy = copyEstado(efectivo, estado.verificadoRemoto, estado.motivoVerificacion)
  const fecha = estado.suscripcion
    ? fechaSuscripcion(estado.suscripcion.venceEn)
    : null
  const etiqueta = copy.etiqueta ?? (efectivo === 'vencida' ? 'Acceso bloqueado' : 'Cuenta sin acceso')

  async function salir() {
    await cerrarSesion()
  }

  return (
    <div className="access-page">
      <div className="access-card access-status-card form-shell form-card" role="alertdialog" aria-modal="true" aria-labelledby="access-status-title">
        <div className="access-brand">
          <span className="access-brand-mark">L</span>
          <div><strong>Libreta</strong><span>Acceso protegido</span></div>
        </div>
        <div className={`access-status-icon${estado.verificadoRemoto && efectivo !== 'vencida' && efectivo !== 'suspendida' && efectivo !== 'sin_suscripcion' ? ' is-safe' : ''}`} aria-hidden="true"><IconoBloqueo /></div>
        <div>
          <span className="page-kicker">{estado.negocio?.nombre ?? 'Tu negocio'}</span>
          <div className="access-status-label">{etiqueta}</div>
          <h1 id="access-status-title" className="access-title">{copy.titulo}</h1>
          <p className="access-description">{copy.texto}</p>
        </div>
        {fecha && (
          <div className="access-expiry">
            <span>{efectivo === 'vencida' ? 'Venció el' : 'Fecha de vencimiento'}</span>
            <strong>{fecha}</strong>
          </div>
        )}
        <div className="access-security-note">
          <IconoCuentaSegura />
          <span><strong>Control de acceso activo</strong><small>La suscripción se verifica contra el servidor antes de habilitar el POS.</small></span>
        </div>
        <a className="access-contact-button" href={enlaceWhatsApp('', `Hola, necesito revisar el acceso de mi negocio${estado.negocio?.nombre ? ` ${estado.negocio.nombre}` : ''}.`)} target="_blank" rel="noreferrer">
          Hablar por WhatsApp
        </a>
        <a className="access-account-link" href="/cuenta">Ver detalle de mi cuenta</a>
        <Boton variante="secundario" className="button-with-icon w-full" onClick={() => void salir()}>
          <IconoCerrar /> Cerrar sesión en este aparato
        </Boton>
        <p className="form-field-help">Tus datos no se borran por vencer o cerrar sesión.</p>
      </div>
    </div>
  )
}
