// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { procesarIngreso, type AlmacenIntentos, type DependenciasIngreso, type ResultadoAuth } from '../../supabase/functions/_shared/ingreso.ts'
import type { EstadoIntentos } from '../../supabase/functions/_shared/limiteIngreso.ts'
import { emailDeTelefono, passwordV1, passwordV2 } from '../../supabase/functions/_shared/credenciales.ts'

const MIN = 60_000
const T0 = 1_800_000_000_000
const SESION = { access_token: 'acceso', refresh_token: 'refresco', expires_in: 3600, token_type: 'bearer' }

/** Almacén en memoria con la misma semántica que la tabla: compara la
 *  versión antes de escribir, como el UPDATE ... WHERE version = $1. */
function almacenEnMemoria(): AlmacenIntentos & { filas: Map<string, EstadoIntentos> } {
  const filas = new Map<string, EstadoIntentos>()
  return {
    filas,
    async leer(telefono) {
      const fila = filas.get(telefono)
      return fila ? { ...fila } : null
    },
    async guardar(telefono, previo, nuevo) {
      const actual = filas.get(telefono) ?? null
      if ((actual?.version ?? null) !== (previo?.version ?? null)) return false
      filas.set(telefono, { ...nuevo, version: (previo?.version ?? 0) + 1 })
      return true
    },
    async limpiar(telefono) {
      filas.delete(telefono)
    },
  }
}

interface Cuenta { usuarioId: string; email: string; password: string }

function armar(opciones: { cuentas?: Cuenta[]; pepper?: string; captcha?: (token: string) => Promise<boolean> } = {}) {
  const almacen = almacenEnMemoria()
  const cuentas = opciones.cuentas ?? []
  let ahora = T0
  const autenticar = vi.fn(async (email: string, password: string): Promise<ResultadoAuth> => {
    const cuenta = cuentas.find((c) => c.email === email && c.password === password)
    return cuenta ? { tipo: 'ok', usuarioId: cuenta.usuarioId, sesion: SESION } : { tipo: 'rechazado' }
  })
  const cambiarPassword = vi.fn(async (usuarioId: string, password: string) => {
    const cuenta = cuentas.find((c) => c.usuarioId === usuarioId)
    if (cuenta) cuenta.password = password
  })
  const deps: DependenciasIngreso = {
    almacen,
    autenticar,
    cambiarPassword,
    pepper: opciones.pepper,
    verificarCaptcha: opciones.captcha,
    ahora: () => ahora,
  }
  return {
    deps,
    almacen,
    autenticar,
    cambiarPassword,
    avanzar(ms: number) { ahora += ms },
  }
}

const NUMERO = '542615551234'
const CUENTA_V1: Cuenta = { usuarioId: 'u1', email: emailDeTelefono(NUMERO), password: passwordV1(NUMERO, '482913') }

