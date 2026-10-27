import { createClient } from 'npm:@supabase/supabase-js@2.112.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
const diasEnMilisegundos = 24 * 60 * 60 * 1000
const ORIGENES_PERMITIDOS = new Set([
  'https://libreta-sepia.vercel.app',
  'http://localhost:3000',
  'http://localhost:3100',
])

type OperacionSuscripcion = 'prueba' | 'activar' | 'extender' | 'suspender' | 'reactivar'
type OperacionPlan = 'crear' | 'actualizar' | 'archivar' | 'restaurar'
type OperacionCuenta = 'editar' | 'regenerar_pin'
type TipoPlan = 'prueba' | 'pago' | 'cortesia'
type MedioPagoAdmin = 'alias' | 'efectivo' | 'transferencia' | 'mercado_pago' | 'otro'

interface CuerpoAdmin {
  accion?: 'listar' | 'crear' | 'suscripcion' | 'cuenta' | 'plan'
  nombre?: unknown
  telefono?: unknown
  pin?: unknown
  diasPrueba?: unknown
  dias?: unknown
  planId?: unknown
  tipo?: unknown
  descripcion?: unknown
  precioCentavos?: unknown
  activo?: unknown
  orden?: unknown
  modo?: unknown
  importeCentavos?: unknown
  medioPago?: unknown
  referenciaPago?: unknown
  notaInterna?: unknown
  nota?: unknown
  negocioId?: unknown
  operacion?: unknown
}

interface FilaPlan {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  tipo: TipoPlan
  dias: number
  precio_centavos: number | string
  activo: boolean
  orden: number
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

interface FilaSuscripcion {
  id: string
  negocio_id: string
  plan_id: string | null
  plan_nombre: string | null
  importe_centavos: number | string
  estado: 'prueba' | 'activa' | 'gracia' | 'suspendida'
  tipo: 'prueba' | 'mensual' | 'cortesia' | 'manual'
  inicio_en: string
  vence_en: string
  gracia_hasta: string | null
  nota: string | null
  actualizado_en: string
}

function corsHeaders(req?: Request): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  })
  const origin = req?.headers.get('Origin')
  if (origin && ORIGENES_PERMITIDOS.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function json(body: unknown, status = 200, req?: Request): Response {
  const headers = corsHeaders(req)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), {
    status,
    headers,
  })
}

function texto(valor: unknown, maximo: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : ''
}

function entero(valor: unknown, porDefecto: number, minimo: number, maximo: number): number {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isInteger(numero)) return porDefecto
  return Math.min(maximo, Math.max(minimo, numero))
}

function booleano(valor: unknown, porDefecto: boolean): boolean {
  return typeof valor === 'boolean' ? valor : porDefecto
}

function codigoSeguro(valor: string): string {
  const base = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || `plan-${crypto.randomUUID().slice(0, 8)}`
}

function tipoPlanValido(valor: unknown): valor is TipoPlan {
  return valor === 'prueba' || valor === 'pago' || valor === 'cortesia'
}

function medioPagoValido(valor: unknown): valor is MedioPagoAdmin {
  return valor === 'alias' || valor === 'efectivo' || valor === 'transferencia'
    || valor === 'mercado_pago' || valor === 'otro'
}

function telefonoNormalizado(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return digitos.startsWith('54') ? digitos : `54${digitos}`
}

function pinValido(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false
  return !new Set(['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999']).has(pin)
}

function credenciales(telefono: string, pin: string): { email: string; password: string } {
  const numero = telefonoNormalizado(telefono)
  return { email: `${numero}@libreta.app`, password: `libreta-v1:${numero}:${pin}` }
}

function fechaDesdeAhora(dias: number, base = Date.now()): string {
  return new Date(base + dias * diasEnMilisegundos).toISOString()
}

function fechaMilisegundos(valor: string | null | undefined): number {
  const fecha = valor ? new Date(valor).getTime() : Number.NaN
  return Number.isFinite(fecha) ? fecha : 0
}

