import type { BrowserContext, Page, Request } from '@playwright/test'

/** Todo lo que toca "la nube" en estas pruebas es falso: el proyecto de
 *  Supabase no existe y cada petición se atiende acá, en el navegador. */
export const NUBE = 'https://falso.supabase.co'
export const USUARIO_ID = '11111111-1111-4111-8111-111111111111'
export const NEGOCIO_ID = '22222222-2222-4222-8222-222222222222'
const CLAVE_SESION = 'sb-falso-auth-token'
export const HORA = 60 * 60 * 1000

function base64url(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url')
}

/** Una sesión con la forma de la real (el JWT no se valida en el navegador). */
function sesionFalsa(venceEnSegundos: number) {
  const jwt = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({
    sub: USUARIO_ID, role: 'authenticated', aud: 'authenticated', exp: venceEnSegundos,
  })}.firma-falsa`
  return {
    access_token: jwt,
    refresh_token: 'refresco-falso',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: venceEnSegundos,
    user: { id: USUARIO_ID, aud: 'authenticated', role: 'authenticated', email: 'dueno@falso.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  }
}

export interface NubeFalsa {
  /** Mientras es true, la nube "no contesta": como si no hubiera señal. */
  caida: boolean
  /** Peticiones de escritura que llegaron a la nube falsa. */
  escrituras: { metodo: string; ruta: string; cuerpo: unknown }[]
  /** Peticiones a cualquier otro host (debe quedar vacío). */
  externas: string[]
}

function cuerpoDe(peticion: Request): unknown {
  const texto = peticion.postData()
  if (!texto) return null
  try { return JSON.parse(texto) } catch { return texto }
}

const AHORA = Date.now()
const FILAS: Record<string, Record<string, unknown>> = {
  usuarios_negocio: { negocio_id: NEGOCIO_ID, rol: 'dueno', nombre: 'Dueño de prueba' },
  negocios: { id: NEGOCIO_ID, nombre: 'Almacén de prueba', logo: null, color: null },
  suscripciones: {
    id: '33333333-3333-4333-8333-333333333333', negocio_id: NEGOCIO_ID, plan_id: null, plan_nombre: 'Prueba',
    importe_centavos: 0, estado: 'activa', tipo: 'mensual',
    inicio_en: new Date(AHORA - 24 * HORA).toISOString(), vence_en: new Date(AHORA + 30 * 24 * HORA).toISOString(),
    actualizado_en: new Date(AHORA).toISOString(),
  },
}

/** Prepara el contexto: sesión de dueño guardada, suscripción vigente y una
 *  nube falsa. `sesionVenceEnMs` permite sembrar un token ya vencido (negativo). */
export async function prepararNubeFalsa(
  context: BrowserContext,
  opciones: { sesionVenceEnMs?: number } = {},
): Promise<NubeFalsa> {
  const nube: NubeFalsa = { caida: false, escrituras: [], externas: [] }
  const venceEn = Math.floor((Date.now() + (opciones.sesionVenceEnMs ?? 2 * HORA)) / 1000)
  const sesion = JSON.stringify(sesionFalsa(venceEn))

  await context.addInitScript(([clave, valor]) => {
    // Sólo la primera vez: después manda lo que Supabase haya guardado.
    try { if (!localStorage.getItem(clave)) localStorage.setItem(clave, valor) } catch { /* sin almacenamiento */ }
  }, [CLAVE_SESION, sesion])

  // Primero el cerrojo general (la última ruta registrada gana): nada sale a internet.
  await context.route((url) => url.hostname !== 'localhost' && url.hostname !== 'falso.supabase.co', (ruta) => {
    nube.externas.push(ruta.request().url())
    return ruta.abort('blockedbyclient')
  })

  await context.route(`${NUBE}/**`, async (ruta) => {
    const peticion = ruta.request()
    if (nube.caida) return ruta.abort('internetdisconnected')
    const url = new URL(peticion.url())
    const metodo = peticion.method()
    const json = (estado: number, cuerpo: unknown) =>
      ruta.fulfill({ status: estado, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: JSON.stringify(cuerpo) })

    if (url.pathname.startsWith('/auth/v1/')) return json(404, { message: 'sin auth en las pruebas' })

    if (metodo !== 'GET') nube.escrituras.push({ metodo, ruta: url.pathname, cuerpo: cuerpoDe(peticion) })
    const unObjeto = (peticion.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(200, null)
    if (metodo === 'GET') {
      const tabla = url.pathname.replace('/rest/v1/', '')
      const fila = FILAS[tabla]
      if (fila) return json(200, unObjeto ? fila : [fila])
      return json(200, unObjeto ? null : [])
    }
    // upsert/insert/delete: el eco de lo enviado cuando se pidió la fila.
    if (unObjeto) {
      const enviado = cuerpoDe(peticion)
      return json(200, Array.isArray(enviado) ? enviado[0] : enviado)
    }
    return ruta.fulfill({ status: 201, body: '' })
  })

  // Realtime: el canal "abre" y nunca avisa nada.
  await context.routeWebSocket(/falso\.supabase\.co\/realtime/, () => { /* silencio */ })
  return nube
}

/** Abre la app con señal y espera a que el service worker la controle y
 *  haya guardado el armazón: desde ahí, todo lo que sigue puede ser sin red. */
export async function abrirYAsegurarOffline(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('link', { name: /^vender/i }).first().waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  // Recarga ya controlada por el SW: los archivos de la app pasan por su caché.
  await page.reload()
  await page.getByRole('link', { name: /^vender/i }).first().waitFor()
}

/** Lee la cola de sincronización directo de IndexedDB (sin pasar por la app). */
export function leerCola(page: Page): Promise<{ id: string; entidad: string; operacion: string; intentos: number }[]> {
  return page.evaluate(() => new Promise((resolver, rechazar) => {
    const abrir = indexedDB.open('libreta')
    abrir.onerror = () => rechazar(abrir.error)
    abrir.onsuccess = () => {
      const bd = abrir.result
      const pedido = bd.transaction('cola', 'readonly').objectStore('cola').getAll()
      pedido.onsuccess = () => { bd.close(); resolver(pedido.result) }
      pedido.onerror = () => rechazar(pedido.error)
    }
  }))
}

/** Cambia cuándo el servidor confirmó el acceso por última vez (reloj del aparato). */
export function fijarVerificadoEn(page: Page, verificadoEn: number): Promise<void> {
  return page.evaluate((valor) => new Promise<void>((resolver, rechazar) => {
    const abrir = indexedDB.open('libreta')
    abrir.onerror = () => rechazar(abrir.error)
    abrir.onsuccess = () => {
      const bd = abrir.result
      const tx = bd.transaction('negocio', 'readwrite')
      const almacen = tx.objectStore('negocio')
      const pedido = almacen.get('unico')
      pedido.onsuccess = () => { almacen.put({ ...pedido.result, verificadoEn: valor }) }
      tx.oncomplete = () => { bd.close(); resolver() }
      tx.onerror = () => rechazar(tx.error)
    }
  }), verificadoEn)
}

/** Carga un producto desde la pantalla de stock (sirve con y sin señal). */
export async function cargarProducto(page: Page, nombre: string, costo: string, precio: string): Promise<void> {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill(nombre)
  await page.getByLabel('Costo').fill(costo)
  await page.getByLabel('Precio').fill(precio)
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await page.getByText(nombre, { exact: true }).waitFor()
}
