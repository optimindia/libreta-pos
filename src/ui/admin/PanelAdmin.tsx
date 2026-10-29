'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { adminAccion, type AdminCuenta, type AdminCuentaActualizada, type AdminCuentaCreada, type AdminCredencialesRegeneradas, type AdminEvento, type AdminListado, type AdminPlan, type AdminPlanGuardado, type AdminSuscripcionActualizada, type AdminVendedor, type AdminVendedorAgregado, type MedioPagoAdmin, type TipoPlan } from '@/datos/nube/admin'
import { cerrarSesion } from '@/datos/nube/sesion'
import { enlaceWhatsApp, mensajeAcceso } from '@/dominio/mensajes'
import { formatearPesos, pesosACentavos } from '@/dominio/dinero'
import { Boton } from '@/ui/sistema/Boton'
import { CampoBusqueda } from '@/ui/sistema/CampoBusqueda'
import { Etiqueta, type TonoEtiqueta } from '@/ui/sistema/Etiqueta'
import { Hoja } from '@/ui/sistema/Hoja'
import { Tarjeta } from '@/ui/sistema/Tarjeta'
import '@/ui/sistema/acceso.css'
import './admin.css'
import { IconoAlerta, IconoBloqueo, IconoBuscar, IconoCalendarioCuenta, IconoCerrar, IconoClientes, IconoEditar, IconoEliminar, IconoNube, IconoNuevaVenta, IconoReintentar, IconoSincronizado } from '@/ui/sistema/iconos'

const FORMULARIO_INICIAL = { nombre: '', telefono: '', pin: '', diasPrueba: '7', planId: '', nota: '' }
const FORMULARIO_SUSCRIPCION = { planId: '', dias: '30', modo: 'sumar' as 'sumar' | 'reiniciar', importe: '', medioPago: '' as MedioPagoAdmin | '', referenciaPago: '', nota: '' }
const FORMULARIO_PLAN = { nombre: '', descripcion: '', tipo: 'pago' as TipoPlan, dias: '30', precio: '', orden: '100', activo: true }
const DIAS_EN_MILISEGUNDOS = 86_400_000

// Botones de las tarjetas y formularios: 44 px o más, sin competir con el
// único botón lima de la pantalla ("Crear cuenta y prueba").
const BTN = 'f-boton f-boton-secundario f-admin-btn'
const BTN_FUERTE = 'f-boton f-boton-secundario f-admin-btn f-admin-btn-fuerte'
const BTN_CUIDADO = 'f-boton f-boton-cuidado f-admin-btn'
// Dentro de una hoja, el envío del formulario es la acción principal.
const BTN_HOJA = 'f-boton f-boton-principal f-admin-btn'

type FiltroCuenta = 'todas' | 'activas' | 'por_vencer' | 'vencidas' | 'suspendidas'
type ModalAdmin =
  | { tipo: 'suscripcion'; cuenta: AdminCuenta }
  | { tipo: 'cuenta'; cuenta: AdminCuenta }
  | { tipo: 'pin'; cuenta: AdminCuenta }
  | { tipo: 'vendedores'; cuenta: AdminCuenta }

const FORMULARIO_VENDEDOR = { nombre: '', telefono: '', pin: '' }

const NOMBRES_ESTADO: Record<AdminCuenta['estado'], string> = {
  prueba: 'Prueba',
  activa: 'Activa',
  gracia: 'Sin acceso',
  suspendida: 'Suspendida',
  vencida: 'Vencida',
  sin_suscripcion: 'Sin activar',
}

const TONO_ESTADO: Record<AdminCuenta['estado'], TonoEtiqueta> = {
  prueba: 'ambar',
  activa: 'verde',
  gracia: 'coral',
  suspendida: 'gris',
  vencida: 'coral',
  sin_suscripcion: 'gris',
}

const NOMBRES_EVENTO: Record<string, string> = {
  cuenta_creada: 'Cuenta creada',
  cuenta_actualizada: 'Datos actualizados',
  credenciales_regeneradas: 'PIN regenerado',
  suscripcion_prueba: 'Prueba actualizada',
  suscripcion_activar: 'Suscripción activada',
  suscripcion_extender: 'Suscripción extendida',
  suscripcion_suspender: 'Cuenta suspendida',
  suscripcion_reactivar: 'Cuenta reactivada',
  vendedor_agregado: 'Vendedor agregado',
  vendedor_pin: 'PIN de vendedor cambiado',
  vendedor_quitado: 'Vendedor quitado',
}

function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(fecha))
}

function inicialDe(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || 'N'
}

function textoDias(cuenta: AdminCuenta): string {
  if (cuenta.estado === 'gracia' || cuenta.estado === 'vencida' || cuenta.estado === 'suspendida' || cuenta.estado === 'sin_suscripcion') return 'Sin acceso operativo'
  if (cuenta.diasRestantes === 1) return 'Queda 1 día'
  return `Quedan ${cuenta.diasRestantes} días`
}

function nombreEvento(evento: AdminEvento): string {
  return NOMBRES_EVENTO[evento.accion] ?? evento.accion.replaceAll('_', ' ')
}

function dineroEnPesos(centavos: number): string {
  return centavos > 0 ? formatearPesos(centavos) : 'Precio manual'
}

function planPorDefecto(planes: AdminPlan[], cuenta: AdminCuenta): AdminPlan | undefined {
  const actual = cuenta.suscripcion?.planId ? planes.find((plan) => plan.id === cuenta.suscripcion?.planId && plan.activo) : undefined
  return actual ?? planes.find((plan) => plan.codigo === 'mensual-30' && plan.activo) ?? planes.find((plan) => plan.tipo === 'pago' && plan.activo)
}

function operacionPara(cuenta: AdminCuenta): 'activar' | 'extender' | 'reactivar' {
  if (cuenta.estado === 'suspendida') return 'reactivar'
  if (cuenta.estado === 'vencida' || cuenta.estado === 'sin_suscripcion' || cuenta.estado === 'gracia') return 'activar'
  return 'extender'
}