function estadoEfectivo(fila: FilaSuscripcion | null): 'prueba' | 'activa' | 'gracia' | 'suspendida' | 'vencida' | 'sin_suscripcion' {
  if (!fila) return 'sin_suscripcion'
  if (fila.estado === 'suspendida') return 'suspendida'
  const ahora = Date.now()
  const vence = fechaMilisegundos(fila.vence_en)
  if (vence <= ahora) return 'vencida'
  // La gracia histórica nunca conserva el acceso operativo.
  if (fila.estado === 'gracia') return 'vencida'
  return fila.estado
}

function diasRestantes(fila: FilaSuscripcion | null): number {
  if (!fila) return 0
  return Math.max(0, Math.ceil((fechaMilisegundos(fila.vence_en) - Date.now()) / diasEnMilisegundos))
}

function filaPublica(fila: FilaSuscripcion | null): Record<string, unknown> | null {
  if (!fila) return null
  return {
    id: fila.id,
    negocioId: fila.negocio_id,
    planId: fila.plan_id ?? null,
    planNombre: fila.plan_nombre ?? null,
    importeCentavos: Number(fila.importe_centavos ?? 0),
    estado: fila.estado,
    estadoEfectivo: estadoEfectivo(fila),
    tipo: fila.tipo,
    inicioEn: fila.inicio_en,
    venceEn: fila.vence_en,
    graciaHasta: fila.gracia_hasta,
    nota: fila.nota,
    actualizadoEn: fila.actualizado_en,
    diasRestantes: diasRestantes(fila),
  }
}

function filaPublicaPlan(fila: FilaPlan): Record<string, unknown> {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    dias: Number(fila.dias),
    precioCentavos: Number(fila.precio_centavos ?? 0),
    activo: fila.activo,
    orden: Number(fila.orden),
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  }
}

function mensajeError(error: unknown): string {
  // No devolver mensajes de Postgres/Auth al navegador: pueden revelar
  // nombres de tablas, restricciones o detalles de configuración.
  console.error('[admin] operación fallida', error instanceof Error ? error.name : 'error_desconocido')
  return 'No se pudo completar la operación.'
}

async function clienteAdmin(req: Request) {
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('La función administrativa no está configurada.')
  const authorization = req.headers.get('Authorization')
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) throw new Response(JSON.stringify({ error: 'Hay que iniciar sesión.' }), { status: 401, headers: corsHeaders(req) })

  const usuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const identidad = await usuario.auth.getUser()
  if (identidad.error || !identidad.data.user) {
    throw new Response(JSON.stringify({ error: 'La sesión no es válida.' }), { status: 401, headers: corsHeaders(req) })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const permiso = await admin
    .from('administradores_plataforma')
    .select('rol')
    .eq('usuario_id', identidad.data.user.id)
    .maybeSingle()
  if (permiso.error) throw new Error('No se pudo validar el administrador.')
  if (!permiso.data) throw new Response(JSON.stringify({ error: 'No tenés permisos para administrar cuentas.' }), { status: 403, headers: corsHeaders(req) })
  return { admin, actorId: identidad.data.user.id }
}

async function obtenerPlan(
  admin: ReturnType<typeof createClient>,
  planId: string | null,
  permitirInactivo = false,
): Promise<FilaPlan | null> {
  if (!planId) return null
  const respuesta = await admin
    .from('planes_suscripcion')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (respuesta.error) throw new Error('No se pudo validar el plan.')
  const plan = respuesta.data as FilaPlan | null
  if (!plan || (!permitirInactivo && !plan.activo)) {
    throw new Response(JSON.stringify({ error: 'Ese plan no está disponible.' }), { status: 400 })
  }
  return plan
}

async function planPorCodigo(
  admin: ReturnType<typeof createClient>,
  codigo: string,
  tipo?: TipoPlan,
): Promise<FilaPlan | null> {
  let consulta = admin
    .from('planes_suscripcion')
    .select('*')
    .eq('codigo', codigo)
    .eq('activo', true)
  if (tipo) consulta = consulta.eq('tipo', tipo)
  const respuesta = await consulta.maybeSingle()
  if (respuesta.error) throw new Error('No se pudo cargar el catálogo de planes.')
  return respuesta.data as FilaPlan | null
}

