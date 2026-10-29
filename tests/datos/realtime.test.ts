import { describe, it, expect, vi } from 'vitest'

describe('escucharCambios', () => {
  it('sin nube configurada no suscribe nada y devuelve null', async () => {
    // En CI las variables de Supabase existen (falsas): se fuerza el caso sin nube.
    vi.doMock('@/datos/nube/cliente', () => ({ cliente: null }))
    vi.resetModules()
    const { escucharCambios: escuchar } = await import('@/datos/nube/realtime')
    expect(escuchar(['productos'], () => {})).toBeNull()
    vi.doUnmock('@/datos/nube/cliente')
    vi.resetModules()
  })

  it('suscribe cada tabla en un canal y devuelve la parada', async () => {
    // Canal falso: registra lo que le pasan y responde lo que el
    // RealtimeChannel real devolvería. Nada se afirma acá adentro:
    // los valores se guardan y se afirman después de la llamada, que
    // un assert dentro del mock puede terminar tragado por un catch.
    const escuchas: {
      tipo: string
      filtro: { event: string; schema: string; table: string }
      alSonar: () => void
    }[] = []
    let nombreCanal = ''
    let suscripciones = 0
    let desuscripciones = 0
    const canal = {
      on: (
        tipo: string,
        filtro: { event: string; schema: string; table: string },
        alSonar: () => void,
      ) => {
        escuchas.push({ tipo, filtro, alSonar })
        return canal
      },
      subscribe: () => {
        suscripciones += 1
        return canal
      },
      unsubscribe: async () => {
        desuscripciones += 1
        return 'ok'
      },
    }

    // Vitest no carga .env.local, así que el `cliente` real ya es null;
    // para el cableado se lo reemplaza por uno falso sólo en este test.
    vi.doMock('@/datos/nube/cliente', () => ({
      cliente: {
        channel: (nombre: string) => {
          nombreCanal = nombre
          return canal
        },
      },
    }))
    vi.resetModules()
    const { escucharCambios: escuchar } = await import('@/datos/nube/realtime')

    const timbre = vi.fn()
    const parar = escuchar(['productos', 'ventas'], timbre)

    expect(parar).toBeTypeOf('function')
    expect(nombreCanal).toBe('libreta-cambios')
    expect(suscripciones).toBe(1)
    expect(escuchas.map(({ tipo, filtro }) => ({ tipo, filtro }))).toEqual([
      {
        tipo: 'postgres_changes',
        filtro: { event: '*', schema: 'public', table: 'productos' },
      },
      {
        tipo: 'postgres_changes',
        filtro: { event: '*', schema: 'public', table: 'ventas' },
      },
    ])

    // El evento no trae los datos: es sólo el timbre. Cuando suena
    // cualquiera de las tablas, el que escucha decide qué hacer.
    escuchas[0].alSonar()
    escuchas[1].alSonar()
    expect(timbre).toHaveBeenCalledTimes(2)

    parar?.()
    expect(desuscripciones).toBe(1)

    // El reemplazo vale sólo para este test: si mañana se agrega otro,
    // debe ver el cliente real (null en las pruebas), no éste.
    vi.doUnmock('@/datos/nube/cliente')
  })
})
