// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitirCodigoRecuperacion,
  pinValido,
  procesarPinSesion,
  procesarRecuperacion,
  type DatosPin,
  type DependenciasPin,
  type VinculoPin,
} from '../../supabase/functions/_shared/recuperacionPin.ts'
import type { AlmacenIntentos } from '../../supabase/functions/_shared/ingreso.ts'
import type { EstadoIntentos } from '../../supabase/functions/_shared/limiteIngreso.ts'
import { emailDeTelefono, passwordParaCuenta } from '../../supabase/functions/_shared/credenciales.ts'

const T0 = 1_800_000_000_000
const MIN = 60_000

const NEGOCIO_A = 'negocio-a'
const NEGOCIO_B = 'negocio-b'
const NUM_DUENO_A = '542615550001'
const NUM_VEND_A = '542615550002'
const NUM_VEND_A2 = '542615550003'
const NUM_DUENO_B = '542615550004'
const PIN_DUENO_A = '482913'
const PIN_VEND_A = '357159'

interface Usuario extends VinculoPin { numero: string; password: string; debe: boolean }
interface Auditoria { negocioId: string; actorId: string; objetivoId: string | null; accion: string }

function almacenEnMemoria(): AlmacenIntentos & { filas: Map<string, EstadoIntentos> } {
  const filas = new Map<string, EstadoIntentos>()
  return {
    filas,
    async leer(clave) {
      const fila = filas.get(clave)
      return fila ? { ...fila } : null
    },
    async guardar(clave, previo, nuevo) {
      const actual = filas.get(clave) ?? null
      if ((actual?.version ?? null) !== (previo?.version ?? null)) return false
      filas.set(clave, { ...nuevo, version: (previo?.version ?? 0) + 1 })
      return true
    },
    async limpiar(clave) {
      filas.delete(clave)
    },
  }
}

/** Una base en memoria con la misma semántica que las tablas reales: el
 *  código se consume con un "update ... where usado_en is null" atómico. */
async function armar(opciones: { pepper?: string; captcha?: (token: string) => Promise<boolean> } = {}) {
  const pepper = opciones.pepper
  const usuarios = new Map<string, Usuario>()
  const agregar = async (id: string, numero: string, negocioId: string, rol: 'dueno' | 'vendedor', pin: string) => {
    usuarios.set(id, {
      usuarioId: id, negocioId, rol, nombre: id, numero, debe: false,
      password: await passwordParaCuenta(numero, pin, pepper),
    })
  }
  await agregar('dueno-a', NUM_DUENO_A, NEGOCIO_A, 'dueno', PIN_DUENO_A)
  await agregar('vend-a', NUM_VEND_A, NEGOCIO_A, 'vendedor', PIN_VEND_A)
  await agregar('vend-a2', NUM_VEND_A2, NEGOCIO_A, 'vendedor', '864209')
  await agregar('dueno-b', NUM_DUENO_B, NEGOCIO_B, 'dueno', '975310')

  const codigos = new Map<string, { hash: string; usado: boolean }>()
  const auditoria: Auditoria[] = []
  const almacen = almacenEnMemoria()
  let ahora = T0

  const datos: DatosPin = {
    async vinculo(id) {
      const u = usuarios.get(id)
      return u ? { usuarioId: u.usuarioId, negocioId: u.negocioId, rol: u.rol, nombre: u.nombre } : null
    },
    async vendedoresDe(negocioId) {
      return [...usuarios.values()]
        .filter((u) => u.negocioId === negocioId && u.rol === 'vendedor')
        .map((u) => ({ usuarioId: u.usuarioId, nombre: u.nombre, debeCambiar: u.debe }))
    },
    async numeroDe(id) { return usuarios.get(id)?.numero ?? null },
    async usuarioPorNumero(numero) {
      const u = [...usuarios.values()].find((x) => x.numero === numero)
      return u ? { usuarioId: u.usuarioId } : null
    },
    async autenticar(email, password) {
      const u = [...usuarios.values()].find((x) => emailDeTelefono(x.numero) === email)
      return u && u.password === password ? 'ok' : 'rechazado'
    },
    async cambiarPassword(id, password) {
      const u = usuarios.get(id)
      if (u) u.password = password
    },
    async debeCambiar(id) { return usuarios.get(id)?.debe ?? false },
    async marcarCambio(id, debe) {
      const u = usuarios.get(id)
      if (u) u.debe = debe
    },
    async hayCodigo(id) {
      const c = codigos.get(id)
      return !!c && !c.usado
    },
    async guardarCodigo(id, hash) { codigos.set(id, { hash, usado: false }) },
    async consumirCodigo(id, hash) {
      const c = codigos.get(id)
      if (!c || c.usado || c.hash !== hash) return false
      c.usado = true
      return true
    },
    async auditar(evento) { auditoria.push({ ...evento }) },
  }

  const deps: DependenciasPin = {
    datos,
    almacen,
    pepper,
    verificarCaptcha: opciones.captcha,
    ahora: () => ahora,
  }
  return {
    deps, usuarios, codigos, auditoria, almacen, datos,
    avanzar(ms: number) { ahora += ms },
    puedeEntrar: async (id: string, pin: string) =>
      usuarios.get(id)!.password === await passwordParaCuenta(usuarios.get(id)!.numero, pin, pepper),
  }
}

