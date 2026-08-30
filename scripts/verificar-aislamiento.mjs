/**
 * Comprueba que un negocio no pueda ver los datos de otro.
 *
 * Es la prueba de seguridad del producto: si esto falla, un almacenero ve
 * la facturación de otro y no hay que salir a vender hasta arreglarlo.
 * Corre contra la base real, así que necesita .env.local con las claves.
 *
 *   node scripts/verificar-aislamiento.mjs
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((linea) => linea.includes('='))
    .map((linea) => {
      const corte = linea.indexOf('=')
      return [linea.slice(0, corte).trim(), linea.slice(corte + 1).trim()]
    }),
)

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL_BASE || !ANON) {
  console.error('Faltan las claves en .env.local — ver docs/nube.md')
  process.exit(1)
}

const sufijo = Date.now().toString().slice(-8)

async function crearDueño(nombreNegocio) {
  const email = `54261${sufijo}@prueba.libreta.app`.replace('prueba', `p${Math.random().toString(36).slice(2, 6)}`)
  const password = `libreta-v1:${email}:aislamiento`

  const alta = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json())

  const token = alta.access_token
  if (!token) throw new Error(`no se pudo crear el usuario de prueba: ${JSON.stringify(alta).slice(0, 200)}`)

  const negocio = await fetch(`${URL_BASE}/rest/v1/rpc/crear_mi_negocio`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nombre: nombreNegocio }),
  }).then((r) => r.json())

  return { token, negocioId: negocio, email }
}

function pedir(ruta, token) {
  return fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
}

const uno = await crearDueño(`Almacén de prueba ${sufijo}`)
const otro = await crearDueño(`Kiosco de prueba ${sufijo}`)

// el primero carga un producto y una venta
await fetch(`${URL_BASE}/rest/v1/productos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${uno.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(), negocio_id: uno.negocioId,
    nombre: 'Secreto comercial', costo: 1, precio: 2, stock: 1, stock_minimo: 0,
  }),
})

const fallas = []

const productosAjenos = await pedir('productos?select=nombre', otro.token)
if (productosAjenos.length !== 0) fallas.push(`el otro negocio ve ${productosAjenos.length} productos ajenos`)

const negociosVistos = await pedir('negocios?select=nombre', otro.token)
if (negociosVistos.length !== 1) fallas.push(`el otro negocio ve ${negociosVistos.length} negocios, debería ver sólo el suyo`)

// escribir en el negocio ajeno tiene que ser rechazado
const intruso = await fetch(`${URL_BASE}/rest/v1/productos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${otro.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(), negocio_id: uno.negocioId,
    nombre: 'Intruso', costo: 1, precio: 2, stock: 1, stock_minimo: 0,
  }),
})
if (intruso.ok) fallas.push('¡se pudo escribir en el negocio ajeno!')

// sin sesión no se ve nada
const anonimo = await fetch(`${URL_BASE}/rest/v1/productos?select=nombre`, {
  headers: { apikey: ANON },
}).then((r) => r.json())
if (Array.isArray(anonimo) && anonimo.length !== 0) fallas.push('sin iniciar sesión se ven productos')

if (fallas.length > 0) {
  console.error('AISLAMIENTO ROTO:')
  for (const falla of fallas) console.error(' -', falla)
  process.exit(1)
}

console.log('Aislamiento OK: cada negocio ve sólo lo suyo, no puede escribir en otro, y sin sesión no se ve nada.')
console.log(`(quedaron 2 negocios de prueba con el sufijo ${sufijo}; se limpian con scripts/limpiar-pruebas.sql)`)