describe('procesarIngreso', () => {
  it('con teléfono y PIN correctos devuelve la sesión y borra los fallos previos', async () => {
    const { deps, almacen } = armar({ cuentas: [{ ...CUENTA_V1 }] })
    await procesarIngreso({ telefono: '261 555 1234', pin: '111222' }, deps)
    expect(almacen.filas.get(NUMERO)?.fallos).toBe(1)

    const respuesta = await procesarIngreso({ telefono: '261 555 1234', pin: '482913' }, deps)

    expect(respuesta).toEqual({ status: 200, cuerpo: { ok: true, sesion: SESION } })
    expect(almacen.filas.has(NUMERO)).toBe(false)
  })

  it('un PIN equivocado da una respuesta genérica', async () => {
    const { deps } = armar({ cuentas: [{ ...CUENTA_V1 }] })
    const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '999111' }, deps)
    expect(respuesta).toEqual({ status: 401, cuerpo: { ok: false, error: 'credenciales' } })
  })

  it('un teléfono que no existe responde exactamente igual que uno que sí', async () => {
    const { deps } = armar({ cuentas: [{ ...CUENTA_V1 }] })
    const existe = await procesarIngreso({ telefono: '2615551234', pin: '999111' }, deps)
    const noExiste = await procesarIngreso({ telefono: '2619999999', pin: '999111' }, deps)
    expect(noExiste).toEqual(existe)
  })

  it('tras 5 fallos bloquea el teléfono 15 minutos, aunque después llegue el PIN correcto', async () => {
    const { deps, autenticar, avanzar } = armar({ cuentas: [{ ...CUENTA_V1 }] })
    const respuestas = []
    for (let i = 0; i < 5; i++) {
      respuestas.push(await procesarIngreso({ telefono: '2615551234', pin: `10000${i + 1}` }, deps))
      avanzar(MIN)
    }
    expect(respuestas.slice(0, 4).every((r) => r.status === 401)).toBe(true)
    // El quinto fallo ya avisa el bloqueo.
    expect(respuestas[4]).toEqual({ status: 429, cuerpo: { ok: false, error: 'bloqueado', reintentarEnSegundos: 15 * 60 } })

    autenticar.mockClear()
    const correcto = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
    expect(correcto).toEqual({ status: 429, cuerpo: { ok: false, error: 'bloqueado', reintentarEnSegundos: 14 * 60 } })
    // Bloqueado no se le pregunta a Auth: no hay forma de seguir probando.
    expect(autenticar).not.toHaveBeenCalled()

    avanzar(14 * MIN)
    const despues = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
    expect(despues.status).toBe(200)
  })

  it('un teléfono inexistente también se bloquea, para no delatar cuáles existen', async () => {
    const { deps } = armar()
    let ultima
    for (let i = 0; i < 5; i++) ultima = await procesarIngreso({ telefono: '2619999999', pin: `20000${i + 1}` }, deps)
    expect(ultima?.status).toBe(429)
  })

  it('bloquear un teléfono no afecta a otro', async () => {
    const { deps } = armar({ cuentas: [{ ...CUENTA_V1 }] })
    for (let i = 0; i < 5; i++) await procesarIngreso({ telefono: '2619999999', pin: `20000${i + 1}` }, deps)
    const otro = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
    expect(otro.status).toBe(200)
  })

  it('el mismo teléfono escrito distinto cuenta como el mismo', async () => {
    const { deps, almacen } = armar()
    await procesarIngreso({ telefono: '261 555-1234', pin: '300001' }, deps)
    await procesarIngreso({ telefono: '+54 (261) 5551234', pin: '300002' }, deps)
    expect(almacen.filas.get(NUMERO)?.fallos).toBe(2)
  })

  it('intentos en paralelo no se escapan del conteo', async () => {
    const { deps } = armar()
    const respuestas = await Promise.all(
      Array.from({ length: 12 }, (_, i) => procesarIngreso({ telefono: '2615551234', pin: String(400000 + i + 1) }, deps)),
    )
    // Como mucho 5 llegan a Auth; el resto se rechaza sin probar el PIN.
    expect(respuestas.filter((r) => r.status === 401).length).toBeLessThanOrEqual(4)
    expect(respuestas.filter((r) => r.status !== 401).every((r) => r.status === 429)).toBe(true)
  })

  it('un pedido mal formado no llega a Auth ni suma intentos', async () => {
    const { deps, autenticar, almacen } = armar()
    for (const cuerpo of [null, 'texto', {}, { telefono: '2615551234' }, { telefono: '2615551234', pin: '12' }, { telefono: '12', pin: '123456' }]) {
      const respuesta = await procesarIngreso(cuerpo, deps)
      expect(respuesta).toEqual({ status: 401, cuerpo: { ok: false, error: 'credenciales' } })
    }
    expect(autenticar).not.toHaveBeenCalled()
    expect(almacen.filas.size).toBe(0)
  })

  it('si Auth falla por otro motivo responde 503 sin decir nada de la cuenta', async () => {
    const { deps, autenticar } = armar()
    autenticar.mockResolvedValueOnce({ tipo: 'error' })
    const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
    expect(respuesta).toEqual({ status: 503, cuerpo: { ok: false, error: 'servicio' } })
  })

  describe('con clave del servidor (pepper)', () => {
    const PEPPER = 'secreto-del-servidor-de-prueba'

    it('una cuenta vieja entra con la contraseña v1 y queda migrada a v2', async () => {
      const cuenta = { ...CUENTA_V1 }
      const { deps, cambiarPassword } = armar({ cuentas: [cuenta], pepper: PEPPER })

      const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)

      expect(respuesta.status).toBe(200)
      const v2 = await passwordV2(NUMERO, '482913', PEPPER)
      expect(cambiarPassword).toHaveBeenCalledWith('u1', v2)
      expect(cuenta.password).toBe(v2)
    })

    it('una cuenta ya migrada entra directo con v2', async () => {
      const cuenta = { ...CUENTA_V1, password: await passwordV2(NUMERO, '482913', PEPPER) }
      const { deps, autenticar, cambiarPassword } = armar({ cuentas: [cuenta], pepper: PEPPER })
      const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
      expect(respuesta.status).toBe(200)
      expect(autenticar).toHaveBeenCalledTimes(1)
      expect(cambiarPassword).not.toHaveBeenCalled()
    })

    it('la contraseña v2 no se puede calcular sin el secreto', async () => {
      const v2 = await passwordV2(NUMERO, '482913', PEPPER)
      expect(v2).not.toContain('482913')
      expect(v2).not.toBe(await passwordV2(NUMERO, '482913', 'otro-secreto'))
      expect(v2).not.toBe(passwordV1(NUMERO, '482913'))
    })
  })

  describe('con verificación humana', () => {
    it('sin token no prueba el PIN ni suma intentos (no se pueden bloquear teléfonos ajenos gratis)', async () => {
      const captcha = vi.fn(async () => false)
      const { deps, autenticar, almacen } = armar({ captcha })
      const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '482913' }, deps)
      expect(respuesta).toEqual({ status: 400, cuerpo: { ok: false, error: 'verificacion' } })
      expect(autenticar).not.toHaveBeenCalled()
      expect(almacen.filas.size).toBe(0)
    })

    it('con token válido sigue normalmente', async () => {
      const captcha = vi.fn(async (token: string) => token === 'humano')
      const { deps } = armar({ cuentas: [{ ...CUENTA_V1 }], captcha })
      const respuesta = await procesarIngreso({ telefono: '2615551234', pin: '482913', captchaToken: 'humano' }, deps)
      expect(captcha).toHaveBeenCalledWith('humano')
      expect(respuesta.status).toBe(200)
    })
  })
})