const reiniciar = (usuarioId: string) => ({ operacion: 'reiniciar_vendedor', usuarioId })

afterEach(() => vi.restoreAllMocks())

describe('el dueño restablece el PIN de un vendedor', () => {
  it('genera un PIN temporal de 6 dígitos, lo exige cambiar y lo audita', async () => {
    const m = await armar()
    const r = await procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)

    expect(r.status).toBe(200)
    const pin = r.cuerpo.pinTemporal as string
    expect(pin).toMatch(/^\d{6}$/)
    expect(pinValido(pin)).toBe(true)
    expect(await m.puedeEntrar('vend-a', pin)).toBe(true)
    expect(await m.puedeEntrar('vend-a', PIN_VEND_A)).toBe(false)
    expect(m.usuarios.get('vend-a')!.debe).toBe(true)
    expect(m.auditoria).toEqual([
      { negocioId: NEGOCIO_A, actorId: 'dueno-a', objetivoId: 'vend-a', accion: 'pin_vendedor_reiniciado' },
    ])
  })

  it('un vendedor no puede resetear a otro vendedor', async () => {
    const m = await armar()
    const antes = m.usuarios.get('vend-a2')!.password
    const r = await procesarPinSesion(reiniciar('vend-a2'), 'vend-a', m.deps)

    expect(r.status).toBe(403)
    expect(r.cuerpo.ok).toBe(false)
    expect(r.cuerpo).not.toHaveProperty('pinTemporal')
    expect(m.usuarios.get('vend-a2')!.password).toBe(antes)
    expect(m.usuarios.get('vend-a2')!.debe).toBe(false)
    expect(m.auditoria).toEqual([])
  })

  it('un vendedor tampoco puede resetear al dueño ni a sí mismo', async () => {
    const m = await armar()
    const alDueno = await procesarPinSesion(reiniciar('dueno-a'), 'vend-a', m.deps)
    const aSiMismo = await procesarPinSesion(reiniciar('vend-a'), 'vend-a', m.deps)
    expect(alDueno.status).toBe(403)
    expect(aSiMismo.status).toBe(403)
    expect(await m.puedeEntrar('dueno-a', PIN_DUENO_A)).toBe(true)
    expect(await m.puedeEntrar('vend-a', PIN_VEND_A)).toBe(true)
  })

  it('el dueño de otro negocio es rechazado y no cambia nada', async () => {
    const m = await armar()
    const antes = m.usuarios.get('vend-a')!.password
    const r = await procesarPinSesion(reiniciar('vend-a'), 'dueno-b', m.deps)

    expect(r.status).toBe(404)
    expect(r.cuerpo).not.toHaveProperty('pinTemporal')
    expect(m.usuarios.get('vend-a')!.password).toBe(antes)
    expect(m.usuarios.get('vend-a')!.debe).toBe(false)
    expect(m.auditoria).toEqual([])
  })

  it('no se puede usar para cambiarle el PIN a otro dueño ni a uno mismo', async () => {
    const m = await armar()
    const aOtroDueno = await procesarPinSesion(reiniciar('dueno-b'), 'dueno-a', m.deps)
    const aSiMismo = await procesarPinSesion(reiniciar('dueno-a'), 'dueno-a', m.deps)
    expect([aOtroDueno.status, aSiMismo.status].every((s) => s === 403 || s === 404)).toBe(true)
    expect(await m.puedeEntrar('dueno-b', '975310')).toBe(true)
    expect(await m.puedeEntrar('dueno-a', PIN_DUENO_A)).toBe(true)
  })

  it('quien no pertenece a ningún negocio, o un usuario inexistente, no puede', async () => {
    const m = await armar()
    expect((await procesarPinSesion(reiniciar('vend-a'), 'fantasma', m.deps)).status).toBe(403)
    expect((await procesarPinSesion(reiniciar('no-existe'), 'dueno-a', m.deps)).status).toBe(404)
  })

  it('rechaza pedidos mal formados', async () => {
    const m = await armar()
    for (const entrada of [null, [], 'x', { operacion: 'reiniciar_vendedor' }, { operacion: 'reiniciar_vendedor', usuarioId: 7 }, { operacion: 'otra' }]) {
      expect((await procesarPinSesion(entrada, 'dueno-a', m.deps)).status).toBe(400)
    }
  })

  it('limita los reinicios por dueño: el sexto en 15 minutos se bloquea, sin afectar el ingreso del vendedor', async () => {
    const m = await armar()
    const estados: number[] = []
    for (let i = 0; i < 6; i++) estados.push((await procesarPinSesion(reiniciar(i % 2 ? 'vend-a' : 'vend-a2'), 'dueno-a', m.deps)).status)
    expect(estados).toEqual([200, 200, 200, 200, 200, 429])

    const bloqueo = await procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)
    expect(bloqueo.cuerpo).toMatchObject({ ok: false, motivo: 'bloqueado' })
    expect(Number(bloqueo.cuerpo.reintentarEnSegundos)).toBeGreaterThan(0)
    // Las claves son de pin, no de teléfono: el login del vendedor sigue libre.
    expect([...m.almacen.filas.keys()].every((k) => !/^\d+$/.test(k))).toBe(true)
    m.avanzar(16 * MIN)
    expect((await procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)).status).toBe(200)
  })
})