function vencimientoEstimado(cuenta: AdminCuenta, formulario: typeof FORMULARIO_SUSCRIPCION): string | null {
  const dias = Number(formulario.dias)
  if (!Number.isInteger(dias) || dias < 1 || dias > 3650) return null
  const actual = cuenta.suscripcion ? new Date(cuenta.suscripcion.venceEn).getTime() : 0
  const base = formulario.modo === 'reiniciar' ? Date.now() : Math.max(Date.now(), actual)
  return new Date(base + dias * DIAS_EN_MILISEGUNDOS).toISOString()
}

function ModalMarco({ titulo, subtitulo, onClose, children }: { titulo: string; subtitulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Hoja abierta onCerrar={onClose} titulo={titulo} etiquetaCerrar="Cerrar ventana">
      <p className="f-hoja-ayuda">{subtitulo}</p>
      {children}
    </Hoja>
  )
}

function TarjetaCredenciales({ credenciales, copiado, copiar }: { credenciales: { telefono: string; pin: string }; copiado: string | null; copiar: (texto: string, clave: string) => Promise<void> }) {
  return (
    <div className="f-admin-credenciales" role="status">
      <div><strong className="f-renglon-texto">Acceso listo para enviar</strong><p className="f-dato">Este PIN sólo se muestra durante esta sesión del panel.</p></div>
      <div className="f-admin-credencial"><span>Teléfono</span><strong>{credenciales.telefono}</strong><button type="button" className={BTN} onClick={() => void copiar(credenciales.telefono, 'telefono')}>{copiado === 'telefono' ? 'Copiado' : 'Copiar'}</button></div>
      <div className="f-admin-credencial"><span>PIN</span><strong>{credenciales.pin}</strong><button type="button" className={BTN} onClick={() => void copiar(credenciales.pin, 'pin')}>{copiado === 'pin' ? 'Copiado' : 'Copiar'}</button></div>
      <a className={BTN} href={enlaceWhatsApp(credenciales.telefono, mensajeAcceso(credenciales.telefono, credenciales.pin, window.location.origin))} target="_blank" rel="noreferrer">Abrir WhatsApp con el acceso</a>
    </div>
  )
}

