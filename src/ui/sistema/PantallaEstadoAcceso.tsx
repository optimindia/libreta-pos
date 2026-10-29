'use client'

import { cerrarSesion } from '@/datos/nube/sesion'
import type { EstadoAcceso } from '@/datos/nube/acceso'
import { estadoSuscripcion, fechaSuscripcion } from '@/dominio/suscripcion'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Boton, clasesBoton } from './Boton'
import { Etiqueta } from './Etiqueta'
import { Tarjeta } from './Tarjeta'
import './acceso.css'
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

const COPY_VENDEDOR_QUITADO = {
  etiqueta: 'Acceso retirado',
  titulo: 'Ya no tenés acceso a este negocio',
  texto: 'El dueño te quitó del negocio, así que borramos los datos de este aparato. Si fue un error, pedile que te vuelva a agregar y entrá de nuevo.',
}

export function PantallaEstadoAcceso({ estado }: { estado: EstadoAcceso }) {
  const efectivo = estadoSuscripcion(estado.suscripcion)
  const copy = estado.motivoSinNegocio === 'vendedor_quitado'
    ? COPY_VENDEDOR_QUITADO
    : copyEstado(efectivo, estado.verificadoRemoto, estado.motivoVerificacion)
  const fecha = estado.suscripcion
    ? fechaSuscripcion(estado.suscripcion.venceEn)
    : null
  const etiqueta = copy.etiqueta ?? (efectivo === 'vencida' ? 'Acceso bloqueado' : 'Cuenta sin acceso')

  async function salir() {
    await cerrarSesion()
  }

  const seguro = estado.verificadoRemoto && efectivo !== 'vencida' && efectivo !== 'suspendida' && efectivo !== 'sin_suscripcion'

  return (
    <div className="f-acceso">
      <Tarjeta como="section" relleno="grande" className="f-acceso-tarjeta" role="alertdialog" aria-modal="true" aria-labelledby="access-status-title">
        <div className="f-acceso-marca-fila">
          <span className="f-acceso-marca" aria-hidden="true">L</span>
          <div><strong>Libreta</strong><span>Acceso protegido</span></div>
        </div>
        <div className="f-acceso-estado">
          <span className="f-acceso-icono f-acceso-icono-grande" data-tono={seguro ? 'ok' : 'cuidado'} aria-hidden="true"><IconoBloqueo /></span>
          <div>
            <span className="f-dato">{estado.negocio?.nombre ?? 'Tu negocio'}</span>
            <div className="f-acceso-etiqueta"><Etiqueta tono={seguro ? 'verde' : 'coral'} punto>{etiqueta}</Etiqueta></div>
            <h1 id="access-status-title" className="f-seccion">{copy.titulo}</h1>
            <p className="f-texto">{copy.texto}</p>
          </div>
        </div>
        {fecha && (
          <div className="f-acceso-vence">
            <span>{efectivo === 'vencida' ? 'Venció el' : 'Fecha de vencimiento'}</span>
            <strong>{fecha}</strong>
          </div>
        )}
        <div className="f-acceso-nota f-acceso-seguro">
          <IconoCuentaSegura />
          <span><strong>Control de acceso activo</strong><small>La suscripción se verifica contra el servidor antes de habilitar el POS.</small></span>
        </div>
        <a className={clasesBoton('principal')} href={enlaceWhatsApp('', `Hola, necesito revisar el acceso de mi negocio${estado.negocio?.nombre ? ` ${estado.negocio.nombre}` : ''}.`)} target="_blank" rel="noreferrer">
          Hablar por WhatsApp
        </a>
        <a className={clasesBoton('secundario')} href="/cuenta">Ver detalle de mi cuenta</a>
        <Boton variante="secundario" ancho onClick={() => void salir()}>
          <IconoCerrar /> Cerrar sesión en este aparato
        </Boton>
        {estado.motivoSinNegocio !== 'vendedor_quitado' && <p className="f-acceso-ayuda">Tus datos no se borran por vencer o cerrar sesión.</p>}
      </Tarjeta>
    </div>
  )
}