describe('el PIN temporal obliga a cambiarlo', () => {
  async function conTemporal() {
    const m = await armar()
    const r = await procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)
    return { m, temporal: r.cuerpo.pinTemporal as string }
  }

  it('el vendedor ve que tiene que cambiarlo, y sigue así hasta que lo cambia', async () => {
    const { m } = await conTemporal()
    const estado = await procesarPinSesion({ operacion: 'estado' }, 'vend-a', m.deps)
    expect(estado.status).toBe(200)
    expect(estado.cuerpo).toMatchObject({ ok: true, rol: 'vendedor', debeCambiarPin: true })
    expect(estado.cuerpo).not.toHaveProperty('vendedores')
    // Recargar la pantalla no lo libera: el dato vive en el servidor.
    expect((await procesarPinSesion({ operacion: 'estado' }, 'vend-a', m.deps)).cuerpo.debeCambiarPin).toBe(true)
  })

  it('el dueño ve a qué vendedores les falta cambiar el PIN', async () => {
    const { m } = await conTemporal()
    const estado = await procesarPinSesion({ operacion: 'estado' }, 'dueno-a', m.deps)
    const vendedores = estado.cuerpo.vendedores as Array<{ usuarioId: string; pendiente: boolean }>
    expect(vendedores.map((v) => [v.usuarioId, v.pendiente])).toEqual([['vend-a', true], ['vend-a2', false]])
  })

  it('cambiarlo con el PIN actual correcto lo libera y anula el temporal', async () => {
    const { m, temporal } = await conTemporal()
    const r = await procesarPinSesion({ operacion: 'cambiar', pinActual: temporal, pinNuevo: '246810' }, 'vend-a', m.deps)

    expect(r.status).toBe(200)
    expect(r.cuerpo).not.toHaveProperty('codigoRecuperacion')
    expect(m.usuarios.get('vend-a')!.debe).toBe(false)
    expect(await m.puedeEntrar('vend-a', '246810')).toBe(true)
    expect(await m.puedeEntrar('vend-a', temporal)).toBe(false)
    expect(m.auditoria.at(-1)).toMatchObject({ accion: 'pin_cambiado', actorId: 'vend-a', objetivoId: 'vend-a' })
  })

  it('con el PIN actual equivocado no cambia nada y la bandera sigue', async () => {
    const { m, temporal } = await conTemporal()
    const r = await procesarPinSesion({ operacion: 'cambiar', pinActual: '111222', pinNuevo: '246810' }, 'vend-a', m.deps)
    expect(r.status).toBe(403)
    expect(r.cuerpo).toMatchObject({ ok: false, motivo: 'pin_incorrecto' })
    expect(m.usuarios.get('vend-a')!.debe).toBe(true)
    expect(await m.puedeEntrar('vend-a', temporal)).toBe(true)
  })

  it('los intentos de adivinar el PIN actual también se bloquean', async () => {
    const { m, temporal } = await conTemporal()
    let ultimo = 0
    for (let i = 0; i < 6; i++) {
      ultimo = (await procesarPinSesion({ operacion: 'cambiar', pinActual: `10000${i + 1}`, pinNuevo: '246810' }, 'vend-a', m.deps)).status
    }
    expect(ultimo).toBe(429)
    const conElCorrecto = await procesarPinSesion({ operacion: 'cambiar', pinActual: temporal, pinNuevo: '246810' }, 'vend-a', m.deps)
    expect(conElCorrecto.status).toBe(429)
    expect(m.usuarios.get('vend-a')!.debe).toBe(true)
  })

  it.each([
    ['igual al actual', 'TEMPORAL'],
    ['obvio', '111111'],
    ['de menos de 6 números', '1234'],
    ['con letras', '12ab56'],
  ])('rechaza un PIN nuevo %s', async (_, nuevo) => {
    const { m, temporal } = await conTemporal()
    const pinNuevo = nuevo === 'TEMPORAL' ? temporal : nuevo
    const r = await procesarPinSesion({ operacion: 'cambiar', pinActual: temporal, pinNuevo }, 'vend-a', m.deps)
    expect(r.status).toBe(400)
    expect(m.usuarios.get('vend-a')!.debe).toBe(true)
    expect(await m.puedeEntrar('vend-a', temporal)).toBe(true)
  })
})

