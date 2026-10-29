'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cliente } from '@/datos/nube/cliente'
import { accesoSaasObligatorio, cargarEstadoAcceso, EVENTO_ACCESO, type EstadoAcceso } from '@/datos/nube/acceso'
import { accesoPermitido, diasRestantes, estadoSuscripcion, fechaSuscripcion, puedeOperarSinVerificar } from '@/dominio/suscripcion'
import { enlaceWhatsApp } from '@/dominio/mensajes'
import { Navegacion } from './Navegacion'
import { PantallaAcceso } from './PantallaAcceso'
import { PantallaEstadoAcceso } from './PantallaEstadoAcceso'
import { IconoAlerta, IconoCuenta } from './iconos'
import { GuardiaFuncion } from './GuardiaFuncion'
import './acceso.css'

/** Páginas que cualquiera puede leer sin cuenta: los términos y la política
 *  de privacidad tienen que poder consultarse antes de aceptarlos. */
const RUTAS_PUBLICAS = ['/terminos', '/privacidad'] as const

function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`))
}

function AvisoVencimiento({ estado }: { estado: EstadoAcceso }) {
  if (!estado.verificadoRemoto || !estado.suscripcion) return null
  const efectivo = estadoSuscripcion(estado.suscripcion)
  const dias = diasRestantes(estado.suscripcion)
  if (!accesoPermitido(estado.suscripcion) || dias < 1 || dias > 3) return null

  return (
    <div className="subscription-expiry-banner" role="alert">
      <span className="subscription-expiry-icon" aria-hidden="true"><IconoAlerta /></span>
      <div><strong>Tu suscripción vence en {dias} {dias === 1 ? 'día' : 'días'}</strong><p>Vigente hasta {fechaSuscripcion(estado.suscripcion.venceEn)}. Renovala para mantener el acceso.</p></div>
      <div className="subscription-expiry-actions"><a href={enlaceWhatsApp('', `Hola, quiero renovar la suscripción de ${estado.negocio?.nombre ?? 'mi negocio'}.`)} target="_blank" rel="noreferrer">Renovar</a><a href="/cuenta" aria-label="Ver estado de la cuenta" title="Ver estado de la cuenta"><IconoCuenta /></a></div>
      <span className="sr-only">Estado: {efectivo}</span>
    </div>
  )
}

function Marco({ children, admin = false, estado }: { children: React.ReactNode; admin?: boolean; estado?: EstadoAcceso }) {
  return (
    <div className={admin ? 'f-admin-marco' : 'nb-app'}>
      {!admin && <Navegacion />}
      <main className={admin ? 'f-admin-principal' : 'app-main'}>{!admin && estado && <AvisoVencimiento estado={estado} />}{children}</main>
    </div>
  )
}

function CargandoAcceso() {
  return (
    <Marco admin>
      <div className="f-acceso-cargando" role="status" aria-live="polite">
        <span className="f-acceso-marca" aria-hidden="true">L</span>
        <span>Preparando tu acceso…</span>
      </div>
    </Marco>
  )
}

/** Mantiene el POS fuera de alcance hasta que Supabase confirme identidad y
 *  la suscripción manual permita operar. /admin sólo necesita identidad: su
 *  propia función Edge verifica además el rol de administrador. */
export function ControlAcceso({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  const saas = accesoSaasObligatorio()
  const esAdmin = useMemo(() => ruta === '/admin' || ruta.startsWith('/admin/'), [ruta])
  const esCuenta = useMemo(() => ruta === '/cuenta' || ruta.startsWith('/cuenta/'), [ruta])
  const esPublica = useMemo(() => esRutaPublica(ruta ?? ''), [ruta])
  const [estado, setEstado] = useState<EstadoAcceso | null>(null)

  useEffect(() => {
    if (!saas || esPublica) return
    let vivo = true

    async function refrescar() {
      const siguiente = await cargarEstadoAcceso()
      if (vivo) setEstado(siguiente)
    }

    // Primero se descarta el estado de la ruta anterior y recién después se
    // consulta: si la consulta respondía antes que este borrado (sin red o
    // sin nube, cuando todo sale de este aparato), la pantalla quedaba en
    // "Preparando tu acceso…" hasta el próximo chequeo de 30 segundos.
    const limpiarEstadoAnterior = window.setTimeout(() => {
      setEstado(null)
      void refrescar()
    }, 0)
    const cambio = () => void refrescar()
    window.addEventListener(EVENTO_ACCESO, cambio)
    window.addEventListener('online', cambio)
    window.addEventListener('offline', cambio)
    // Supabase advierte que getSession dentro del callback inmediato puede
    // bloquear la inicialización. Se agenda en el siguiente turno.
    const auth = cliente?.auth.onAuthStateChange(() => {
      window.setTimeout(cambio, 0)
    })
    const reloj = window.setInterval(cambio, 30_000)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_ACCESO, cambio)
      window.removeEventListener('online', cambio)
      window.removeEventListener('offline', cambio)
      auth?.data.subscription.unsubscribe()
      window.clearInterval(reloj)
      window.clearTimeout(limpiarEstadoAnterior)
    }
  }, [saas, esAdmin, esCuenta, esPublica])

  // No dejamos una ventana local después del vencimiento que ya conocemos.
  // El timer sólo bloquea la interfaz; RLS vuelve a validar la fecha en cada
  // operación contra Supabase, incluso si alguien manipula el navegador.
  useEffect(() => {
    const suscripcion = estado?.suscripcion
    const venceEn = suscripcion?.venceEn
    if (!saas || !estado?.verificadoRemoto || !suscripcion || !accesoPermitido(suscripcion) || !venceEn) return
    const bloquear = () => {
      setEstado((actual) => actual
        ? { ...actual, verificadoRemoto: false, motivoVerificacion: 'vencimiento_local' }
        : actual)
      void cargarEstadoAcceso().then((siguiente) => setEstado(siguiente))
    }
    const espera = venceEn - Date.now()
    if (espera <= 0) {
      const inmediato = window.setTimeout(bloquear, 0)
      return () => window.clearTimeout(inmediato)
    }
    const relojVencimiento = window.setTimeout(bloquear, espera + 50)
    return () => window.clearTimeout(relojVencimiento)
  }, [saas, estado?.verificadoRemoto, estado?.suscripcion])

  // Sin menú del POS ni chequeo de sesión: sólo el texto, legible para
  // quien todavía no tiene cuenta.
  if (esPublica) return <main className="legal-shell">{children}</main>

  if (!saas) {
    return <Marco><GuardiaFuncion>{children}</GuardiaFuncion></Marco>
  }

  if (!estado) return <CargandoAcceso />
  if (!estado.autenticado) {
    return <PantallaAcceso modo={esAdmin ? 'admin' : 'negocio'} />
  }
  if (esAdmin) {
    return <Marco admin>{children}</Marco>
  }

  // La ficha de cuenta debe seguir disponible para explicar el bloqueo y
  // permitir renovar, pero no abre ninguna pantalla operativa.
  if (esCuenta) {
    return <Marco>{children}</Marco>
  }

  // Sin señal (o con la red fallando) la caja sigue con la última
  // confirmación del servidor, dentro de su vencimiento y por un máximo.
  // El vencimiento detectado en el aparato bloquea igual.
  const sinRed = estado.motivoVerificacion === 'sin_red' || estado.motivoVerificacion === 'error_red'
  const permitido = estado.verificadoRemoto
    ? accesoPermitido(estado.suscripcion)
    : sinRed && puedeOperarSinVerificar(estado.suscripcion, estado.negocio?.verificadoEn)
  if (!estado.negocio || !estado.suscripcion || !permitido) {
    return <PantallaEstadoAcceso estado={estado} />
  }
  return <Marco estado={estado}><GuardiaFuncion>{children}</GuardiaFuncion></Marco>
}