async function vinculoDeNegocio(admin: ReturnType<typeof createClient>, negocioId: string): Promise<string> {
  const respuesta = await admin
    .from('usuarios_negocio')
    .select('usuario_id')
    .eq('negocio_id', negocioId)
    .limit(1)
    .maybeSingle()
  if (respuesta.error || !respuesta.data?.usuario_id) throw new Error('No se encontró el usuario de la cuenta.')
  return respuesta.data.usuario_id as string
}

async function listar(admin: ReturnType<typeof createClient>) {
  const [negocios, suscripciones, eventos, planes] = await Promise.all([
    admin.from('negocios').select('id,nombre,telefono_contacto,nota_interna,creado_en').order('creado_en', { ascending: false }),
    admin.from('suscripciones').select('*').order('vence_en', { ascending: true }),
    admin.from('suscripcion_eventos').select('id,negocio_id,suscripcion_id,accion,detalle,actor_id,creado_en').order('creado_en', { ascending: false }).limit(80),
    admin.from('planes_suscripcion').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
  ])
  if (negocios.error || suscripciones.error || eventos.error || planes.error) throw new Error('No se pudo cargar el estado de las cuentas.')

  const mapa = new Map<string, FilaSuscripcion>()
  for (const fila of (suscripciones.data ?? []) as FilaSuscripcion[]) mapa.set(fila.negocio_id, fila)

  return {
    ok: true,
    planes: (planes.data ?? []).map((plan) => filaPublicaPlan(plan as FilaPlan)),
    cuentas: (negocios.data ?? []).map((negocio: { id: string; nombre: string; telefono_contacto: string | null; nota_interna: string | null; creado_en: string }) => {
      const suscripcion = mapa.get(negocio.id) ?? null
      return {
        id: negocio.id,
        nombre: negocio.nombre,
        telefono: negocio.telefono_contacto,
        notaInterna: negocio.nota_interna,
        creadoEn: negocio.creado_en,
        suscripcion: filaPublica(suscripcion),
        estado: estadoEfectivo(suscripcion),
        diasRestantes: diasRestantes(suscripcion),
      }
    }),
    eventos: eventos.data ?? [],
  }
}