describe('código de recuperación del dueño', () => {
  const FORMATO = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/

  async function conCodigo(opciones: Parameters<typeof armar>[0] = {}) {
    const m = await armar(opciones)
    const r = await procesarPinSesion({ operacion: 'generar_codigo', pin: PIN_DUENO_A }, 'dueno-a', m.deps)
    return { m, codigo: r.cuerpo.codigoRecuperacion as string }
  }
  const recuperar = (m: Awaited<ReturnType<typeof armar>>, codigo: string, pinNuevo = '135792', telefono = '261 555 0001') =>
    procesarRecuperacion({ telefono, codigo, pinNuevo }, m.deps)

  it('se genera con el PIN actual, se muestra una vez y se guarda sólo el hash', async () => {
    const { m, codigo } = await conCodigo()
    expect(codigo).toMatch(FORMATO)
    const guardado = m.codigos.get('dueno-a')!
    expect(guardado.hash).not.toContain(codigo)
    expect(guardado.hash).not.toContain(codigo.replaceAll('-', ''))
    expect(guardado.usado).toBe(false)
    const estado = await procesarPinSesion({ operacion: 'estado' }, 'dueno-a', m.deps)
    expect(estado.cuerpo).toMatchObject({ rol: 'dueno', tieneCodigo: true })
    // El estado nunca vuelve a mostrar el código.
    expect(JSON.stringify(estado.cuerpo)).not.toContain(codigo)
    expect(m.auditoria.at(-1)).toMatchObject({ accion: 'pin_codigo_generado', actorId: 'dueno-a' })
  })

  it('exige el PIN actual y es sólo del dueño', async () => {
    const m = await armar()
    const mal = await procesarPinSesion({ operacion: 'generar_codigo', pin: '111222' }, 'dueno-a', m.deps)
    const vendedor = await procesarPinSesion({ operacion: 'generar_codigo', pin: PIN_VEND_A }, 'vend-a', m.deps)
    expect(mal.status).toBe(403)
    expect(vendedor.status).toBe(403)
    expect(m.codigos.size).toBe(0)
  })

  it('un código nuevo invalida el anterior', async () => {
    const { m, codigo } = await conCodigo()
    const otro = (await procesarPinSesion({ operacion: 'generar_codigo', pin: PIN_DUENO_A }, 'dueno-a', m.deps)).cuerpo.codigoRecuperacion as string
    expect(otro).not.toBe(codigo)
    expect((await recuperar(m, codigo)).status).toBe(401)
    expect((await recuperar(m, otro)).status).toBe(200)
  })

  it('recupera el acceso: PIN nuevo, vuelve a ser libre y devuelve un código nuevo', async () => {
    const { m, codigo } = await conCodigo()
    m.usuarios.get('dueno-a')!.debe = true
    const r = await recuperar(m, codigo.toLowerCase().replaceAll('-', ' '), '135792')

    expect(r.status).toBe(200)
    expect(await m.puedeEntrar('dueno-a', '135792')).toBe(true)
    expect(await m.puedeEntrar('dueno-a', PIN_DUENO_A)).toBe(false)
    expect(m.usuarios.get('dueno-a')!.debe).toBe(false)
    const nuevo = r.cuerpo.codigoRecuperacion as string
    expect(nuevo).toMatch(FORMATO)
    expect(nuevo).not.toBe(codigo)
    expect(m.auditoria.at(-1)).toMatchObject({ accion: 'pin_recuperado', negocioId: NEGOCIO_A, objetivoId: 'dueno-a' })
  })

  it('sirve una sola vez', async () => {
    const { m, codigo } = await conCodigo()
    expect((await recuperar(m, codigo, '135792')).status).toBe(200)
    const segunda = await recuperar(m, codigo, '975318')
    expect(segunda.status).toBe(401)
    expect(await m.puedeEntrar('dueno-a', '135792')).toBe(true)
  })

  it('dos pedidos a la vez con el mismo código: gana uno solo', async () => {
    const { m, codigo } = await conCodigo()
    const [a, b] = await Promise.all([recuperar(m, codigo, '135792'), recuperar(m, codigo, '975318')])
    expect([a.status, b.status].sort()).toEqual([200, 401])
    const ganador = a.status === 200 ? '135792' : '975318'
    expect(await m.puedeEntrar('dueno-a', ganador)).toBe(true)
  })

  it('un código equivocado, un teléfono inexistente y un vendedor responden lo mismo', async () => {
    const { m, codigo } = await conCodigo()
    const malCodigo = await recuperar(m, 'ABCD-EFGH-JKLM-NPQR')
    const sinCuenta = await recuperar(m, codigo, '135792', '261 999 9999')
    const vendedor = await recuperar(m, codigo, '135792', '261 555 0002')
    expect(malCodigo.status).toBe(401)
    expect(sinCuenta).toEqual(malCodigo)
    expect(vendedor).toEqual(malCodigo)
    expect(await m.puedeEntrar('dueno-a', PIN_DUENO_A)).toBe(true)
  })

  it('cinco intentos fallidos bloquean la recuperación de ese teléfono, aunque llegue el código bueno', async () => {
    const { m, codigo } = await conCodigo()
    for (let i = 0; i < 5; i++) await recuperar(m, 'ABCD-EFGH-JKLM-NPQR')
    const r = await recuperar(m, codigo)
    expect(r.status).toBe(429)
    expect(r.cuerpo).toMatchObject({ ok: false, motivo: 'bloqueado' })
    expect(await m.puedeEntrar('dueno-a', PIN_DUENO_A)).toBe(true)
    m.avanzar(16 * MIN)
    expect((await recuperar(m, codigo)).status).toBe(200)
  })

  it('el bloqueo de la recuperación no bloquea el ingreso con PIN del mismo teléfono', async () => {
    const { m } = await conCodigo()
    for (let i = 0; i < 6; i++) await recuperar(m, 'ABCD-EFGH-JKLM-NPQR')
    expect(m.almacen.filas.has(NUM_DUENO_A)).toBe(false)
  })

  it('un PIN nuevo flojo se rechaza sin gastar el código', async () => {
    const { m, codigo } = await conCodigo()
    expect((await recuperar(m, codigo, '111111')).status).toBe(400)
    expect((await recuperar(m, codigo, '135792')).status).toBe(200)
  })

  it('al recuperar se limpia el bloqueo de ingreso por PIN de ese teléfono', async () => {
    const { m, codigo } = await conCodigo()
    m.almacen.filas.set(NUM_DUENO_A, { fallos: 5, desde: T0, bloqueadoHasta: T0 + 15 * MIN, version: 3 })
    expect((await recuperar(m, codigo)).status).toBe(200)
    expect(m.almacen.filas.has(NUM_DUENO_A)).toBe(false)
  })

  it('con captcha configurado, sin token no se prueba ningún código', async () => {
    const captcha = vi.fn(async (t: string) => t === 'bueno')
    const { m, codigo } = await conCodigo({ captcha })
    const sin = await procesarRecuperacion({ telefono: '2615550001', codigo, pinNuevo: '135792' }, m.deps)
    expect(sin.status).toBe(400)
    expect(sin.cuerpo).toMatchObject({ motivo: 'verificacion' })
    expect(m.almacen.filas.size).toBe(0)
    const con = await procesarRecuperacion({ telefono: '2615550001', codigo, pinNuevo: '135792', captchaToken: 'bueno' }, m.deps)
    expect(con.status).toBe(200)
  })

  it('cambiar el PIN siendo dueño entrega un código nuevo; un vendedor no recibe ninguno', async () => {
    const { m, codigo } = await conCodigo()
    const r = await procesarPinSesion({ operacion: 'cambiar', pinActual: PIN_DUENO_A, pinNuevo: '246810' }, 'dueno-a', m.deps)
    expect(r.status).toBe(200)
    const nuevo = r.cuerpo.codigoRecuperacion as string
    expect(nuevo).toMatch(FORMATO)
    expect((await recuperar(m, codigo)).status).toBe(401)
    expect((await recuperar(m, nuevo)).status).toBe(200)
  })

  it('emitirCodigoRecuperacion sirve para cuentas nuevas y PIN regenerados desde el panel', async () => {
    const m = await armar()
    const codigo = await emitirCodigoRecuperacion('dueno-a', m.deps)
    expect(codigo).toMatch(FORMATO)
    expect((await recuperar(m, codigo)).status).toBe(200)
  })

  it('funciona igual con la contraseña v2 (con secreto del servidor)', async () => {
    const { m, codigo } = await conCodigo({ pepper: 'secreto-del-servidor' })
    expect((await recuperar(m, codigo, '135792')).status).toBe(200)
    expect(await m.puedeEntrar('dueno-a', '135792')).toBe(true)
  })
})

