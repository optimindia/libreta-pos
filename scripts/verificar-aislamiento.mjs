/**
 * Comprueba la superficie pública y, si se pasan dos sesiones de auditoría,
 * el aislamiento entre negocios sin crear usuarios ni datos de prueba.
 *
 *   node scripts/verificar-aislamiento.mjs
 *
 * Para la prueba autenticada opcional:
 *   AUDITORIA_TOKEN_UNO=... AUDITORIA_NEGOCIO_UNO=... \
 *   AUDITORIA_TOKEN_DOS=... AUDITORIA_NEGOCIO_DOS=... \
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

async function pedir(ruta, token) {
  const respuesta = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    headers: { apikey: ANON, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  let cuerpo = null
  try { cuerpo = await respuesta.json() } catch { /* respuesta vacía */ }
  return { respuesta, cuerpo }
}

const fallas = []

const anonimo = await pedir('productos?select=nombre', null)
if (anonimo.respuesta.status !== 401 && anonimo.respuesta.status !== 403) {
  fallas.push(`productos sin sesión respondió HTTP ${anonimo.respuesta.status}`)
}
const configuracionAnonima = await pedir('negocio_configuracion?select=negocio_id', null)
if (configuracionAnonima.respuesta.status !== 401 && configuracionAnonima.respuesta.status !== 403) {
  fallas.push(`preferencias sin sesión respondieron HTTP ${configuracionAnonima.respuesta.status}`)
}

const rpcPublico = await fetch(`${URL_BASE}/rest/v1/rpc/crear_mi_negocio`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_nombre: 'No debe crearse' }),
})
if (rpcPublico.ok || rpcPublico.status < 400) {
  fallas.push(`el RPC de alta respondió HTTP ${rpcPublico.status}`)
}

const tokenUno = process.env.AUDITORIA_TOKEN_UNO
const tokenDos = process.env.AUDITORIA_TOKEN_DOS
const negocioUno = process.env.AUDITORIA_NEGOCIO_UNO
const negocioDos = process.env.AUDITORIA_NEGOCIO_DOS
if (tokenUno && tokenDos && negocioUno && negocioDos) {
  for (const tabla of ['productos', 'negocio_configuracion']) {
    const propiosUno = await pedir(`${tabla}?select=negocio_id&negocio_id=eq.${encodeURIComponent(negocioUno)}`, tokenUno)
    const propiosDos = await pedir(`${tabla}?select=negocio_id&negocio_id=eq.${encodeURIComponent(negocioDos)}`, tokenDos)
    for (const [nombre, resultado, negocio] of [['uno', propiosUno, negocioUno], ['dos', propiosDos, negocioDos]]) {
      if (!resultado.respuesta.ok || !Array.isArray(resultado.cuerpo)) {
        fallas.push(`la sesión ${nombre} no pudo leer su propia consulta en ${tabla}`)
      } else if (resultado.cuerpo.some((fila) => fila.negocio_id !== negocio)) {
        fallas.push(`la sesión ${nombre} recibió una fila de otro negocio en ${tabla}`)
      }
    }

    const cruzadoUno = await pedir(`${tabla}?select=negocio_id&negocio_id=eq.${encodeURIComponent(negocioDos)}`, tokenUno)
    const cruzadoDos = await pedir(`${tabla}?select=negocio_id&negocio_id=eq.${encodeURIComponent(negocioUno)}`, tokenDos)
    for (const [nombre, resultado] of [['uno', cruzadoUno], ['dos', cruzadoDos]]) {
      if (resultado.respuesta.ok && Array.isArray(resultado.cuerpo) && resultado.cuerpo.length > 0) {
        fallas.push(`la sesión ${nombre} vio filas del otro negocio en ${tabla}`)
      }
    }
  }
}

if (fallas.length > 0) {
  console.error('AISLAMIENTO ROTO:')
  for (const falla of fallas) console.error(' -', falla)
  process.exit(1)
}

console.log('Aislamiento OK: la superficie pública está cerrada y no se crean datos de prueba.')
if (!(tokenUno && tokenDos && negocioUno && negocioDos)) {
  console.log('Prueba autenticada omitida: pasá dos tokens y UUIDs de negocio para verificar el cruce entre tenants.')
}