async function crearCuenta(admin: ReturnType<typeof createClient>, actorId: string, cuerpo: CuerpoAdmin) {
  const nombre = texto(cuerpo.nombre, 120)
  const telefono = texto(cuerpo.telefono, 40)
  const pin = texto(cuerpo.pin, 6)
  const planSolicitado = texto(cuerpo.planId, 80) || null
  const plan = planSolicitado
    ? await obtenerPlan(admin, planSolicitado)
    : await planPorCodigo(admin, 'prueba-7', 'prueba')
  if (plan && plan.tipo !== 'prueba') {
    throw new Response(JSON.stringify({ error: 'La cuenta nueva necesita un plan de prueba.' }), { status: 400 })
  }
  const diasPrueba = entero(cuerpo.diasPrueba, plan?.dias ?? 7, 1, 90)
  const nota = texto(cuerpo.nota, 300) || null
  const numero = telefonoNormalizado(telefono)

  if (nombre.length < 2) throw new Response(JSON.stringify({ error: 'Escribí el nombre del negocio.' }), { status: 400 })
  if (numero.length < 10 || numero.length > 15) throw new Response(JSON.stringify({ error: 'Revisá el teléfono del cliente.' }), { status: 400 })
  if (!pinValido(pin)) throw new Response(JSON.stringify({ error: 'El PIN debe tener 6 números y no ser obvio.' }), { status: 400 })

  const datos = credenciales(telefono, pin)
  const alta = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { nombre_negocio: nombre },
  })
  if (alta.error || !alta.data.user) {
    const yaExiste = /already|exists|registered|duplicate/i.test(alta.error?.message ?? '')
    throw new Response(JSON.stringify({ error: yaExiste ? 'Ese teléfono ya tiene una cuenta.' : 'No se pudo crear la cuenta.' }), { status: yaExiste ? 409 : 400 })
  }

  const usuarioId = alta.data.user.id
  let negocioId: string | null = null
  try {
    const negocio = await admin
      .from('negocios')
      .insert({ nombre, telefono_contacto: numero, nota_interna: nota })
      .select('id')
      .single()
    if (negocio.error || !negocio.data) throw new Error('No se pudo crear el negocio.')
    negocioId = negocio.data.id

    const vinculo = await admin.from('usuarios_negocio').insert({ usuario_id: usuarioId, negocio_id: negocioId })
    if (vinculo.error) throw new Error('No se pudo vincular la cuenta con el negocio.')

    const inicio = new Date().toISOString()
    const suscripcion = await admin
      .from('suscripciones')
      .insert({
        negocio_id: negocioId,
        plan_id: plan?.id ?? null,
        plan_nombre: plan?.nombre ?? 'Prueba gratuita',
        importe_centavos: 0,
        estado: 'prueba',
        tipo: 'prueba',
        inicio_en: inicio,
        vence_en: fechaDesdeAhora(diasPrueba),
        nota,
        creado_por: actorId,
      })
      .select('*')
      .single()
    if (suscripcion.error || !suscripcion.data) throw new Error('No se pudo crear la prueba gratuita.')

    const evento = await admin.from('suscripcion_eventos').insert({
      negocio_id: negocioId,
      suscripcion_id: suscripcion.data.id,
      accion: 'cuenta_creada',
      detalle: { diasPrueba, planId: plan?.id ?? null, planNombre: plan?.nombre ?? 'Prueba gratuita', nota },
      actor_id: actorId,
    })
    if (evento.error) throw new Error('No se pudo registrar el alta.')

    return {
      ok: true,
      cuenta: { id: negocioId, nombre, telefono: numero },
      credenciales: { telefono: numero, pin },
      suscripcion: filaPublica(suscripcion.data as FilaSuscripcion),
    }
  } catch (error) {
    if (negocioId) await admin.from('negocios').delete().eq('id', negocioId)
    await admin.auth.admin.deleteUser(usuarioId)
    throw error
  }
}