export function PanelAdmin() {
  const [cuentas, setCuentas] = useState<AdminCuenta[]>([])
  const [eventos, setEventos] = useState<AdminEvento[]>([])
  const [planes, setPlanes] = useState<AdminPlan[]>([])
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
  const [formSuscripcion, setFormSuscripcion] = useState(FORMULARIO_SUSCRIPCION)
  const [formCuenta, setFormCuenta] = useState({ nombre: '', telefono: '', notaInterna: '' })
  const [formPin, setFormPin] = useState('')
  const [formPlan, setFormPlan] = useState(FORMULARIO_PLAN)
  const [formVendedor, setFormVendedor] = useState(FORMULARIO_VENDEDOR)
  const [pinVendedor, setPinVendedor] = useState<{ usuarioId: string; pin: string } | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [credenciales, setCredenciales] = useState<AdminCuentaCreada['credenciales'] | null>(null)
  const [modal, setModal] = useState<ModalAdmin | null>(null)
  const [planEditorAbierto, setPlanEditorAbierto] = useState(false)
  const [planEditando, setPlanEditando] = useState<AdminPlan | null>(null)
  const [filtro, setFiltro] = useState<FiltroCuenta>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [accion, setAccion] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await adminAccion<AdminListado>({ accion: 'listar' })
      setCuentas(respuesta.cuentas)
      setEventos(respuesta.eventos)
      setPlanes(respuesta.planes)
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo cargar el panel.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const inicio = window.setTimeout(() => void cargar(), 0)
    return () => window.clearTimeout(inicio)
  }, [cargar])

  const resumen = useMemo(() => ({
    total: cuentas.length,
    operativas: cuentas.filter((cuenta) => ['prueba', 'activa'].includes(cuenta.estado)).length,
    porVencer: cuentas.filter((cuenta) => ['prueba', 'activa'].includes(cuenta.estado) && cuenta.diasRestantes >= 1 && cuenta.diasRestantes <= 7).length,
    vencidas: cuentas.filter((cuenta) => ['gracia', 'vencida', 'sin_suscripcion'].includes(cuenta.estado)).length,
    suspendidas: cuentas.filter((cuenta) => cuenta.estado === 'suspendida').length,
  }), [cuentas])

  const cuentasVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-AR')
    return cuentas.filter((cuenta) => {
      const coincideTexto = !termino || `${cuenta.nombre} ${cuenta.telefono ?? ''}`.toLocaleLowerCase('es-AR').includes(termino)
      const coincideFiltro = filtro === 'todas'
        || (filtro === 'activas' && ['prueba', 'activa'].includes(cuenta.estado))
        || (filtro === 'por_vencer' && ['prueba', 'activa'].includes(cuenta.estado) && cuenta.diasRestantes >= 1 && cuenta.diasRestantes <= 7)
        || (filtro === 'vencidas' && ['gracia', 'vencida', 'sin_suscripcion'].includes(cuenta.estado))
        || (filtro === 'suspendidas' && cuenta.estado === 'suspendida')
      return coincideTexto && coincideFiltro
    })
  }, [busqueda, cuentas, filtro])

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setGuardando(true)
    setAviso(null)
    setError(null)
    setCredenciales(null)
    try {
      const respuesta = await adminAccion<AdminCuentaCreada>({
        accion: 'crear',
        nombre: formulario.nombre,
        telefono: formulario.telefono,
        pin: formulario.pin,
        diasPrueba: Number(formulario.diasPrueba),
        planId: formulario.planId || undefined,
        nota: formulario.nota || undefined,
      })
      setCredenciales(respuesta.credenciales)
      setFormulario(FORMULARIO_INICIAL)
      setAviso('Cuenta creada. Mandale las credenciales al cliente por WhatsApp.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo crear la cuenta.')
    } finally {
      setGuardando(false)
    }
  }

  async function suspender(cuenta: AdminCuenta) {
    if (!window.confirm(`¿Pausar el acceso de ${cuenta.nombre}? Sus datos quedan guardados.`)) return
    setAccion(`${cuenta.id}:suspender`)
    setAviso(null)
    setError(null)
    try {
      await adminAccion<AdminSuscripcionActualizada>({ accion: 'suscripcion', negocioId: cuenta.id, operacion: 'suspender' })
      setAviso('Cuenta pausada. El cliente conserva sus datos, pero no puede operar.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo pausar la cuenta.')
    } finally {
      setAccion(null)
    }
  }

  function abrirSuscripcion(cuenta: AdminCuenta) {
    const plan = planPorDefecto(planes, cuenta)
    setFormSuscripcion({
      planId: plan?.id ?? '',
      dias: String(plan?.dias ?? 30),
      modo: 'sumar',
      importe: cuenta.suscripcion?.importeCentavos ? String(cuenta.suscripcion.importeCentavos / 100) : plan?.precioCentavos ? String(plan.precioCentavos / 100) : '',
      medioPago: '',
      referenciaPago: '',
      nota: '',
    })
    setModal({ tipo: 'suscripcion', cuenta })
  }

  async function guardarSuscripcion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!modal || modal.tipo !== 'suscripcion') return
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      const importe = formSuscripcion.importe.trim() === '' ? undefined : pesosACentavos(Number(formSuscripcion.importe.replace(',', '.')))
      await adminAccion<AdminSuscripcionActualizada>({
        accion: 'suscripcion',
        negocioId: modal.cuenta.id,
        operacion: operacionPara(modal.cuenta),
        planId: formSuscripcion.planId || undefined,
        dias: Number(formSuscripcion.dias),
        modo: formSuscripcion.modo,
        importeCentavos: importe,
        medioPago: formSuscripcion.medioPago || undefined,
        referenciaPago: formSuscripcion.referenciaPago || undefined,
        nota: formSuscripcion.nota || undefined,
      })
      setModal(null)
      setAviso('Suscripción actualizada. El cambio queda activo en el próximo chequeo del cliente.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo actualizar la suscripción.')
    } finally {
      setGuardando(false)
    }
  }

  function abrirEdicion(cuenta: AdminCuenta) {
    setFormCuenta({ nombre: cuenta.nombre, telefono: cuenta.telefono ?? '', notaInterna: cuenta.notaInterna ?? '' })
    setModal({ tipo: 'cuenta', cuenta })
  }

  async function guardarCuenta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!modal || modal.tipo !== 'cuenta') return
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      await adminAccion<AdminCuentaActualizada>({ accion: 'cuenta', negocioId: modal.cuenta.id, operacion: 'editar', ...formCuenta })
      setModal(null)
      setAviso('Datos del cliente actualizados.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudieron guardar los datos.')
    } finally {
      setGuardando(false)
    }
  }

  async function regenerarPin(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!modal || modal.tipo !== 'pin') return
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      const respuesta = await adminAccion<AdminCredencialesRegeneradas>({ accion: 'cuenta', negocioId: modal.cuenta.id, operacion: 'regenerar_pin', pin: formPin })
      setCredenciales(respuesta.credenciales)
      setFormPin('')
      setModal(null)
      setAviso('PIN regenerado. Copialo y envialo al cliente por WhatsApp.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo regenerar el PIN.')
    } finally {
      setGuardando(false)
    }
  }

  function abrirVendedores(cuenta: AdminCuenta) {
    setFormVendedor(FORMULARIO_VENDEDOR)
    setPinVendedor(null)
    setQuitando(null)
    setCredenciales(null)
    setAviso(null)
    setError(null)
    setModal({ tipo: 'vendedores', cuenta })
  }

  /** Vuelve a leer el panel y deja abierta la cuenta con sus vendedores al día. */
  async function refrescarVendedores(negocioId: string) {
    const respuesta = await adminAccion<AdminListado>({ accion: 'listar' })
    setCuentas(respuesta.cuentas)
    setEventos(respuesta.eventos)
    setPlanes(respuesta.planes)
    const actual = respuesta.cuentas.find((cuenta) => cuenta.id === negocioId)
    setModal(actual ? { tipo: 'vendedores', cuenta: actual } : null)
  }

  async function operarVendedor(tarea: () => Promise<string>, falla: string) {
    if (!modal || modal.tipo !== 'vendedores') return
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      setAviso(await tarea())
      await refrescarVendedores(modal.cuenta.id)
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : falla)
    } finally {
      setGuardando(false)
    }
  }

  function agregarVendedor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!modal || modal.tipo !== 'vendedores') return
    const negocioId = modal.cuenta.id
    void operarVendedor(async () => {
      const respuesta = await adminAccion<AdminVendedorAgregado>({ accion: 'vendedor', negocioId, operacion: 'agregar', ...formVendedor })
      setCredenciales(respuesta.credenciales)
      setFormVendedor(FORMULARIO_VENDEDOR)
      return `${respuesta.vendedor.nombre} ya puede entrar con su teléfono y PIN.`
    }, 'No se pudo agregar el vendedor.')
  }

  function cambiarPinVendedor(evento: FormEvent<HTMLFormElement>, vendedor: AdminVendedor) {
    evento.preventDefault()
    if (!modal || modal.tipo !== 'vendedores' || !pinVendedor) return
    const negocioId = modal.cuenta.id
    const pin = pinVendedor.pin
    void operarVendedor(async () => {
      const respuesta = await adminAccion<AdminCredencialesRegeneradas>({ accion: 'vendedor', negocioId, operacion: 'pin', usuarioId: vendedor.usuarioId, pin })
      setCredenciales(respuesta.credenciales)
      setPinVendedor(null)
      return `PIN nuevo para ${vendedor.nombre ?? 'el vendedor'}. El anterior ya no funciona.`
    }, 'No se pudo cambiar el PIN.')
  }

  function quitarVendedor(vendedor: AdminVendedor) {
    if (!modal || modal.tipo !== 'vendedores') return
    const negocioId = modal.cuenta.id
    void operarVendedor(async () => {
      await adminAccion<{ ok: true }>({ accion: 'vendedor', negocioId, operacion: 'quitar', usuarioId: vendedor.usuarioId })
      setQuitando(null)
      return `${vendedor.nombre ?? 'El vendedor'} ya no tiene acceso. Sus ventas quedan en el negocio.`
    }, 'No se pudo quitar el vendedor.')
  }

  function abrirNuevoPlan() {
    setPlanEditando(null)
    setFormPlan(FORMULARIO_PLAN)
    setPlanEditorAbierto(true)
  }

  function editarPlan(plan: AdminPlan) {
    setPlanEditando(plan)
    setFormPlan({ nombre: plan.nombre, descripcion: plan.descripcion ?? '', tipo: plan.tipo, dias: String(plan.dias), precio: plan.precioCentavos ? String(plan.precioCentavos / 100) : '', orden: String(plan.orden), activo: plan.activo })
    setPlanEditorAbierto(true)
  }

  async function guardarPlan(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setGuardando(true)
    setAviso(null)
    setError(null)
    try {
      const base = { nombre: formPlan.nombre, descripcion: formPlan.descripcion || undefined, tipo: formPlan.tipo, dias: Number(formPlan.dias), precioCentavos: formPlan.tipo === 'pago' && formPlan.precio.trim() !== '' ? pesosACentavos(Number(formPlan.precio.replace(',', '.'))) : 0, activo: formPlan.activo, orden: Number(formPlan.orden) }
      if (planEditando) {
        await adminAccion<AdminPlanGuardado>({ accion: 'plan', operacion: 'actualizar', planId: planEditando.id, ...base })
        setAviso('Paquete actualizado. Las cuentas ya activas conservan el nombre y precio registrados al renovarlas.')
      } else {
        await adminAccion<AdminPlanGuardado>({ accion: 'plan', operacion: 'crear', ...base })
        setAviso('Nuevo paquete creado.')
      }
      setPlanEditorAbierto(false)
      setPlanEditando(null)
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo guardar el paquete.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstadoPlan(plan: AdminPlan) {
    const operacion = plan.activo ? 'archivar' : 'restaurar'
    if (plan.activo && !window.confirm(`¿Archivar ${plan.nombre}? Seguirá apareciendo en el historial, pero no se podrá asignar a nuevas renovaciones.`)) return
    setAccion(`plan:${plan.id}`)
    setAviso(null)
    setError(null)
    try {
      await adminAccion<AdminPlanGuardado>({ accion: 'plan', operacion, planId: plan.id })
      setAviso(plan.activo ? 'Paquete archivado.' : 'Paquete restaurado.')
      await cargar()
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo cambiar el estado del paquete.')
    } finally {
      setAccion(null)
    }
  }

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      window.setTimeout(() => setCopiado(null), 1800)
    } catch {
      setAviso('No se pudo copiar automáticamente. Seleccioná el dato y copialo manualmente.')
    }
  }

  async function salir() {
    await cerrarSesion()
  }

  return (
    <div className="f-admin">
      <header className="f-admin-cabeza">
        <div className="f-admin-marca">
          <span className="f-acceso-marca" aria-hidden="true">L</span>
          <div><span className="f-dato">Libreta</span><h1 className="f-titulo">Centro de cuentas</h1><p className="f-dato">Clientes, paquetes y suscripciones en un solo lugar</p></div>
        </div>
        <button type="button" className={BTN} onClick={() => void salir()}><IconoCerrar /> Salir</button>
      </header>

      <section className="f-admin-banner">
        <span className="f-acceso-icono" aria-hidden="true"><IconoNube /></span>
        <div><strong className="f-renglon-texto">Operación manual, con control profesional</strong><p className="f-texto">Recibís el pago por el medio que uses, registrás el paquete o los días exactos y Libreta aplica el vencimiento automáticamente.</p></div>
      </section>

      <section className="f-admin-resumen" aria-label="Resumen de cuentas">
        <button type="button" className="f-admin-resumen-item" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}><span>Cuentas</span><strong className="f-plata-36">{resumen.total}</strong><small>en cartera</small></button>
        <button type="button" className="f-admin-resumen-item" aria-pressed={filtro === 'activas'} onClick={() => setFiltro('activas')}><span>Operativas</span><strong className="f-plata-36">{resumen.operativas}</strong><small>con acceso</small></button>
        <button type="button" className="f-admin-resumen-item" aria-pressed={filtro === 'por_vencer'} onClick={() => setFiltro('por_vencer')}><span>Por vencer</span><strong className="f-plata-36">{resumen.porVencer}</strong><small>en 7 días</small></button>
        <button type="button" className="f-admin-resumen-item" aria-pressed={filtro === 'vencidas'} onClick={() => setFiltro('vencidas')}><span>Vencidas</span><strong className="f-plata-36">{resumen.vencidas}</strong><small>requieren acción</small></button>
        <button type="button" className="f-admin-resumen-item" aria-pressed={filtro === 'suspendidas'} onClick={() => setFiltro('suspendidas')}><span>Pausadas</span><strong className="f-plata-36">{resumen.suspendidas}</strong><small>sin acceso</small></button>
      </section>

      <div className="f-admin-cuerpo">
        <Tarjeta como="section" className="f-admin-crear">
          <div className="f-admin-titulo-seccion">
            <span className="f-acceso-icono" aria-hidden="true"><IconoNuevaVenta /></span>
            <div><span className="f-dato">Alta manual</span><h2 className="f-seccion">Crear una cuenta</h2><p className="f-dato">Generá el acceso del negocio y su prueba inicial.</p></div>
          </div>
          <form className="f-admin-form" onSubmit={(evento) => void crear(evento)}>
            <label className="f-campo"><span>Nombre del negocio <em>obligatorio</em></span><input className="f-entrada" placeholder="Ej. Almacén Los Andes" value={formulario.nombre} onChange={(evento) => setFormulario((actual) => ({ ...actual, nombre: evento.target.value }))} required /></label>
            <label className="f-campo"><span>WhatsApp / teléfono <em>para iniciar sesión</em></span><input className="f-entrada f-admin-num" inputMode="tel" placeholder="Ej. 261 555 1234" value={formulario.telefono} onChange={(evento) => setFormulario((actual) => ({ ...actual, telefono: evento.target.value }))} required /></label>
            <div className="f-admin-fila">
              <label className="f-campo"><span>PIN inicial <em>6 números</em></span><input className="f-entrada f-admin-num" inputMode="numeric" type="password" maxLength={6} autoComplete="new-password" placeholder="123456" value={formulario.pin} onChange={(evento) => setFormulario((actual) => ({ ...actual, pin: evento.target.value.replace(/\D/g, '').slice(0, 6) }))} required /></label>
              <label className="f-campo"><span>Días de prueba <em>1 a 90</em></span><input className="f-entrada f-admin-num" type="number" min={1} max={90} value={formulario.diasPrueba} onChange={(evento) => setFormulario((actual) => ({ ...actual, diasPrueba: evento.target.value }))} required /></label>
            </div>
            <label className="f-campo"><span>Paquete de prueba <em>opcional</em></span><select className="f-entrada" value={formulario.planId} onChange={(evento) => { const plan = planes.find((item) => item.id === evento.target.value); setFormulario((actual) => ({ ...actual, planId: evento.target.value, diasPrueba: plan ? String(Math.min(plan.dias, 90)) : actual.diasPrueba })) }}><option value="">Prueba personalizada</option>{planes.filter((plan) => plan.activo && plan.tipo === 'prueba').map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre} · {plan.dias} días</option>)}</select></label>
            <label className="f-campo"><span>Nota interna <em>opcional</em></span><textarea className="f-entrada f-admin-texto" rows={2} placeholder="Ej. llegó por recomendación" value={formulario.nota} onChange={(evento) => setFormulario((actual) => ({ ...actual, nota: evento.target.value }))} /></label>
            <Boton type="submit" variante="principal" ancho disabled={guardando}><IconoNuevaVenta /> {guardando ? 'Creando cuenta…' : 'Crear cuenta y prueba'}</Boton>
          </form>
          {credenciales && <TarjetaCredenciales credenciales={credenciales} copiado={copiado} copiar={copiar} />}
        </Tarjeta>

        <section className="f-admin-cartera">
          <div className="f-admin-fila-titulo"><div><span className="f-dato">Cartera</span><h2 className="f-seccion">Negocios registrados</h2><p className="f-dato">{cuentasVisibles.length} de {cuentas.length} cuentas visibles</p></div><button type="button" className={BTN} onClick={() => void cargar()} disabled={cargando} aria-label="Actualizar cuentas"><IconoReintentar /> {cargando ? 'Cargando…' : 'Actualizar'}</button></div>
          <div className="f-admin-filtros">
            <CampoBusqueda etiqueta="Buscar cliente" valor={busqueda} onCambiar={setBusqueda} placeholder="Buscar por negocio o teléfono" />
            <label className="f-admin-filtro"><span className="f-sr">Filtrar cuentas</span><select className="f-entrada" value={filtro} onChange={(evento) => setFiltro(evento.target.value as FiltroCuenta)}><option value="todas">Todas las cuentas</option><option value="activas">Con acceso</option><option value="por_vencer">Vencen en 7 días</option><option value="vencidas">Vencidas / sin activar</option><option value="suspendidas">Pausadas</option></select></label>
          </div>
          {error && <p className="f-aviso" role="alert">{error}</p>}
          {aviso && <p className="f-aviso f-admin-ok" role="status">{aviso}</p>}
          {cargando && cuentas.length === 0 && <div className="f-admin-vacio"><IconoReintentar /><span>Trayendo cuentas…</span></div>}
          {!cargando && cuentas.length > 0 && cuentasVisibles.length === 0 && <div className="f-admin-vacio"><IconoBuscar /><strong>No encontramos esa cuenta</strong><span>Probá con otro nombre, teléfono o filtro.</span></div>}
          {!cargando && cuentas.length === 0 && <div className="f-admin-vacio"><IconoSincronizado /><strong>Todavía no hay cuentas</strong><span>Creá el primer negocio desde el formulario.</span></div>}
          <div className="f-admin-lista">
            {cuentasVisibles.map((cuenta) => {
              const ocupado = accion?.startsWith(`${cuenta.id}:`) ?? false
              const contacto = cuenta.telefono ?? ''
              return (
                <Tarjeta como="article" className="f-admin-cuenta" key={cuenta.id}>
                  <div className="f-admin-cuenta-arriba">
                    <span className="f-admin-avatar" aria-hidden="true">{inicialDe(cuenta.nombre)}</span>
                    <div className="f-admin-cuenta-copia"><h3 className="f-renglon-texto">{cuenta.nombre}</h3><p className="f-dato">{cuenta.telefono || 'Sin teléfono'} · creada {fechaCorta(cuenta.creadoEn)}</p></div>
                    <Etiqueta tono={TONO_ESTADO[cuenta.estado]} punto>{NOMBRES_ESTADO[cuenta.estado]}</Etiqueta>
                  </div>
                  <div className="f-admin-meta">
                    <span><small>Estado operativo</small><strong>{textoDias(cuenta)}</strong></span>
                    <span><small>Vencimiento</small><strong>{cuenta.suscripcion ? fechaCorta(cuenta.suscripcion.venceEn) : 'Sin plan'}</strong></span>
                    <span><small>Vendedores</small><strong>{(cuenta.vendedores?.length ?? 0) === 0 ? 'Sólo el dueño' : `${cuenta.vendedores?.length} con acceso`}</strong></span>
                    <span><small>Paquete</small><strong>{cuenta.suscripcion?.planNombre ?? (cuenta.suscripcion?.tipo === 'prueba' ? 'Prueba gratuita' : cuenta.suscripcion ? 'Activación manual' : 'Pendiente')}</strong></span>
                  </div>
                  {cuenta.notaInterna && <p className="f-aviso f-admin-nota-cuenta" data-tono="ambar"><IconoAlerta /> {cuenta.notaInterna}</p>}
                  <div className="f-admin-acciones-cuenta">
                    <button type="button" className={BTN_FUERTE} disabled={ocupado} onClick={() => abrirSuscripcion(cuenta)}><IconoCalendarioCuenta /> Gestionar suscripción</button>
                    <button type="button" className={BTN} disabled={ocupado} onClick={() => abrirEdicion(cuenta)}><IconoEditar /> Editar</button>
                    <button type="button" className={BTN} disabled={ocupado} onClick={() => abrirVendedores(cuenta)}><IconoClientes /> Vendedores</button>
                    <a className={BTN} href={enlaceWhatsApp(contacto, `Hola ${cuenta.nombre}, ¿cómo estás? Quería avisarte que tu cuenta de Libreta vence ${cuenta.suscripcion ? fechaCorta(cuenta.suscripcion.venceEn) : 'próximamente'}. Escribime si querés renovarla.`)} target="_blank" rel="noreferrer"><IconoNube /> WhatsApp</a>
                    {cuenta.estado !== 'suspendida' && <button type="button" className={BTN_CUIDADO} disabled={ocupado} onClick={() => void suspender(cuenta)}>{ocupado ? 'Pausando…' : 'Pausar'}</button>}
                  </div>
                </Tarjeta>
              )
            })}
          </div>
        </section>
      </div>

      <section className="f-admin-planes">
        <div className="f-admin-fila-titulo"><div><span className="f-dato">Catálogo comercial</span><h2 className="f-seccion">Paquetes y precios</h2><p className="f-dato">Elegí uno al renovar o definí días exactos. Archivar conserva el historial.</p></div><button type="button" className={BTN_FUERTE} onClick={abrirNuevoPlan}><IconoNuevaVenta /> Nuevo paquete</button></div>
        {planEditorAbierto && <form className="f-tarjeta f-admin-editor" data-relleno="normal" onSubmit={(evento) => void guardarPlan(evento)}>
          <div className="f-admin-editor-cabeza"><div><strong className="f-renglon-texto">{planEditando ? 'Editar paquete' : 'Crear paquete'}</strong><p className="f-dato">El precio es informativo: el cobro sigue siendo manual por ahora.</p></div><button type="button" className="f-icono-boton" onClick={() => setPlanEditorAbierto(false)} aria-label="Cerrar editor"><IconoCerrar /></button></div>
          <div className="f-admin-grilla">
            <label className="f-campo"><span>Nombre <em>obligatorio</em></span><input className="f-entrada" placeholder="Ej. Trimestral" value={formPlan.nombre} onChange={(evento) => setFormPlan((actual) => ({ ...actual, nombre: evento.target.value }))} required /></label>
            <label className="f-campo"><span>Tipo</span><select className="f-entrada" value={formPlan.tipo} onChange={(evento) => setFormPlan((actual) => ({ ...actual, tipo: evento.target.value as TipoPlan }))}><option value="pago">Paquete pago</option><option value="prueba">Prueba gratuita</option><option value="cortesia">Cortesía</option></select></label>
            <label className="f-campo"><span>Días incluidos</span><input className="f-entrada f-admin-num" type="number" min={1} max={3650} value={formPlan.dias} onChange={(evento) => setFormPlan((actual) => ({ ...actual, dias: evento.target.value }))} required /></label>
            <label className="f-campo"><span>Precio sugerido <em>{formPlan.tipo === 'pago' ? 'pesos, opcional' : 'no aplica'}</em></span><input className="f-entrada f-admin-num" type="number" min={0} step="0.01" disabled={formPlan.tipo !== 'pago'} placeholder="Ej. 12000" value={formPlan.precio} onChange={(evento) => setFormPlan((actual) => ({ ...actual, precio: evento.target.value }))} /></label>
            <label className="f-campo"><span>Orden</span><input className="f-entrada f-admin-num" type="number" min={0} max={9999} value={formPlan.orden} onChange={(evento) => setFormPlan((actual) => ({ ...actual, orden: evento.target.value }))} /></label>
            <label className="f-campo f-admin-ancho"><span>Descripción <em>opcional</em></span><input className="f-entrada" placeholder="Qué incluye este paquete" value={formPlan.descripcion} onChange={(evento) => setFormPlan((actual) => ({ ...actual, descripcion: evento.target.value }))} /></label>
          </div>
          <label className="f-admin-check"><input type="checkbox" checked={formPlan.activo} onChange={(evento) => setFormPlan((actual) => ({ ...actual, activo: evento.target.checked }))} /><span>Disponible para nuevas renovaciones</span></label>
          <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setPlanEditorAbierto(false)}>Cancelar</button><button type="submit" className={BTN_FUERTE} disabled={guardando}>{guardando ? 'Guardando…' : planEditando ? 'Guardar cambios' : 'Crear paquete'}</button></div>
        </form>}
        <div className="f-admin-planes-grilla">
          {planes.map((plan) => <Tarjeta como="article" className="f-admin-plan" data-archivado={!plan.activo ? 'true' : undefined} key={plan.id}>
            <div className="f-admin-plan-cabeza"><Etiqueta tono={plan.tipo === 'prueba' ? 'ambar' : plan.tipo === 'cortesia' ? 'gris' : 'verde'}>{plan.tipo === 'prueba' ? 'Prueba' : plan.tipo === 'cortesia' ? 'Cortesía' : 'Pago'}</Etiqueta><Etiqueta tono={plan.activo ? 'verde' : 'gris'} punto>{plan.activo ? 'Disponible' : 'Archivado'}</Etiqueta></div>
            <h3 className="f-renglon-texto">{plan.nombre}</h3><p className="f-dato">{plan.descripcion || 'Sin descripción'}</p>
            <div className="f-admin-meta"><span><small>Duración</small><strong>{plan.dias} días</strong></span><span><small>Precio</small><strong>{dineroEnPesos(plan.precioCentavos)}</strong></span></div>
            <div className="f-admin-acciones-cuenta"><button type="button" className={BTN} onClick={() => editarPlan(plan)}><IconoEditar /> Editar</button><button type="button" className={BTN} disabled={accion === `plan:${plan.id}`} onClick={() => void cambiarEstadoPlan(plan)}><IconoBloqueo /> {plan.activo ? 'Archivar' : 'Restaurar'}</button></div>
          </Tarjeta>)}
        </div>
      </section>

      <Tarjeta como="section" className="f-admin-historial">
        <div><span className="f-dato">Trazabilidad</span><h2 className="f-seccion">Últimas acciones</h2><p className="f-dato">Cada alta, cambio, renovación y pausa queda registrada.</p></div>
        {eventos.length === 0 ? <p className="f-texto f-admin-historial-vacio">Todavía no hay acciones registradas.</p> : <div className="f-admin-historial-lista">{eventos.slice(0, 10).map((evento) => { const cuenta = cuentas.find((item) => item.id === evento.negocio_id); return <div className="f-renglon" key={evento.id}><span className="f-admin-punto" aria-hidden="true" /><span className="f-renglon-cuerpo"><span className="f-renglon-titulo">{nombreEvento(evento)}</span><span className="f-renglon-detalle">{cuenta?.nombre ?? 'Negocio'} · {fechaCorta(evento.creado_en)}</span></span></div> })}</div>}
      </Tarjeta>

      {modal?.tipo === 'suscripcion' && <ModalMarco titulo={`Renovar ${modal.cuenta.nombre}`} subtitulo="Elegí un paquete o cargá una cantidad exacta de días." onClose={() => setModal(null)}>
        <form className="f-admin-form" onSubmit={(evento) => void guardarSuscripcion(evento)}>
          <div className="f-admin-franja"><span className="f-admin-avatar" aria-hidden="true">{inicialDe(modal.cuenta.nombre)}</span><div><strong>{modal.cuenta.nombre}</strong><span>Vencimiento actual: {modal.cuenta.suscripcion ? fechaCorta(modal.cuenta.suscripcion.venceEn) : 'sin suscripción'}</span></div><Etiqueta tono={TONO_ESTADO[modal.cuenta.estado]} punto>{NOMBRES_ESTADO[modal.cuenta.estado]}</Etiqueta></div>
          <label className="f-campo"><span>Paquete comercial <em>opcional</em></span><select className="f-entrada" value={formSuscripcion.planId} onChange={(evento) => { const plan = planes.find((item) => item.id === evento.target.value); setFormSuscripcion((actual) => ({ ...actual, planId: evento.target.value, dias: plan ? String(plan.dias) : actual.dias, importe: plan?.precioCentavos ? String(plan.precioCentavos / 100) : '' })) }}><option value="">Período personalizado</option>{planes.filter((plan) => plan.activo).map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre} · {plan.dias} días{plan.precioCentavos ? ` · ${formatearPesos(plan.precioCentavos)}` : ''}</option>)}</select></label>
          <div className="f-admin-fila"><label className="f-campo"><span>Días a otorgar <em>1 a 3650</em></span><input className="f-entrada f-admin-num" type="number" min={1} max={3650} value={formSuscripcion.dias} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, dias: evento.target.value }))} required /></label><label className="f-campo"><span>Cómo aplicarlo</span><select className="f-entrada" value={formSuscripcion.modo} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, modo: evento.target.value as 'sumar' | 'reiniciar' }))}><option value="sumar">Sumar al vencimiento actual</option><option value="reiniciar">Contar desde hoy</option></select></label></div>
          <div className="f-admin-vence"><IconoCalendarioCuenta /><div><span>Nuevo vencimiento estimado</span><strong>{vencimientoEstimado(modal.cuenta, formSuscripcion) ? fechaCorta(vencimientoEstimado(modal.cuenta, formSuscripcion)) : 'Completá una cantidad válida de días'}</strong><small>{formSuscripcion.modo === 'sumar' ? 'Los días no usados se conservan.' : 'El período empieza en el momento de guardar.'}</small></div></div>
          <div className="f-admin-fila"><label className="f-campo"><span>Importe cobrado <em>opcional, pesos</em></span><input className="f-entrada f-admin-num" type="number" min={0} step="0.01" placeholder="Ej. 12000" value={formSuscripcion.importe} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, importe: evento.target.value }))} /></label><label className="f-campo"><span>Medio de pago <em>opcional</em></span><select className="f-entrada" value={formSuscripcion.medioPago} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, medioPago: evento.target.value as MedioPagoAdmin | '' }))}><option value="">No registrado</option><option value="alias">Alias / transferencia</option><option value="efectivo">Efectivo</option><option value="mercado_pago">Mercado Pago</option><option value="otro">Otro</option></select></label></div>
          <label className="f-campo"><span>Referencia del pago <em>opcional</em></span><input className="f-entrada" placeholder="Ej. comprobante o nota" value={formSuscripcion.referenciaPago} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, referenciaPago: evento.target.value }))} /></label>
          <label className="f-campo"><span>Nota de la renovación <em>opcional</em></span><textarea className="f-entrada f-admin-texto" rows={2} placeholder="Ej. pagó hasta diciembre" value={formSuscripcion.nota} onChange={(evento) => setFormSuscripcion((actual) => ({ ...actual, nota: evento.target.value }))} /></label>
          <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className={BTN_HOJA} disabled={guardando}>{guardando ? 'Aplicando…' : modal.cuenta.estado === 'suspendida' ? 'Reactivar cuenta' : modal.cuenta.estado === 'vencida' || modal.cuenta.estado === 'sin_suscripcion' ? 'Activar cuenta' : 'Guardar renovación'}</button></div>
        </form>
      </ModalMarco>}

      {modal?.tipo === 'cuenta' && <ModalMarco titulo={`Editar ${modal.cuenta.nombre}`} subtitulo="Actualizá los datos comerciales sin perder el historial." onClose={() => setModal(null)}>
        <form className="f-admin-form" onSubmit={(evento) => void guardarCuenta(evento)}>
          <label className="f-campo"><span>Nombre del negocio</span><input className="f-entrada" value={formCuenta.nombre} onChange={(evento) => setFormCuenta((actual) => ({ ...actual, nombre: evento.target.value }))} required /></label>
          <label className="f-campo"><span>Teléfono de ingreso</span><input className="f-entrada f-admin-num" inputMode="tel" value={formCuenta.telefono} onChange={(evento) => setFormCuenta((actual) => ({ ...actual, telefono: evento.target.value }))} required /><small className="f-admin-ayuda">Si lo cambiás, el cliente ingresará con ese número y conservará su PIN.</small></label>
          <label className="f-campo"><span>Nota interna</span><textarea className="f-entrada f-admin-texto" rows={3} placeholder="Seguimiento, origen, acuerdo comercial…" value={formCuenta.notaInterna} onChange={(evento) => setFormCuenta((actual) => ({ ...actual, notaInterna: evento.target.value }))} /></label>
          <div className="f-admin-seguridad"><div><strong>¿El cliente perdió su acceso?</strong><p>Generá un PIN nuevo. El anterior deja de funcionar inmediatamente.</p></div><button type="button" className={BTN} onClick={() => { setFormPin(''); setModal({ tipo: 'pin', cuenta: modal.cuenta }) }}>Regenerar PIN</button></div>
          <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className={BTN_HOJA} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos'}</button></div>
        </form>
      </ModalMarco>}

      {modal?.tipo === 'pin' && <ModalMarco titulo="Regenerar PIN" subtitulo={`Nuevo acceso para ${modal.cuenta.nombre}.`} onClose={() => setModal(null)}>
        <form className="f-admin-form" onSubmit={(evento) => void regenerarPin(evento)}>
          <div className="f-aviso f-admin-alerta"><IconoBloqueo /><div><strong>El PIN anterior se invalida</strong><p>Después de guardar, enviá el nuevo acceso al cliente por un canal seguro.</p></div></div>
          <label className="f-campo"><span>PIN nuevo <em>6 números</em></span><input className="f-entrada f-admin-pin" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={formPin} onChange={(evento) => setFormPin(evento.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" required /></label>
          <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setModal({ tipo: 'cuenta', cuenta: modal.cuenta })}>Volver</button><button type="submit" className={BTN_HOJA} disabled={guardando}>{guardando ? 'Regenerando…' : 'Regenerar PIN'}</button></div>
        </form>
      </ModalMarco>}

      {modal?.tipo === 'vendedores' && <ModalMarco titulo={`Vendedores de ${modal.cuenta.nombre}`} subtitulo="Cada vendedor entra con su teléfono y PIN y comparte la misma base del negocio." onClose={() => setModal(null)}>
        <div className="f-admin-form">
          {(modal.cuenta.vendedores ?? []).length === 0
            ? <p className="f-admin-ayuda">Todavía no hay vendedores. Sólo el dueño entra a esta cuenta.</p>
            : <ul className="f-admin-vendedores" aria-label="Vendedores con acceso">
              {(modal.cuenta.vendedores ?? []).map((vendedor) => (
                <li className="f-admin-vendedor" key={vendedor.usuarioId}>
                  <div className="f-admin-franja">
                    <span className="f-admin-avatar" aria-hidden="true">{inicialDe(vendedor.nombre ?? 'V')}</span>
                    <div><strong>{vendedor.nombre ?? 'Sin nombre'}</strong><span className="f-admin-num">{vendedor.telefono ?? 'Sin teléfono'} · desde {fechaCorta(vendedor.creadoEn)}</span></div>
                  </div>
                  {pinVendedor?.usuarioId === vendedor.usuarioId
                    ? <form className="f-admin-form" onSubmit={(evento) => cambiarPinVendedor(evento, vendedor)}>
                      <label className="f-campo"><span>PIN nuevo <em>6 números</em></span><input className="f-entrada f-admin-num" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={pinVendedor.pin} onChange={(evento) => setPinVendedor({ usuarioId: vendedor.usuarioId, pin: evento.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="123456" required autoFocus /></label>
                      <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setPinVendedor(null)}>Cancelar</button><button type="submit" className={BTN_FUERTE} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar PIN'}</button></div>
                    </form>
                    : quitando === vendedor.usuarioId
                      ? <div className="f-aviso f-admin-alerta" role="alert"><IconoBloqueo /><div><strong>¿Quitar a {vendedor.nombre ?? 'este vendedor'}?</strong><p>Deja de poder entrar. Lo que vendió queda guardado.</p></div><div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setQuitando(null)}>No</button><button type="button" className={BTN_CUIDADO} disabled={guardando} onClick={() => quitarVendedor(vendedor)}>{guardando ? 'Quitando…' : 'Sí, quitar'}</button></div></div>
                      : <div className="f-admin-acciones-cuenta">
                        <button type="button" className={BTN} disabled={guardando} onClick={() => { setQuitando(null); setPinVendedor({ usuarioId: vendedor.usuarioId, pin: '' }) }}><IconoBloqueo /> Nuevo PIN</button>
                        <button type="button" className={BTN_CUIDADO} disabled={guardando} onClick={() => { setPinVendedor(null); setQuitando(vendedor.usuarioId) }}><IconoEliminar /> Quitar</button>
                      </div>}
                </li>
              ))}
            </ul>}
          <form className="f-admin-form" onSubmit={agregarVendedor} aria-label="Agregar vendedor">
            <strong>Agregar vendedor</strong>
            <div className="f-admin-fila">
              <label className="f-campo"><span>Nombre</span><input className="f-entrada" value={formVendedor.nombre} onChange={(evento) => setFormVendedor((actual) => ({ ...actual, nombre: evento.target.value }))} placeholder="Ej. Lucía" required minLength={2} maxLength={80} /></label>
              <label className="f-campo"><span>Teléfono</span><input className="f-entrada f-admin-num" inputMode="tel" value={formVendedor.telefono} onChange={(evento) => setFormVendedor((actual) => ({ ...actual, telefono: evento.target.value }))} placeholder="261 555 0000" required /></label>
            </div>
            <label className="f-campo"><span>PIN inicial <em>6 números</em></span><input className="f-entrada f-admin-num" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={formVendedor.pin} onChange={(evento) => setFormVendedor((actual) => ({ ...actual, pin: evento.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="123456" required /></label>
            {error && <p className="f-admin-ayuda" role="alert">{error}</p>}
            {aviso && <p className="f-admin-ayuda" role="status">{aviso}</p>}
            {credenciales && <TarjetaCredenciales credenciales={credenciales} copiado={copiado} copiar={copiar} />}
            <div className="f-admin-acciones"><button type="button" className={BTN} onClick={() => setModal(null)}>Listo</button><button type="submit" className={BTN_HOJA} disabled={guardando}>{guardando ? 'Agregando…' : 'Agregar vendedor'}</button></div>
          </form>
        </div>
      </ModalMarco>}
    </div>
  )
}