describe('nada sensible en logs ni en la auditoría', () => {
  it('ningún PIN, código, hash ni contraseña llega a console ni a la auditoría', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}))
    const m = await armar({ pepper: 'secreto-del-servidor' })
    const secretos: string[] = [PIN_DUENO_A, PIN_VEND_A, 'secreto-del-servidor', '246810', '135792', '111222']

    const reinicio = await procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)
    secretos.push(reinicio.cuerpo.pinTemporal as string)
    await procesarPinSesion(reiniciar('vend-a'), 'vend-a2', m.deps) // rechazado
    await procesarPinSesion(reiniciar('vend-a'), 'dueno-b', m.deps) // rechazado
    const gen = await procesarPinSesion({ operacion: 'generar_codigo', pin: PIN_DUENO_A }, 'dueno-a', m.deps)
    const codigo = gen.cuerpo.codigoRecuperacion as string
    secretos.push(codigo, codigo.replaceAll('-', ''), m.codigos.get('dueno-a')!.hash)
    await procesarPinSesion({ operacion: 'cambiar', pinActual: '111222', pinNuevo: '246810' }, 'vend-a', m.deps) // PIN malo
    await procesarPinSesion({ operacion: 'cambiar', pinActual: reinicio.cuerpo.pinTemporal, pinNuevo: '246810' }, 'vend-a', m.deps)
    await procesarRecuperacion({ telefono: '2615550001', codigo: 'ABCD-EFGH-JKLM-NPQR', pinNuevo: '135792' }, m.deps)
    const rec = await procesarRecuperacion({ telefono: '2615550001', codigo, pinNuevo: '135792' }, m.deps)
    secretos.push(rec.cuerpo.codigoRecuperacion as string)
    for (const u of m.usuarios.values()) secretos.push(u.password)

    const impreso = espias.flatMap((e) => e.mock.calls.flat()).map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n')
    const auditoria = JSON.stringify(m.auditoria)
    for (const secreto of secretos) {
      expect(impreso).not.toContain(secreto)
      expect(auditoria).not.toContain(secreto)
    }
    // Y tampoco los teléfonos completos.
    for (const numero of [NUM_DUENO_A, NUM_VEND_A, '2615550001']) {
      expect(impreso).not.toContain(numero)
      expect(auditoria).not.toContain(numero)
    }
    expect(m.auditoria.length).toBeGreaterThanOrEqual(4)
  })

  it('si el almacén falla, el error no se vuelca con datos sensibles', async () => {
    const espias = (['log', 'info', 'warn', 'error'] as const).map((n) => vi.spyOn(console, n).mockImplementation(() => {}))
    const m = await armar()
    m.deps.datos.cambiarPassword = async () => { throw new Error(`falló con ${PIN_VEND_A}`) }
    await expect(procesarPinSesion(reiniciar('vend-a'), 'dueno-a', m.deps)).rejects.toThrow()
    const impreso = espias.flatMap((e) => e.mock.calls.flat()).join('\n')
    expect(impreso).not.toContain(PIN_VEND_A)
  })
})