async function actualizarSuscripcion(admin: ReturnType<typeof createClient>, actorId: string, cuerpo: CuerpoAdmin) {
  const negocioId = texto(cuerpo.negocioId, 80)
  const operacion = texto(cuerpo.operacion, 30) as OperacionSuscripcion
  const planIdSolicitado = texto(cuerpo.planId, 80) || null
  const modo = texto(cuerpo.modo, 20) === 'reiniciar' ? 'reiniciar' : 'sumar'
  const nota = texto(cuerpo.nota, 300) || null
  const medioPago = texto(cuerpo.medioPago, 24) || null
  const referenciaPago = texto(cuerpo.referenciaPago, 100) || null
  if (medioPago && !medioPagoValido(medioPago)) {
    throw new Response(JSON.stringify({ error: 'El medio de pago no es válido.' }), { status: 400 })
  }
  const operaciones = new Set<OperacionSuscripcion>(['prueba', 'activar', 'extender', 'suspender', 'reactivar'])
  if (!negocioId || !operaciones.has(operacion)) {
    throw new Response(JSON.stringify({ error: 'La operación de suscripción no es válida.' }), { status: 400 })
  }

  const existente = await admin.from('suscripciones').select('*').eq('negocio_id', negocioId).maybeSingle()
  if (existente.error) throw new Error('No se pudo leer la suscripción actual.')
  const anterior = existente.data as FilaSuscripcion | null
  const ahora = Date.now()
  const venceAnterior = fechaMilisegundos(anterior?.vence_en)
  const plan = operacion === 'suspender'
    ? null
    : await obtenerPlan(admin, planIdSolicitado ?? anterior?.plan_id ?? null)
  const dias = entero(cuerpo.dias, plan?.dias ?? 30, 1, 3650)
  const importeCentavos = entero(
    cuerpo.importeCentavos,
    Number(plan?.precio_centavos ?? anterior?.importe_centavos ?? 0),
    0,
    100000000000,
  )
  const base = modo === 'reiniciar' ? ahora : Math.max(ahora, venceAnterior)
  let valores: Record<string, unknown>
  if (operacion === 'suspender') {
    valores = { estado: 'suspendida', nota: nota ?? anterior?.nota ?? null }
  } else {
    const tipo = operacion === 'prueba'
      ? 'prueba'
      : plan?.tipo === 'cortesia'
        ? 'cortesia'
        : 'mensual'
    valores = {
      plan_id: plan?.id ?? null,
      plan_nombre: plan?.nombre ?? (operacion === 'prueba' ? 'Prueba gratuita' : 'Activación manual'),
      importe_centavos: importeCentavos,
      estado: operacion === 'prueba' ? 'prueba' : 'activa',
      tipo,
      inicio_en: anterior && venceAnterior > ahora ? anterior.inicio_en : new Date().toISOString(),
      vence_en: fechaDesdeAhora(dias, base),
      gracia_hasta: null,
      nota: nota ?? anterior?.nota ?? null,
      creado_por: actorId,
    }
  }

  let guardada
  if (anterior) {
    guardada = await admin.from('suscripciones').update(valores).eq('id', anterior.id).select('*').single()
  } else {
    guardada = await admin.from('suscripciones').insert({ negocio_id: negocioId, ...valores }).select('*').single()
  }
  if (guardada.error || !guardada.data) throw new Error('No se pudo actualizar la suscripción.')

  const evento = await admin.from('suscripcion_eventos').insert({
    negocio_id: negocioId,
    suscripcion_id: guardada.data.id,
    accion: `suscripcion_${operacion}`,
    detalle: {
      dias: operacion === 'suspender' ? null : dias,
      modo: operacion === 'suspender' ? null : modo,
      planId: plan?.id ?? anterior?.plan_id ?? null,
      planNombre: plan?.nombre ?? anterior?.plan_nombre ?? null,
      importeCentavos: operacion === 'suspender' ? null : importeCentavos,
      medioPago,
      referenciaPago,
      nota,
    },
    actor_id: actorId,
  })
  if (evento.error) throw new Error('La suscripción cambió, pero no se pudo registrar la acción.')

  return { ok: true, suscripcion: filaPublica(guardada.data as FilaSuscripcion) }
}

async function gestionarCuenta(admin: ReturnType<typeof createClient>, actorId: string, cuerpo: CuerpoAdmin) {
  const negocioId = texto(cuerpo.negocioId, 80)
  const operacion = texto(cuerpo.operacion, 30) as OperacionCuenta
  if (!negocioId || !['editar', 'regenerar_pin'].includes(operacion)) {
    throw new Response(JSON.stringify({ error: 'La operación de cuenta no es válida.' }), { status: 400 })
  }

  const negocioActual = await admin
    .from('negocios')
    .select('id,nombre,telefono_contacto,nota_interna')
    .eq('id', negocioId)
    .maybeSingle()
  if (negocioActual.error || !negocioActual.data) {
    throw new Response(JSON.stringify({ error: 'No se encontró esa cuenta.' }), { status: 404 })
  }

  const usuarioId = await vinculoDeNegocio(admin, negocioId)
  const telefonoActual = texto(negocioActual.data.telefono_contacto, 40)

  if (operacion === 'regenerar_pin') {
    const pin = texto(cuerpo.pin, 6)
    if (!pinValido(pin)) {
      throw new Response(JSON.stringify({ error: 'El PIN debe tener 6 números y no ser obvio.' }), { status: 400 })
    }
    if (!telefonoActual) {
      throw new Response(JSON.stringify({ error: 'La cuenta no tiene un teléfono válido.' }), { status: 400 })
    }
    const cambio = await admin.auth.admin.updateUserById(usuarioId, {
      password: credenciales(telefonoActual, pin).password,
    })
    if (cambio.error) throw new Error('No se pudo regenerar el PIN.')

    const evento = await admin.from('suscripcion_eventos').insert({
      negocio_id: negocioId,
      accion: 'credenciales_regeneradas',
      detalle: { tipo: 'pin' },
      actor_id: actorId,
    })
    if (evento.error) throw new Error('El PIN cambió, pero no se pudo registrar la acción.')
    return { ok: true, credenciales: { telefono: telefonoActual, pin } }
  }

  const nombre = texto(cuerpo.nombre, 120)
  const telefono = texto(cuerpo.telefono, 40)
  const notaInterna = texto(cuerpo.notaInterna, 500) || null
  const numero = telefonoNormalizado(telefono)
  if (nombre.length < 2) throw new Response(JSON.stringify({ error: 'Escribí el nombre del negocio.' }), { status: 400 })
  if (numero.length < 10 || numero.length > 15) throw new Response(JSON.stringify({ error: 'Revisá el teléfono del cliente.' }), { status: 400 })

  const numeroAnterior = telefonoNormalizado(telefonoActual)
  const cambioTelefono = numero !== numeroAnterior
  if (cambioTelefono) {
    const cambioAuth = await admin.auth.admin.updateUserById(usuarioId, {
      email: credenciales(numero, '000000').email,
      email_confirm: true,
      user_metadata: { nombre_negocio: nombre },
    })
    if (cambioAuth.error) {
      const conflicto = /already|exists|registered|duplicate/i.test(cambioAuth.error.message ?? '')
      throw new Response(JSON.stringify({ error: conflicto ? 'Ese teléfono ya tiene otra cuenta.' : 'No se pudo actualizar el teléfono.' }), { status: conflicto ? 409 : 400 })
    }
  }

  const guardado = await admin
    .from('negocios')
    .update({ nombre, telefono_contacto: numero, nota_interna: notaInterna })
    .eq('id', negocioId)
  if (guardado.error) {
    if (cambioTelefono) {
      await admin.auth.admin.updateUserById(usuarioId, {
        email: credenciales(numeroAnterior, '000000').email,
        email_confirm: true,
      })
    }
    throw new Error('No se pudo actualizar la cuenta.')
  }

  if (!cambioTelefono) {
    await admin.auth.admin.updateUserById(usuarioId, { user_metadata: { nombre_negocio: nombre } })
  }
  const evento = await admin.from('suscripcion_eventos').insert({
    negocio_id: negocioId,
    accion: 'cuenta_actualizada',
    detalle: { nombreActualizado: true, telefonoActualizado: cambioTelefono, notaInternaActualizada: true },
    actor_id: actorId,
  })
  if (evento.error) throw new Error('La cuenta cambió, pero no se pudo registrar la acción.')
  return { ok: true, cuenta: { id: negocioId, nombre, telefono: numero, notaInterna } }
}

async function regenerarPlanCodigo(admin: ReturnType<typeof createClient>, nombre: string): Promise<string> {
  const base = codigoSeguro(nombre)
  const existente = await admin.from('planes_suscripcion').select('id').eq('codigo', base).maybeSingle()
  if (existente.error) throw new Error('No se pudo validar el código del plan.')
  return existente.data ? `${base}-${crypto.randomUUID().slice(0, 6)}` : base
}

async function gestionarPlan(admin: ReturnType<typeof createClient>, actorId: string, cuerpo: CuerpoAdmin) {
  const operacion = texto(cuerpo.operacion, 30) as OperacionPlan
  if (!['crear', 'actualizar', 'archivar', 'restaurar'].includes(operacion)) {
    throw new Response(JSON.stringify({ error: 'La operación del plan no es válida.' }), { status: 400 })
  }

  const planId = texto(cuerpo.planId, 80) || null
  if ((operacion !== 'crear') && !planId) {
    throw new Response(JSON.stringify({ error: 'Falta seleccionar un plan.' }), { status: 400 })
  }

  if (operacion === 'archivar' || operacion === 'restaurar') {
    const actual = await obtenerPlan(admin, planId, true)
    if (!actual) throw new Response(JSON.stringify({ error: 'No se encontró ese plan.' }), { status: 404 })
    const guardado = await admin.from('planes_suscripcion').update({ activo: operacion === 'restaurar' }).eq('id', actual.id).select('*').single()
    if (guardado.error || !guardado.data) throw new Error('No se pudo cambiar el estado del plan.')
    return { ok: true, plan: filaPublicaPlan(guardado.data as FilaPlan) }
  }

  const nombre = texto(cuerpo.nombre, 80)
  const descripcion = texto(cuerpo.descripcion, 240) || null
  const tipoRecibido = texto(cuerpo.tipo, 20)
  const tipo: TipoPlan = tipoPlanValido(tipoRecibido) ? tipoRecibido : 'pago'
  const dias = entero(cuerpo.dias, 30, 1, 3650)
  const precioCentavos = tipo === 'prueba' || tipo === 'cortesia'
    ? 0
    : entero(cuerpo.precioCentavos, 0, 0, 100000000000)
  const orden = entero(cuerpo.orden, 100, 0, 9999)
  const activo = booleano(cuerpo.activo, true)
  if (nombre.length < 2) throw new Response(JSON.stringify({ error: 'Escribí un nombre para el plan.' }), { status: 400 })

  let guardado
  if (operacion === 'crear') {
    const codigo = await regenerarPlanCodigo(admin, nombre)
    guardado = await admin.from('planes_suscripcion').insert({
      codigo,
      nombre,
      descripcion,
      tipo,
      dias,
      precio_centavos: precioCentavos,
      activo,
      orden,
      creado_por: actorId,
    }).select('*').single()
  } else {
    guardado = await admin.from('planes_suscripcion').update({
      nombre,
      descripcion,
      tipo,
      dias,
      precio_centavos: precioCentavos,
      activo,
      orden,
    }).eq('id', planId).select('*').single()
  }
  if (guardado.error || !guardado.data) throw new Error('No se pudo guardar el plan.')
  return { ok: true, plan: filaPublicaPlan(guardado.data as FilaPlan) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200, req)
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, req)

  try {
    const { admin, actorId } = await clienteAdmin(req)
    const longitud = Number(req.headers.get('Content-Length') ?? 0)
    if (Number.isFinite(longitud) && longitud > 64_000) return json({ error: 'El pedido es demasiado grande.' }, 413, req)
    let cuerpo: CuerpoAdmin
    try {
      const recibido = await req.json()
      if (!recibido || typeof recibido !== 'object' || Array.isArray(recibido)) return json({ error: 'El pedido no es válido.' }, 400, req)
      cuerpo = recibido as CuerpoAdmin
    } catch {
      return json({ error: 'El pedido no es JSON válido.' }, 400, req)
    }
    if (cuerpo.accion === 'listar') return json(await listar(admin), 200, req)
    if (cuerpo.accion === 'crear') return json(await crearCuenta(admin, actorId, cuerpo), 200, req)
    if (cuerpo.accion === 'suscripcion') return json(await actualizarSuscripcion(admin, actorId, cuerpo), 200, req)
    if (cuerpo.accion === 'cuenta') return json(await gestionarCuenta(admin, actorId, cuerpo), 200, req)
    if (cuerpo.accion === 'plan') return json(await gestionarPlan(admin, actorId, cuerpo), 200, req)
    return json({ error: 'Acción no reconocida.' }, 400, req)
  } catch (error) {
    if (error instanceof Response) {
      const cuerpo = await error.text()
      const headers = corsHeaders(req)
      headers.set('Content-Type', 'application/json; charset=utf-8')
      return new Response(cuerpo, { status: error.status, headers })
    }
    return json({ error: mensajeError(error) }, 500, req)
  }
})
