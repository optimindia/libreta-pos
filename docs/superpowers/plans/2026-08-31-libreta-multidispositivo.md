# Multi-dispositivo realtime y ticket por WhatsApp — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un aparato nuevo entre con teléfono + PIN y baje todo el negocio, que lo vendido en un aparato aparezca en el otro en segundos vía Realtime, y mandar el ticket de la venta por WhatsApp tras cobrar.

**Architecture:** Tres capas: bajada completa al entrar (la existente `bajarTodo`), bajada incremental con cursor del reloj del servidor (`bajarCambios` en un nuevo `bajada.ts`), y Realtime como disparador (aviso → debounced → bajada). `entrar()` se separa de `crearRespaldo` en `sesion.ts`. El ticket es una función más de `dominio/mensajes.ts`. La base gana `actualizado_en` + trigger + publicación realtime por migración idempotente. Arreglo incluido: la venta no encolaba el stock tocado — sin eso, el multi-dispositivo se desincroniza.

**Tech Stack:** Next.js 16, Dexie (IndexedDB), supabase-js 2.112 (postgres_changes), Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-libreta-multidispositivo-design.md`

## Global Constraints

- Todo importe es un entero en centavos: `$4.200` se guarda `420000`. Nunca float.
- `src/dominio/` no importa nada de `datos/` ni de `ui/`.
- Los ids se generan con `nuevoId()` de `src/dominio/id.ts`; nunca `crypto.randomUUID` directo (no existe servido por IP).
- Sin emojis como íconos, sin confetti, sin degradados. Usar los tokens de `src/ui/sistema/tokens.css` (`--tenue`, `--chip-fondo`, `--hueso-2`, `--linea`, `--verde`, `--ambar`).
- Mensajes de WhatsApp: texto corrido con *negrita*, NUNCA tablas.
- Hora siempre en formato 24h (21:45, no 9:45 PM).
- Pruebas: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build` **antes** de `npm run test:e2e` (next start sirve el último build), `npm run verificar:aislamiento` contra la base real cada vez que se toca una política.
- Los e2e corren en el puerto 3100 con la build del VPS, que tiene la nube activa: los tests NUNCA deben crear cuentas ni tocar la base real.
- El cursor de bajada se compara contra el reloj del servidor, nunca contra `Date.now()` del teléfono.

## Estado inicial esperado

Rama `main` limpia en `/root/libreta-pos`, con el spec commiteado (`e2db274`). `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto Supabase `Libreta` (`wfouklntgkjzcqtmwuou`).

---

### Task 1: Migración SQL — `actualizado_en` en las 6 tablas, trigger y publicación realtime

**Files:**
- Create: `scripts/migracion-multidispositivo.sql`

**Interfaces:**
- Consumes: nada.
- Produces: la base con `actualizado_en` en `ventas`, `clientes`, `fiados`, `fiado_pagos`, `ingresos`, `cierres`; trigger `marca_actualizado` en las 7 tablas sincronizadas; las 7 tablas en la publicación `supabase_realtime` con `REPLICA IDENTITY FULL`. Las Tasks 6, 7 y 12 dependen de que esta migración esté aplicada.

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- Migración de multi-dispositivo. Idempotente: se puede ejecutar muchas veces.
-- Ejecutar en el editor SQL del proyecto Supabase "Libreta" (wfouklntgkjzcqtmwuou).
-- Después correr: npm run verificar:aislamiento

-- 1) La marca de actualización: sólo productos la tenía. El cursor de la
--    bajada incremental la necesita en cada tabla sincronizada.
alter table ventas       add column if not exists actualizado_en timestamptz not null default now();
alter table clientes     add column if not exists actualizado_en timestamptz not null default now();
alter table fiados       add column if not exists actualizado_en timestamptz not null default now();
alter table fiado_pagos  add column if not exists actualizado_en timestamptz not null default now();
alter table ingresos     add column if not exists actualizado_en timestamptz not null default now();
alter table cierres      add column if not exists actualizado_en timestamptz not null default now();
-- venta_items e ingreso_items no: bajan siempre junto a su cabecera.
-- ventas_resumen no se sincroniza.

-- 2) Un solo reloj: el del servidor. El cliente deja de mandar su propia
--    marca; en INSERT aplica el default y en UPDATE este trigger.
create or replace function marca_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','ventas','clientes','fiados','fiado_pagos','ingresos','cierres'
  ] loop
    execute format('drop trigger if exists marca_actualizado on %I', tabla);
    execute format(
      'create trigger marca_actualizado before update on %I
         for each row execute function marca_actualizado()', tabla);
  end loop;
end $$;

-- 3) Realtime: emitir cambios de las tablas del negocio. REPLICA IDENTITY
--    FULL es lo que hace que el evento llegue con la fila completa y que
--    el RLS pueda filtrar qué se le envía a cada usuario.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','ventas','clientes','fiados','fiado_pagos','ingresos','cierres'
  ] loop
    execute format('alter publication supabase_realtime add table %I', tabla);
    execute format('alter table %I replica identity full', tabla);
  end loop;
end $$;
```

- [ ] **Step 2: Verificar que la sintaxis es SQL válido a simple vista**

No hay linter local de Postgres; la validación real es aplicarla (Task 12). Revisar a mano: los tres bloques `do $$` cierran con `end $$;`, cada `format` tiene su par de comillas, y no hay `create or replace trigger` (que no existe en Postgres: por eso el patrón drop + create).

- [ ] **Step 3: Commit**

```bash
git add scripts/migracion-multidispositivo.sql
git commit -m "feat: migración de multi-dispositivo (marca de tiempo, trigger, realtime)"
```

---

### Task 2: `mensajeTicket` — el texto del ticket en el dominio

**Files:**
- Modify: `src/dominio/mensajes.ts`
- Test: `tests/dominio/mensajes.test.ts`

**Interfaces:**
- Consumes: `formatearPesos` de `dominio/dinero.ts` (ya importado en el archivo), tipos `Negocio` y `Venta` de `dominio/tipos.ts`.
- Produces: `mensajeTicket(negocio: Negocio, venta: Venta): string` — la Task 10 la usa para armar el link de WhatsApp.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `tests/dominio/mensajes.test.ts`:

```ts
import { mensajeTicket } from '@/dominio/mensajes'
import type { Negocio, Venta } from '@/dominio/tipos'

const negocio: Negocio = {
  id: 'unico', nombre: 'Almacén Don José', logo: null, color: null,
}

const venta: Venta = {
  id: 'v1',
  fecha: new Date(2026, 7, 31, 21, 45).getTime(),
  total: 620000,
  medioPago: 'efectivo',
  items: [
    { productoId: 'p1', nombre: 'Coca 2L', cantidad: 2, precio: 250000, costo: 180000 },
    { productoId: 'p2', nombre: 'Pan', cantidad: 1, precio: 120000, costo: 60000 },
  ],
  clienteId: null,
}

describe('mensajeTicket', () => {
  it('arma el ticket con negocio, items, total y fecha', () => {
    const texto = mensajeTicket(negocio, venta)
    expect(texto).toContain('*Almacén Don José*')
    expect(texto).toContain('2 x Coca 2L — $5.000')
    expect(texto).toContain('1 x Pan — $1.200')
    expect(texto).toContain('*Total: $6.200*')
    expect(texto).toContain('21:45 — 31/08/2026')
    expect(texto).toContain('¡Gracias por tu compra!')
  })

  it('es texto corrido: no hay caracteres de tabla', () => {
    const texto = mensajeTicket(negocio, venta)
    expect(texto).not.toMatch(/[|]/)
    expect(texto).not.toMatch(/\t/)
  })

  it('una venta fiada avisa que quedó en la libreta', () => {
    const fiado = { ...venta, medioPago: 'fiado' as const }
    expect(mensajeTicket(negocio, fiado)).toContain('Quedó en la libreta: $6.200')
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run tests/dominio/mensajes.test.ts`
Expected: FAIL — `mensajeTicket` no existe.

- [ ] **Step 3: Implementar en `src/dominio/mensajes.ts`**

Agregar al final del archivo (y `Venta` al import de tipos, que hoy sólo trae `Centavos, Cliente`):

```ts
import type { Centavos, Cliente, Negocio, Venta } from './tipos'

/** Hora 24h y fecha legible, sin depender del locale del sistema. */
function fechaLegible(epoch: number): string {
  const d = new Date(epoch)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} — ${dia}/${mes}/${d.getFullYear()}`
}

/** El ticket de una venta, listo para mandar por WhatsApp. */
export function mensajeTicket(negocio: Negocio, venta: Venta): string {
  const lineas = venta.items.map(
    (item) => `${item.cantidad} x ${item.nombre} — ${formatearPesos(item.precio * item.cantidad)}`,
  )
  const partes = [
    `*${negocio.nombre}*`,
    'Ticket de compra',
    '',
    ...lineas,
    '',
    `*Total: ${formatearPesos(venta.total)}*`,
    fechaLegible(venta.fecha),
  ]
  if (venta.medioPago === 'fiado') {
    partes.push('', `Quedó en la libreta: ${formatearPesos(venta.total)}`)
  }
  partes.push('', '¡Gracias por tu compra!')
  return partes.join('\n')
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run tests/dominio/mensajes.test.ts`
Expected: PASS (los tests nuevos y los viejos de `mensajeCierre`/`mensajeCobro`).

- [ ] **Step 5: Commit**

```bash
git add src/dominio/mensajes.ts tests/dominio/mensajes.test.ts
git commit -m "feat: mensaje de ticket de venta para WhatsApp"
```

---

### Task 3: La venta encola el stock tocado (bug que rompe el multi-dispositivo)

**Files:**
- Modify: `src/datos/local/repos.ts:44-71` (`ventas.registrar`)
- Test: `tests/datos/repos.test.ts`

**Interfaces:**
- Consumes: `encolar` de `cola.ts` (ya importado), `pendientes` para el test.
- Produces: tras `ventas.registrar`, la cola tiene una entrada `producto:<id>` con operacion `actualizar` y el stock descontado. La subida existente (`subirASupabase` + upsert) ya sabe llevarla a la nube; sin este fix el stock de la venta nunca llega al otro aparato.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/datos/repos.test.ts` (el archivo ya importa `db` y usa `fake-indexeddb/auto` + el patrón `beforeEach` con `db.delete()`; agregar el import de `pendientes`):

```ts
import { pendientes } from '@/datos/local/cola'

it('una venta encola los productos con el stock descontado', async () => {
  await repos.productos.guardar({
    codigoBarras: null, nombre: 'Yerba', costo: 300000, precio: 420000,
    stock: 5, stockMinimo: 2,
  })
  const producto = (await repos.productos.todos())[0]

  await repos.ventas.registrar({
    items: [{ productoId: producto.id, nombre: 'Yerba', cantidad: 2, precio: 420000, costo: 300000 }],
    medioPago: 'efectivo',
    clienteId: null,
  })

  const cola = await pendientes()
  const delProducto = cola.find((item) => item.entidad === 'producto' && item.operacion === 'actualizar')
  expect(delProducto).toBeDefined()
  expect((delProducto!.datos as { stock: number }).stock).toBe(3)

  const guardado = await db.productos.get(producto.id)
  expect(guardado!.stock).toBe(3)
})
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run tests/datos/repos.test.ts`
Expected: FAIL — `delProducto` es `undefined`: la venta no encola el producto.

- [ ] **Step 3: Implementar en `repos.ventas.registrar`**

Reemplazar el cuerpo de la transacción en `src/datos/local/repos.ts` (líneas ~50-70). El truco: `encolar` escribe en `db.cola`, así que la transacción tiene que incluir esa tabla o el encolado va después. Se acumulan los productos tocados adentro y se encolan afuera:

```ts
      const tocados: Producto[] = []
      await db.transaction('rw', db.ventas, db.productos, async () => {
        await db.ventas.add(venta)
        for (const item of venta.items) {
          const producto = await db.productos.get(item.productoId)
          if (producto) {
            const descontado = { ...producto, stock: producto.stock - item.cantidad, actualizadoEn: Date.now() }
            await db.productos.put(descontado)
            tocados.push(descontado)
          }
        }
      })
      // El stock tocado también viaja a la nube: si no, el otro aparato
      // nunca se entera de lo que vendió éste.
      for (const producto of tocados) {
        await encolar('producto', 'actualizar', producto)
      }
      await encolar('venta', 'crear', venta)
      return venta
```

(El `Producto` del tipo hace falta en el import de tipos de `repos.ts`, si no está ya.)

- [ ] **Step 4: Correr los tests del paquete datos**

Run: `npx vitest run tests/datos/`
Expected: PASS — el test nuevo y todos los existentes (el update anterior se cambia por put con `actualizadoEn` fresco, que el resto de los tests no mide).

- [ ] **Step 5: Commit**

```bash
git add src/datos/local/repos.ts tests/datos/repos.test.ts
git commit -m "fix: la venta encola el stock descontado, sin eso el otro aparato nunca lo ve"
```

---

### Task 4: `entrar()` — iniciar sesión en un aparato nuevo

**Files:**
- Modify: `src/datos/nube/sesion.ts`
- Test: `tests/datos/sesion.test.ts`

**Interfaces:**
- Consumes: `credencialesDesdeTelefono` (en el mismo archivo), `cliente` de `datos/nube/cliente.ts`, `db` de `datos/local/db`.
- Produces: `entrar(telefono: string, pin: string): Promise<{ ok: true; negocioId: UUID } | { ok: false; motivo: string }>` — la Task 8 (UI de entrada) la llama y después hace `bajarTodo`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/datos/sesion.test.ts`. El mock reemplaza el módulo del cliente con un objeto que responde como supabase-js; `fake-indexeddb/auto` ya está disponible como dependencia:

```ts
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { entrar } from '@/datos/nube/sesion'
import { db } from '@/datos/local/db'

const mockSignIn = vi.fn()
const mockVinculo = vi.fn()

vi.mock('@/datos/nube/cliente', () => ({
  cliente: {
    auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mockVinculo() }),
      }),
    }),
  },
  nubeActiva: () => true,
}))

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete()
  await db.open()
})

describe('entrar', () => {
  it('inicia sesión y guarda el negocio vinculado localmente', async () => {
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: { negocio_id: 'nube-1' } })

    const resultado = await entrar('2615551234', '123456')

    expect(resultado).toEqual({ ok: true, negocioId: 'nube-1' })
    const local = await db.negocio.get('unico')
    expect(local?.negocioId).toBe('nube-1')
    expect(local?.telefono).toBe('542615551234')
  })

  it('con teléfono o PIN equivocados devuelve el motivo claro', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' }, data: {} })
    const resultado = await entrar('2615551234', '000111')
    expect(resultado).toEqual({ ok: false, motivo: 'ese teléfono y PIN no coinciden con ningún negocio' })
  })

  it('con una cuenta sin negocio no inventa nada', async () => {
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: 'u1' } } })
    mockVinculo.mockResolvedValue({ data: null })
    const resultado = await entrar('2615551234', '123456')
    expect(resultado).toEqual({ ok: false, motivo: 'esa cuenta no tiene un negocio asociado' })
  })
})
```

- [ ] **Step 2: Correrlos y verificar que fallan**

Run: `npx vitest run tests/datos/sesion.test.ts`
Expected: FAIL — `entrar` no existe (error de import).

- [ ] **Step 3: Implementar en `src/datos/nube/sesion.ts`**

Extraer la lectura del vínculo (hoy embebida en `crearRespaldo`) y agregar `entrar`. `crearRespaldo` pasa a usar la misma función auxiliar en su camino "ya vinculado":

```ts
/** Lee el vínculo usuario→negocio en la nube y, si existe, lo guarda
 *  localmente. Devuelve el negocioId o null. */
async function vincularNegocioLocal(
  usuarioId: string,
  telefono: string,
): Promise<UUID | null> {
  if (!cliente) return null
  const vinculo = await cliente
    .from('usuarios_negocio')
    .select('negocio_id')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!vinculo.data?.negocio_id) return null
  const negocioId = vinculo.data.negocio_id as UUID
  await guardarNegocioLocal(negocioId, telefono)
  return negocioId
}

/** Entrar en un aparato nuevo con el teléfono y el PIN del dueño.
 *  No crea nada: sólo trae el negocio que ya tiene en la nube. */
export async function entrar(
  telefono: string,
  pin: string,
): Promise<{ ok: true; negocioId: UUID } | { ok: false; motivo: string }> {
  if (!cliente) return { ok: false, motivo: 'la nube no está configurada' }

  const ingreso = await cliente.auth.signInWithPassword(
    credencialesDesdeTelefono(telefono, pin),
  )
  if (ingreso.error) {
    return { ok: false, motivo: 'ese teléfono y PIN no coinciden con ningún negocio' }
  }
  const usuarioId = ingreso.data.user?.id
  if (!usuarioId) return { ok: false, motivo: 'no se pudo iniciar sesión' }

  const negocioId = await vincularNegocioLocal(usuarioId, telefono)
  if (!negocioId) return { ok: false, motivo: 'esa cuenta no tiene un negocio asociado' }
  return { ok: true, negocioId }
}
```

Y en `crearRespaldo`, reemplazar el bloque `const yaVinculado = await cliente.from('usuarios_negocio')...` (líneas ~66-76) por:

```ts
  const yaVinculado = await vincularNegocioLocal(usuarioId, telefono)
  if (yaVinculado) return { ok: true, negocioId: yaVinculado }
```

- [ ] **Step 4: Correr todos los tests de sesión**

Run: `npx vitest run tests/datos/sesion.test.ts`
Expected: PASS — los 3 tests nuevos de `entrar` y los existentes de credenciales/PIN.

- [ ] **Step 5: Commit**

```bash
git add src/datos/nube/sesion.ts tests/datos/sesion.test.ts
git commit -m "feat: entrar con teléfono y PIN en un aparato nuevo"
```

---

### Task 5: El mapeo deja de mandar `actualizadoEn`

**Files:**
- Modify: `src/datos/nube/mapeo.ts` (en `aFilaPlana`)
- Test: `tests/datos/mapeo.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: las filas subidas sin `actualizado_en` — la base la marca sola (default en INSERT, trigger en UPDATE de la migración de la Task 1). `deLaNube` sigue traduciendo `actualizado_en` hacia el cliente: eso lo usan `bajarTodo` y `bajarCambios` (Task 6).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/datos/mapeo.test.ts`:

```ts
it('la subida no manda actualizado_en: la marca la pone la base', () => {
  const producto = {
    id: 'p1', codigoBarras: null, nombre: 'Yerba',
    costo: 300000, precio: 420000, stock: 5, stockMinimo: 2,
    actualizadoEn: 123456789,
  }
  const partes = aLaNube('producto', producto, 'neg-1')
  expect(partes[0].filas[0]).not.toHaveProperty('actualizado_en')
})
```

(El import de `aLaNube` ya existe en ese archivo; si no, agregarlo.)

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run tests/datos/mapeo.test.ts`
Expected: FAIL — la fila SÍ tiene `actualizado_en`.

- [ ] **Step 3: Implementar**

En `aFilaPlanar` (`src/datos/nube/mapeo.ts:35-46`), saltar la clave:

```ts
function aFilaPlana(datos: Fila, negocioId: UUID): Fila {
  const fila: Fila = { negocio_id: negocioId }
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'items' || clave === 'actualizadoEn') continue
    const nombre = CAMPOS[clave] ?? clave
    fila[nombre] =
      FECHAS.has(nombre) && typeof valor === 'number'
        ? new Date(valor).toISOString()
        : valor
  }
  return fila
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/datos/mapeo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/datos/nube/mapeo.ts tests/datos/mapeo.test.ts
git commit -m "feat: la marca de actualización la pone el reloj del servidor"
```

---

### Task 6: Bajada incremental — `bajarCambios` con cursor y merge

**Files:**
- Modify: `src/datos/nube/sincronizar.ts` (exportar `DESTINO` y extraer el rearme de items)
- Modify: `src/dominio/tipos.ts` (`Negocio` gana `ultimaBajada?: number`)
- Create: `src/datos/nube/bajada.ts`
- Test: `tests/datos/bajada.test.ts`

**Interfaces:**
- Consumes: `deLaNube` de `mapeo.ts`, `db` de `datos/local/db`, `cliente` de `cliente.ts`, `DESTINO` de `sincronizar.ts`.
- Produces (Task 7 y 8 consumen todo esto):
  - `type TraerCambiosFn = (tabla: string, desdeISO: string) => Promise<unknown[]>`
  - `bajarCambios(traer: TraerCambiosFn): Promise<number>` — escribe en la base local con merge más-nuevo-gana en productos y avanza el cursor si ninguna tabla falló.
  - `traerCambiosDeSupabase: TraerCambiosFn` — la versión real contra Supabase.

- [ ] **Step 1: Exportar `DESTINO` y el rearme de items desde `sincronizar.ts`**

En `src/datos/nube/sincronizar.ts`:

1. Cambiar `const DESTINO` (línea 47) por `export const DESTINO` (mismo contenido).
2. Extraer el rearme de items que hoy vive adentro de `traerDeSupabase` (líneas 81-103) a una función exportada, para que la bajada incremental no duplique esa lógica:

```ts
/** Las ventas y los ingresos viven en la nube en dos tablas y la
 *  aplicación los usa juntas: los items se rearman con su cabecera. */
export function rearmarItems(
  tabla: 'ventas' | 'ingresos',
  cabeceras: Fila[],
  items: Fila[],
): unknown[] {
  const claveDelPadre = tabla === 'ventas' ? 'venta_id' : 'ingreso_id'
  return cabeceras.map((fila) => ({
    ...deLaNube(tabla, fila),
    items: items
      .filter((item) => item[claveDelPadre] === fila.id)
      .map((item) => {
        const local = deLaNube(`${tabla === 'ventas' ? 'venta' : 'ingreso'}_items`, item) as Fila
        delete local[claveDelPadre === 'venta_id' ? 'ventaId' : 'ingresoId']
        delete local.id
        return local
      }),
  }))
}
```

Y `traerDeSupabase` pasa a usarla:

```ts
export const traerDeSupabase: TraerFn = async (tabla) => {
  if (!cliente) throw new Error('nube apagada')

  if (tabla === 'ventas' || tabla === 'ingresos') {
    const tablaItems = tabla === 'ventas' ? 'venta_items' : 'ingreso_items'
    const claveDelPadre = tabla === 'ventas' ? 'venta_id' : 'ingreso_id'
    const [cabeceras, items] = await Promise.all([
      cliente.from(tabla).select('*'),
      cliente.from(tablaItems).select('*'),
    ])
    if (cabeceras.error) throw cabeceras.error
    if (items.error) throw items.error
    return rearmarItems(tabla, cabeceras.data ?? [], items.data ?? [])
  }

  const { data, error } = await cliente.from(tabla).select('*')
  if (error) throw error
  return (data ?? []).map((fila) => deLaNube(tabla, fila as Fila))
}
```

(El tipo de `rearmarItems` usa `Fila`, ya importado en el archivo.)

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/datos/bajada.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/datos/local/db'
import { bajarCambios, type TraerCambiosFn } from '@/datos/nube/bajada'

const ahora = Date.now()

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('bajarCambios', () => {
  // OJO con estos tests: el `desde` se captura en una variable y se
  // afirma DESPUÉS de la llamada. Un expect adentro del mock que fallara
  // se convertiría en un rechazo de promesa... y bajarCambios se lo
  // traga en su catch: el test pasaría sin haber verificado nada.
  it('baja lo nuevo y avanza el cursor a la marca del servidor', async () => {
    const visto: string[] = []
    const traer = (async (tabla: string, desde: string) => {
      visto.push(desde)
      if (tabla !== 'productos') return []
      return [
        { id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
          stock: 5, stockMinimo: 2, actualizadoEn: ahora },
      ]
    }) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    expect(await db.productos.count()).toBe(1)
    expect(visto[0]).toBe(new Date(0 - 30_000).toISOString())
    const negocio = await db.negocio.get('unico')
    expect(negocio?.ultimaBajada).toBe(ahora)
  })

  it('pide sólo desde el cursor menos el solape en la segunda vuelta', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 1000 })
    const visto: string[] = []
    const traer = (async (_tabla: string, desde: string) => {
      visto.push(desde)
      return []
    }) as unknown as TraerCambiosFn
    await bajarCambios(traer)
    expect(visto[0]).toBe(new Date(1000 - 30_000).toISOString())
  })

  it('no pisa un producto con edición local más nueva que la fila que baja', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba editada', costo: 300, precio: 420,
      stock: 9, stockMinimo: 2, actualizadoEn: ahora,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'productos'
        ? [{
            id: 'p1', codigoBarras: null, nombre: 'Yerba vieja de la nube', costo: 300, precio: 420,
            stock: 1, stockMinimo: 2, actualizadoEn: ahora - 60_000,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const local = await db.productos.get('p1')
    expect(local?.nombre).toBe('Yerba editada')
    expect(local?.stock).toBe(9)
  })

  it('pisa el producto local cuando la fila que baja es más nueva', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    await db.productos.put({
      id: 'p1', codigoBarras: null, nombre: 'Yerba vieja', costo: 300, precio: 420,
      stock: 1, stockMinimo: 2, actualizadoEn: ahora - 60_000,
    })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'productos'
        ? [{
            id: 'p1', codigoBarras: null, nombre: 'Yerba nueva', costo: 300, precio: 500,
            stock: 7, stockMinimo: 2, actualizadoEn: ahora,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const local = await db.productos.get('p1')
    expect(local?.nombre).toBe('Yerba nueva')
    expect(local?.stock).toBe(7)
  })

  it('la venta baja con sus items rearmados', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 0 })
    const traer = vi.fn(async (tabla: string) =>
      tabla === 'ventas'
        ? [{
            id: 'v1', fecha: ahora, total: 840, medioPago: 'efectivo', clienteId: null,
            items: [{ productoId: 'p1', nombre: 'Yerba', cantidad: 2, precio: 420, costo: 300 }],
            actualizadoEn: ahora,
          }]
        : [],
    ) as unknown as TraerCambiosFn

    await bajarCambios(traer)
    const venta = await db.ventas.get('v1')
    expect(venta?.items).toHaveLength(1)
    expect(venta?.total).toBe(840)
  })

  it('si una tabla falla, las demás bajan igual y el cursor no avanza', async () => {
    await db.negocio.put({ id: 'unico', nombre: 'Almacén', logo: null, color: null, ultimaBajada: 500 })
    const traer = (async (tabla: string) => {
      if (tabla === 'ventas') throw new Error('sin red')
      if (tabla !== 'productos') return []
      return [{
        id: 'p1', codigoBarras: null, nombre: 'Yerba', costo: 300, precio: 420,
        stock: 5, stockMinimo: 2, actualizadoEn: ahora,
      }]
    }) as unknown as TraerCambiosFn

    expect(await bajarCambios(traer)).toBe(1)
    const negocio = await db.negocio.get('unico')
    expect(negocio?.ultimaBajada).toBe(500)
  })

  it('sin fila de negocio local no hace nada', async () => {
    const traer = vi.fn() as unknown as TraerCambiosFn
    expect(await bajarCambios(traer)).toBe(0)
    expect(traer).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Correrlos y verificar que fallan**

Run: `npx vitest run tests/datos/bajada.test.ts`
Expected: FAIL — `@/datos/nube/bajada` no existe.

- [ ] **Step 4: Implementar `src/datos/nube/bajada.ts`**

```ts
import { db } from '@/datos/local/db'
import { cliente } from './cliente'
import { deLaNube, type Fila } from './mapeo'
import { DESTINO, rearmarItems } from './sincronizar'

/** El solape reprocesa lo último bajado: el merge por id es idempotente
 *  y así las transacciones que llegan apenas antes del cursor no se pierden. */
const SOLAPE_MS = 30_000

export type TraerCambiosFn = (tabla: string, desdeISO: string) => Promise<unknown[]>

/** Trae de Supabase sólo lo cambiado desde la marca. El reloj es el del
 *  servidor: actualizado_en lo marcan la base y el trigger, nunca el cliente. */
export const traerCambiosDeSupabase: TraerCambiosFn = async (tabla, desdeISO) => {
  if (!cliente) throw new Error('nube apagada')

  if (tabla === 'ventas' || tabla === 'ingresos') {
    const tablaItems = tabla === 'ventas' ? 'venta_items' : 'ingreso_items'
    const claveDelPadre = tabla === 'ventas' ? 'venta_id' : 'ingreso_id'
    const cabeceras = await cliente.from(tabla).select('*').gte('actualizado_en', desdeISO)
    if (cabeceras.error) throw cabeceras.error
    const ids = (cabeceras.data ?? []).map((fila: Fila) => fila.id)
    if (ids.length === 0) return []
    const items = await cliente.from(tablaItems).select('*').in(claveDelPadre, ids)
    if (items.error) throw items.error
    return rearmarItems(tabla, cabeceras.data ?? [], items.data ?? [])
  }

  const { data, error } = await cliente
    .from(tabla)
    .select('*')
    .gte('actualizado_en', desdeISO)
  if (error) throw error
  return (data ?? []).map((fila) => deLaNube(tabla, fila as Fila))
}

/** El merge: en productos gana el más nuevo, para que una edición local
 *  todavía sin subir nunca la pise una bajada. El resto es append por id:
 *  si ya existía, es la misma fila. */
async function escribir(tabla: string, fila: Fila): Promise<boolean> {
  if (tabla === 'productos') {
    const local = await db.productos.get(fila.id as string)
    const nueva = fila.actualizadoEn as number
    if (local && local.actualizadoEn > nueva) return false
  }
  const destino = DESTINO[tabla]
  await destino().put(fila)
  return true
}

/** Baja lo que cambió en la nube desde la última vez. Devuelve las filas
 *  escritas. La marca del cursor sale de las mismas filas que bajan —
 *  nunca de una segunda vuelta de pedidos. Si alguna tabla falla, el
 *  cursor no avanza: la próxima vuelta repite desde la marca vieja,
 *  y el merge lo hace inofensivo. */
export async function bajarCambios(traer: TraerCambiosFn): Promise<number> {
  const negocio = await db.negocio.get('unico')
  if (!negocio) return 0

  const cursor = negocio.ultimaBajada ?? 0
  const desde = new Date(cursor - SOLAPE_MS).toISOString()

  let escritas = 0
  let maximo = cursor
  let fallo = false

  for (const tabla of Object.keys(DESTINO)) {
    try {
      const filas = (await traer(tabla, desde)) as Fila[]
      for (const fila of filas) {
        const marca = (fila.actualizadoEn as number | undefined) ?? 0
        if (marca > maximo) maximo = marca
        if (await escribir(tabla, fila)) escritas++
      }
    } catch {
      fallo = true // se sigue con la próxima tabla: bajar algo es mejor que nada
    }
  }

  if (!fallo && maximo > cursor) {
    await db.negocio.update('unico', { ultimaBajada: maximo })
  }
  return escritas
}
```

- [ ] **Step 5: `Negocio` gana el campo del cursor en `src/dominio/tipos.ts`**

```ts
export interface Negocio {
  id: UUID
  nombre: string
  logo: string | null
  color: string | null
  /** Id en la nube; ausente mientras el negocio viva sólo en el teléfono. */
  negocioId?: UUID
  telefono?: string
  /** Marca de la última bajada incremental; el reloj es el del servidor. */
  ultimaBajada?: number
}
```

- [ ] **Step 6: Correr todos los tests de datos**

Run: `npx vitest run tests/datos/`
Expected: PASS — los 7 de bajada, y los de `sincronizar` (que siguen probando `traerDeSupabase`/`bajarTodo` con el refactor del rearme).

- [ ] **Step 7: Commit**

```bash
git add src/datos/nube/bajada.ts src/datos/nube/sincronizar.ts src/dominio/tipos.ts tests/datos/bajada.test.ts
git commit -m "feat: bajada incremental con cursor del servidor y merge más-nuevo-gana"
```

---

### Task 7: Realtime — el aviso de que cambió algo

**Files:**
- Create: `src/datos/nube/realtime.ts`
- Test: `tests/datos/realtime.test.ts`

**Interfaces:**
- Consumes: `cliente` de `datos/nube/cliente.ts`.
- Produces: `escucharCambios(tablas: string[], alCambiar: () => void): (() => void) | null` — devuelve la función de parada, o `null` si no hay nube. El Sincronizador (Task 8) la llama con las 7 tablas y un callback que dispara la bajada.

- [ ] **Step 1: Escribir el test**

Crear `tests/datos/realtime.test.ts`. Como el módulo recibe el canal de supabase-js, el test cubre el caso sin nube y el cableado básico con un canal falso:

```ts
import { describe, it, expect, vi } from 'vitest'
import { escucharCambios } from '@/datos/nube/realtime'

describe('escucharCambios', () => {
  it('sin nube configurada no suscribe nada y devuelve null', () => {
    expect(escucharCambios(['productos'], () => {})).toBeNull()
  })
})
```

(En el VPS hay `.env.local`, así que este test corre con `cliente === null` sólo si el import de `cliente.ts` queda sin las variables: vitest no carga `.env.local`. Si al correrlo el cliente resultara no-null, el test dirá `expected null, received function` — en ese caso verificar que vitest corre sin las variables de entorno.)

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run tests/datos/realtime.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `src/datos/nube/realtime.ts`**

```ts
import { cliente } from './cliente'

/** Suscribe los cambios de las tablas del negocio. El RLS aplica en
 *  Realtime: el canal sólo recibe los eventos de las filas que el usuario
 *  autenticado puede ver — es decir, las de su negocio.
 *
 *  El evento no trae los datos: es sólo el timbre. Quien escucha decide
 *  qué hacer (la bajada incremental trae lo nuevo completa y segura). */
export function escucharCambios(
  tablas: string[],
  alCambiar: () => void,
): (() => void) | null {
  if (!cliente) return null

  let canal = cliente.channel('libreta-cambios')
  for (const tabla of tablas) {
    canal = canal.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabla },
      () => alCambiar(),
    )
  }
  canal.subscribe()

  return () => {
    void canal.unsubscribe()
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/datos/realtime.test.ts && npx tsc --noEmit`
Expected: PASS y tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/datos/nube/realtime.ts tests/datos/realtime.test.ts
git commit -m "feat: suscripción realtime como timbre de bajada"
```

---

### Task 8: El Sincronizador sube, baja y escucha

**Files:**
- Modify: `src/ui/sistema/Sincronizador.tsx`

**Interfaces:**
- Consumes: `sincronizar` + `subirASupabase` de `sincronizar.ts`, `bajarCambios` + `traerCambiosDeSupabase` de `bajada.ts` (Task 6), `escucharCambios` de `realtime.ts` (Task 7), `negocioDeLaNube` de `sesion.ts`.
- Produces: el aparato sincronizado en ambos sentidos cada 30 s y en vivo al recibir un evento realtime. No tiene test unitario propio (es pegamento con timers de navegador); su red queda cubierta por el e2e offline de la venta y por la compilación.

- [ ] **Step 1: Implementar**

Reemplazar el cuerpo de `src/ui/sistema/Sincronizador.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { nubeActiva } from '@/datos/nube/cliente'
import { negocioDeLaNube } from '@/datos/nube/sesion'
import { sincronizar, subirASupabase } from '@/datos/nube/sincronizar'
import { bajarCambios, traerCambiosDeSupabase } from '@/datos/nube/bajada'
import { escucharCambios } from '@/datos/nube/realtime'

const CADA_MS = 30_000
/** El timbre realtime llega en ráfagas (una venta toca varias tablas):
 *  esperar dos segundos junta la ráfaga en una sola bajada. */
const DEBOUNCE_MS = 2_000
const TABLAS = ['productos', 'ventas', 'clientes', 'fiados', 'fiado_pagos', 'ingresos', 'cierres']

/** Sincroniza en los dos sentidos cuando hay red. Nunca bloquea la venta:
 *  si algo falla, el dato ya está en el teléfono y se reintenta solo. */
export function Sincronizador() {
  useEffect(() => {
    if (!nubeActiva()) return

    let vivo = true
    let bajandoPendiente: ReturnType<typeof setTimeout> | null = null

    async function intentar() {
      if (!vivo || !navigator.onLine) return
      const negocioId = await negocioDeLaNube()
      if (!negocioId) return // todavía sin respaldo: no hay a dónde subir
      try {
        await sincronizar(subirASupabase(negocioId))
        await bajarCambios(traerCambiosDeSupabase)
      } catch {
        // sin red o sin sesión: se reintenta solo
      }
    }

    /** El timbre realtime: bajar lo nuevo, con debounce para juntar la ráfaga. */
    function timbre() {
      if (bajandoPendiente) clearTimeout(bajandoPendiente)
      bajandoPendiente = setTimeout(() => {
        bajandoPendiente = null
        void intentar()
      }, DEBOUNCE_MS)
    }

    void intentar()
    const reloj = setInterval(intentar, CADA_MS)
    window.addEventListener('online', intentar)

    let pararEscucha: (() => void) | null = null
    void negocioDeLaNube().then((negocioId) => {
      if (!vivo || !negocioId) return
      pararEscucha = escucharCambios(TABLAS, timbre)
    })

    return () => {
      vivo = false
      clearInterval(reloj)
      window.removeEventListener('online', intentar)
      if (bajandoPendiente) clearTimeout(bajandoPendiente)
      pararEscucha?.()
    }
  }, [])

  return null
}
```

- [ ] **Step 2: Compilar y correr todos los tests unitarios**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errores de tsc, todos los tests en verde (213 + los nuevos ~15).

- [ ] **Step 3: Commit**

```bash
git add src/ui/sistema/Sincronizador.tsx
git commit -m "feat: el sincronizador sube, baja incremental y escucha realtime"
```

---

### Task 9: La puerta de entrada para el aparato nuevo

**Files:**
- Create: `src/ui/vender/Entrar.tsx`
- Modify: `src/ui/vender/PantallaVender.tsx`
- Test: `tests/e2e/entrar.spec.ts`

**Interfaces:**
- Consumes: `entrar` de `sesion.ts` (Task 4), `bajarTodo` + `traerDeSupabase` de `sincronizar.ts`, `nubeActiva` de `cliente.ts`, `db`, tokens de estilo.
- Produces: `Entrar` — el panel que reemplaza al catálogo vacío cuando la app no tiene nada y no hay negocio vinculado. `PantallaVender` lo muestra con `onListo` al terminar.

- [ ] **Step 1: Escribir el e2e que falla**

Crear `tests/e2e/entrar.spec.ts`. OJO: nunca crear cuentas reales — el test sólo verifica el panel y el camino "empezar de cero":

```ts
import { test, expect } from '@playwright/test'

test('la puerta de entrada aparece en un aparato vacío y se puede empezar de cero', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('¿Ya usás Libreta en otro aparato?')).toBeVisible()

  await page.getByRole('button', { name: /empezar de cero/i }).click()

  // al empezar de cero se muestra la pantalla normal de venta, sin la puerta
  await expect(page.getByText('¿Ya usás Libreta en otro aparato?')).toBeHidden()
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeVisible()
})
```

- [ ] **Step 2: Build y verificar que falla**

Run: `npm run build && npx playwright test tests/e2e/entrar.spec.ts`
Expected: FAIL — el texto no aparece (la puerta no existe).

- [ ] **Step 3: Implementar `src/ui/vender/Entrar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { entrar } from '@/datos/nube/sesion'
import { bajarTodo, traerDeSupabase } from '@/datos/nube/sincronizar'
import { Boton } from '@/ui/sistema/Boton'

const campo = {
  background: 'var(--hueso-2)',
  border: '1px solid var(--linea)',
  color: 'var(--tinta)',
}

/** La puerta de un aparato nuevo: o traés el negocio que ya está en la
 *  nube, o empezás uno nuevo acá. Sólo se muestra con la base vacía. */
export function Entrar({ onListo }: { onListo: () => void }) {
  const [telefono, setTelefono] = useState('')
  const [pin, setPin] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  async function traerMiNegocio() {
    setTrabajando(true)
    setAviso(null)
    const resultado = await entrar(telefono, pin)
    if (!resultado.ok) {
      setAviso(resultado.motivo)
      setTrabajando(false)
      return
    }
    await bajarTodo(traerDeSupabase)
    setTrabajando(false)
    onListo()
  }

  return (
    <div className="mt-6 rounded-xl px-3.5 py-3.5" style={{ background: 'var(--chip-fondo)' }}>
      <p className="text-[13px] font-semibold">¿Ya usás Libreta en otro aparato?</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
        Entrá con tu teléfono y el mismo PIN, y este aparato queda con todo tu negocio.
      </p>

      <input
        aria-label="Tu teléfono"
        inputMode="tel"
        placeholder="Tu teléfono (261...)"
        className="tabular mt-3 w-full rounded-xl px-3 py-2.5 text-[14px]"
        style={campo}
        value={telefono}
        onChange={(evento) => setTelefono(evento.target.value)}
      />
      <input
        aria-label="PIN de 6 números"
        inputMode="numeric"
        placeholder="PIN de 6 números"
        className="tabular mt-2 w-full rounded-xl px-3 py-2.5 text-[14px]"
        style={campo}
        value={pin}
        onChange={(evento) => setPin(evento.target.value)}
      />

      <Boton
        variante="principal"
        className="mt-3 w-full !py-3 !text-[13px]"
        disabled={trabajando}
        onClick={traerMiNegocio}
      >
        {trabajando ? 'Bajando tu negocio…' : 'Traer mi negocio'}
      </Boton>

      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ambar)' }}>{aviso}</p>
      )}

      <Boton
        variante="secundario"
        className="mt-2 w-full !py-3 !text-[13px]"
        onClick={onListo}
      >
        Empezar de cero acá
      </Boton>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--tenue)' }}>
        Si cargaste algo acá y traés tu negocio, las dos cosas quedan: no se borra nada.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Conectarla en `PantallaVender.tsx`**

Agregar al componente (con `useLiveQuery` ya importado):

```tsx
import { Entrar } from './Entrar'

// adentro de PantallaVender:
  const [deCero, setDeCero] = useState(false)
  const estado = useLiveQuery(async () => {
    const [productos, ventas, negocio] = await Promise.all([
      db.productos.count(),
      db.ventas.count(),
      db.negocio.get('unico'),
    ])
    return { productos, ventas, negocio }
  })
  const aparatoNuevo =
    !deCero &&
    estado &&
    estado.productos === 0 &&
    estado.ventas === 0 &&
    !estado.negocio?.negocioId &&
    nubeActiva()
```

y en el JSX, el bloque `Ticket` se envuelve:

```tsx
      {aparatoNuevo ? (
        <Entrar onListo={() => setDeCero(true)} />
      ) : (
        <Ticket
          items={items}
          onCambiarCantidad={(productoId, cantidad) =>
            setItems((actuales) => cambiarCantidad(actuales, productoId, cantidad))
          }
        />
      )}
```

con los imports de `db` y `nubeActiva`:

```tsx
import { db } from '@/datos/local/db'
import { nubeActiva } from '@/datos/nube/cliente'
```

- [ ] **Step 5: Build y e2e de la puerta**

Run: `npm run build && npx playwright test tests/e2e/entrar.spec.ts`
Expected: PASS.

- [ ] **Step 6: Correr los e2e completos**

Run: `npx playwright test`
Expected: PASS — los 3 existentes y el nuevo. (Los existentes cargan primero un producto en `/stock`, así que la puerta no aparece en su flujo.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/vender/Entrar.tsx src/ui/vender/PantallaVender.tsx tests/e2e/entrar.spec.ts
git commit -m "feat: puerta de entrada para vincular un aparato nuevo"
```

---

### Task 10: Panel "Cobrado" y ticket por WhatsApp

**Files:**
- Create: `src/ui/vender/Cobrado.tsx`
- Modify: `src/ui/vender/PantallaVender.tsx`
- Test: `tests/e2e/venta.spec.ts` (un test nuevo al final)

**Interfaces:**
- Consumes: `mensajeTicket` de `dominio/mensajes.ts` (Task 2), `enlaceWhatsApp` de `dominio/mensajes.ts`, `Importe` de `ui/sistema/Importe.tsx`, tipos `Negocio` y `Venta`.
- Produces: tras cobrar, el panel `Cobrado` con el link de WhatsApp; el flujo de venta termina mostrando el comprobante.

- [ ] **Step 1: Escribir el e2e que falla**

Agregar al final de `tests/e2e/venta.spec.ts`:

```ts
test('tras cobrar se puede mandar el ticket por WhatsApp', async ({ page }) => {
  await page.goto('/stock')
  await page.getByRole('button', { name: /^cargar$/i }).click()
  await page.getByLabel('Nombre').fill('Gaseosa')
  await page.getByLabel('Costo').fill('1000')
  await page.getByLabel('Precio').fill('1500')
  await page.getByRole('button', { name: /guardar producto/i }).click()
  await expect(page.getByText('Gaseosa', { exact: true })).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Gaseosa' }).click()
  await page.getByRole('button', { name: /^cobrar$/i }).click()
  await page.getByRole('button', { name: /efectivo/i }).click()
  await page.getByLabel(/con cuánto pagó/i).fill('2000')
  await page.getByRole('button', { name: /cobrar \$1\.500/i }).click()

  const cobrado = page.getByText('Cobrado')
  await expect(cobrado).toBeVisible()

  const link = page.getByRole('link', { name: /mandar el ticket por whatsapp/i })
  const href = await link.getAttribute('href')
  expect(href).toBeTruthy()
  expect(href!).toMatch(/^https:\/\/wa\.me\/\?text=/)
  expect(decodeURIComponent(href!)).toContain('*Total: $1.500*')

  await page.getByRole('button', { name: /nueva venta/i }).click()
  await expect(page.getByRole('button', { name: /^cobrar$/i })).toBeDisabled()
})
```

- [ ] **Step 2: Build y verificar que falla**

Run: `npm run build && npx playwright test tests/e2e/venta.spec.ts -g "ticket por WhatsApp"`
Expected: FAIL — no hay panel "Cobrado".

- [ ] **Step 3: Implementar `src/ui/vender/Cobrado.tsx`**

```tsx
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import type { Negocio, Venta } from '@/dominio/tipos'
import { enlaceWhatsApp, mensajeTicket } from '@/dominio/mensajes'
import { Importe } from '@/ui/sistema/Importe'
import { Boton } from '@/ui/sistema/Boton'

/** El cierre de la venta: el importe cobrado y el ticket a mano para
 *  mandarlo por WhatsApp. Si la venta lleva un cliente con teléfono,
 *  el link abre directo su chat; si no, el almacenero elige el chat. */
export function Cobrado({
  venta,
  negocio,
  onNueva,
}: {
  venta: Venta
  negocio: Negocio
  onNueva: () => void
}) {
  const cliente = useLiveQuery(
    async () => (venta.clienteId ? await db.clientes.get(venta.clienteId) : null),
    [],
  )
  const link = enlaceWhatsApp(cliente?.telefono ?? '', mensajeTicket(negocio, venta))

  return (
    <div
      className="mx-5 mt-3 rounded-xl px-4 py-4"
      style={{ background: 'var(--chip-fondo)' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>
          Cobrado
        </span>
        <Importe centavos={venta.total} tamaño="grande" className="!text-2xl" style={{ color: 'var(--verde)' }} />
      </div>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block"
      >
        <Boton variante="principal" className="w-full !py-3 !text-[13px]">
          Mandar el ticket por WhatsApp
        </Boton>
      </a>
      <Boton
        variante="secundario"
        className="mt-2 w-full !py-3 !text-[13px]"
        onClick={onNueva}
      >
        Nueva venta
      </Boton>
    </div>
  )
}
```

(`Importe` acepta `style` — verificado en `src/ui/sistema/Importe.tsx`.)

- [ ] **Step 4: Conectar en `PantallaVender.tsx`**

```tsx
import { Cobrado } from './Cobrado'
import type { Venta } from '@/dominio/tipos'

// estado:
  const [cobrada, setCobrada] = useState<Venta | null>(null)

// cobrar pasa a guardar la venta:
  async function cobrar(medio: MedioPago) {
    if (items.length === 0) return
    const venta = await repos.ventas.registrar({ items, medioPago: medio, clienteId: null })
    setItems([])
    setCobrando(false)
    setCobrada(venta)
  }

// JSX, después del botón Cobrar:
      {cobrada && estado?.negocio && (
        <Cobrado venta={cobrada} negocio={estado.negocio} onNueva={() => setCobrada(null)} />
      )}
```

(`estado` es el `useLiveQuery` de la Task 9, que ya trae el negocio.)

- [ ] **Step 5: Build, e2e completo y tests**

Run: `npm run build && npx playwright test && npm test`
Expected: todo PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/vender/Cobrado.tsx src/ui/vender/PantallaVender.tsx tests/e2e/venta.spec.ts
git commit -m "feat: panel cobrado con ticket por WhatsApp"
```

---

### Task 11: "Este aparato" en Configuración + fix del guardar que borra el vínculo

**Files:**
- Create: `src/ui/config/EsteAparato.tsx`
- Modify: `src/ui/config/PantallaConfig.tsx`
- Modify: `src/datos/local/repos.ts`
- Test: `tests/datos/repos.test.ts`

**Interfaces:**
- Consumes: `db`, `bajarTodo` + `traerDeSupabase` de `sincronizar.ts`, tokens de estilo.
- Produces: la sección de Configuración con el teléfono vinculado y la bajada manual; y `repos.negocio.guardarAjustes(nombre, logo, color): Promise<void>`, que guarda los ajustes visibles sin borrar el vínculo con la nube.

**Bug a reparar en el paso:** `PantallaConfig.guardar` hoy hace `db.negocio.put({ id: 'unico', nombre, logo, color })` — un put de Dexie reemplaza la fila entera, así que guardar el nombre o el logo **borra `negocioId`, `telefono` y `ultimaBajada`**: el aparato se desvincula en silencio. Con multi-dispositivo, además perdería el cursor de bajada.

- [ ] **Step 1: Escribir el test que fallan**

Agregar a `tests/datos/repos.test.ts`:

```ts
it('guardar los ajustes del negocio no borra el vínculo con la nube', async () => {
  await db.negocio.put({
    id: 'unico', nombre: 'Viejo', logo: null, color: null,
    negocioId: 'nube-1', telefono: '542615551234', ultimaBajada: 1234,
  })

  await repos.negocio.guardarAjustes('Nuevo nombre', 'data:logo', '#12694E')

  const negocio = await db.negocio.get('unico')
  expect(negocio?.nombre).toBe('Nuevo nombre')
  expect(negocio?.logo).toBe('data:logo')
  expect(negocio?.color).toBe('#12694E')
  expect(negocio?.negocioId).toBe('nube-1')
  expect(negocio?.telefono).toBe('542615551234')
  expect(negocio?.ultimaBajada).toBe(1234)
})
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run tests/datos/repos.test.ts`
Expected: FAIL — `repos.negocio` no existe.

- [ ] **Step 3: Implementar en `src/datos/local/repos.ts`**

Agregar el repo al objeto `repos`:

```ts
  negocio: {
    /** Guarda sólo los ajustes visibles; el vínculo con la nube, el
     *  teléfono y el cursor de bajada de la fila quedan intactos.
     *  (Un put directo de Dexie reemplazaría la fila entera.) */
    async guardarAjustes(
      nombre: string,
      logo: string | null,
      color: string | null,
    ): Promise<void> {
      const actual = await db.negocio.get('unico')
      await db.negocio.put({
        id: 'unico',
        nombre,
        logo,
        color,
        negocioId: actual?.negocioId,
        telefono: actual?.telefono,
        ultimaBajada: actual?.ultimaBajada,
      })
    },
  },
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/datos/repos.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `src/ui/config/EsteAparato.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/datos/local/db'
import { bajarTodo, traerDeSupabase } from '@/datos/nube/sincronizar'
import { Boton } from '@/ui/sistema/Boton'

/** El estado del respaldo de este aparato en particular: con qué teléfono
 *  quedó vinculado y la bajada manual, por si hay que recuperarlo. */
export function EsteAparato() {
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const negocio = useLiveQuery(() => db.negocio.get('unico'))

  if (!negocio?.negocioId) return null

  async function bajar() {
    setTrabajando(true)
    setAviso(null)
    try {
      const escritas = await bajarTodo(traerDeSupabase)
      setAviso(escritas > 0 ? `Bajadas ${escritas} filas.` : 'Ya estaba todo bajado.')
    } catch {
      setAviso('No se pudo bajar ahora. Probá con señal.')
    }
    setTrabajando(false)
  }

  return (
    <div className="mt-6 rounded-xl px-3.5 py-3.5" style={{ background: 'var(--chip-fondo)' }}>
      <p className="text-[13px] font-semibold">Este aparato</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--tenue)' }}>
        Vinculado al teléfono {negocio.telefono}. La copia se actualiza sola cuando hay señal.
      </p>
      <Boton
        variante="secundario"
        className="mt-3 w-full !py-2.5 !text-[12px]"
        disabled={trabajando}
        onClick={bajar}
      >
        {trabajando ? 'Bajando…' : 'Bajar todo ahora'}
      </Boton>
      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--tenue)' }}>{aviso}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Agregarla a `PantallaConfig.tsx` y arreglar el `guardar`**

1. Después de `<Respaldo />` (línea 82):

```tsx
      <EsteAparato />
```

con el import:

```tsx
import { EsteAparato } from './EsteAparato'
```

2. El `guardar` del mismo archivo deja de pisar la fila (es el bug del paso inicial de esta tarea):

```tsx
import { repos } from '@/datos/local/repos'

  async function guardar() {
    await repos.negocio.guardarAjustes(nombre.trim(), logo, color)
  }
```

- [ ] **Step 7: Compilar, testear, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add src/ui/config/EsteAparato.tsx src/ui/config/PantallaConfig.tsx src/datos/local/repos.ts tests/datos/repos.test.ts
git commit -m "feat: estado del aparato en configuración; guardar ajustes sin perder el vínculo"
```

---

### Task 12: `verificar:aislamiento` también prueba Realtime

**Files:**
- Modify: `scripts/verificar-aislamiento.mjs`
- Modify: `docs/nube.md`

**Interfaces:**
- Consumes: el script actual (crea dueños con fetch REST); `@supabase/supabase-js` desde `node_modules` para la suscripción.
- Produces: `npm run verificar:aislamiento` validando filas + escritura + Realtime. Es la prueba de seguridad del producto: si Realtime no respetara el RLS, un almacenero vería las ventas de otro en vivo.

- [ ] **Step 1: Agregar la verificación de Realtime al script**

Al final de `scripts/verificar-aislamiento.mjs`, antes del bloque `if (fallas...)`:

```js
// Realtime también respeta el RLS: el canal del negocio A no puede recibir
// los cambios del negocio B. Si eso falla, un almacenero ve las ventas de
// otro en vivo — es el peor riesgo del multi-dispositivo.
import { createClient } from '@supabase/supabase-js'

const supaA = createClient(URL_BASE, ANON, {
  auth: { persistSession: false },
})
await supaA.auth.signInWithPassword({ email: uno.email, password: `libreta-v1:${uno.email}:aislamiento` })

const llegaron = []
const canal = supaA
  .channel('verificacion-aislamiento')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, (cambio) => {
    llegaron.push(cambio)
  })
  .subscribe()

// esperar a que el canal esté activo
await new Promise((resolver) => {
  const reloj = setInterval(() => {
    if (canal.state === 'joined') { clearInterval(reloj); resolver(undefined) }
  }, 100)
  setTimeout(() => { clearInterval(reloj); resolver(undefined) }, 5000)
})

// un cambio en el negocio B no tiene que llegarle al A
await fetch(`${URL_BASE}/rest/v1/productos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${otro.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(), negocio_id: otro.negocioId,
    nombre: 'Secreto del B', costo: 1, precio: 2, stock: 1, stock_minimo: 0,
  }),
})

// un cambio en el negocio A sí tiene que llegarle
await fetch(`${URL_BASE}/rest/v1/productos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${uno.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: crypto.randomUUID(), negocio_id: uno.negocioId,
    nombre: 'Cambio del A', costo: 1, precio: 2, stock: 1, stock_minimo: 0,
  }),
})

await new Promise((resolver) => setTimeout(resolver, 5000))
await canal.unsubscribe()

const ajenos = llegaron.filter((cambio) => cambio.new?.nombre === 'Secreto del B')
if (ajenos.length > 0) fallas.push('¡el canal Realtime del negocio A recibió cambios del negocio B!')
if (!llegaron.some((cambio) => cambio.new?.nombre === 'Cambio del A')) {
  fallas.push('el canal Realtime no recibió los cambios del propio negocio (¿está aplicada la migración?)')
}
```

(El import de `createClient` va al inicio del archivo junto al de `node:fs`; el login por `signInWithPassword` usa la misma contraseña derivada que ya usa el script para crear los dueños. La sesión del dueño A en supabase-js es lo que hace que el RLS filtre el canal.)

- [ ] **Step 2: Correr la verificación**

Run: `npm run verificar:aislamiento`
Expected: `Aislamiento OK` — con la migración de la Task 1 aplicada. Si aún no está aplicada, el chequeo de Realtime falla con el mensaje del propio negocio: eso es correcto, la migración es requisito. Aplicarla primero (Task 13) si hace falta.

- [ ] **Step 3: Documentar en `docs/nube.md`**

Agregar una sección al final:

```markdown
## Un aparato nuevo

En el aparato nuevo, abrí Libreta con la base vacía y usá *"¿Ya usás Libreta
en otro aparato?"*: teléfono y el mismo PIN, y baja todo solo. La base del
multi-dispositivo es la migración `scripts/migracion-multidispositivo.sql`
(idempotente: se puede correr de nuevo sin romper nada) — actualizado_en en
todas las tablas, un trigger que lo marca con el reloj del servidor, y las
tablas en la publicación `supabase_realtime` con `REPLICA IDENTITY FULL`.

`npm run verificar:aislamiento` también comprueba que el canal Realtime del
negocio A no reciba cambios del negocio B.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/verificar-aislamiento.mjs docs/nube.md
git commit -m "feat: verificar que realtime también respete el aislamiento"
```

---

### Task 13: Aplicar la migración, verificación completa y deploy

**Files:**
- Sin archivos nuevos. Aplica `scripts/migracion-multidispositivo.sql` y verifica todo.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la base migrada, la verificación completa en verde y el deploy a producción.

- [ ] **Step 1: Aplicar la migración en la base**

En el dashboard de Supabase, proyecto **Libreta** (`wfouklntgkjzcqtmwuou`) → SQL Editor → pegar `scripts/migracion-multidispositivo.sql` → Run. Ejecutarla **dos veces** para confirmar que es idempotente (la segunda no tiene que dar errores).

Si hay cadena de conexión Postgres disponible (Project Settings → Database), se puede aplicar con `psql "$CADENA" -f scripts/migracion-multidispositivo.sql` en lugar del editor.

- [ ] **Step 2: Verificación de seguridad**

Run: `npm run verificar:aislamiento`
Expected: `Aislamiento OK: ...` — incluida la prueba realtime. Si falla el chequeo de Realtime, revisar que la migración se aplicó completa (publicación + replica identity).

- [ ] **Step 3: Suite completa**

Run: `npm test && npx tsc --noEmit && npm run build && npm run test:e2e`
Expected: todo en verde. (El build va antes de los e2e: `next start` sirve el último build.)

- [ ] **Step 4: Prueba manual de realtime en local (opcional pero recomendada)**

Run: `npx next start -p 8512 -H 0.0.0.0` → abrir `http://100.113.187.30:8512` en dos navegadores (o uno normal y otro en privado). En uno cargar un producto y entrar (teléfono de prueba real) — o directamente probar con el teléfono de Jesús en dos aparatos: una venta en uno tiene que aparecer en el otro en segundos.

- [ ] **Step 5: Deploy a producción**

Run: `VERCEL_TOKEN=$(cat /root/.vercel_token) npm run deploy`
Expected: deploy a https://libreta-sepia.vercel.app. Ojo: `NEXT_PUBLIC_*` se incrustan en el build, así que este deploy lleva las variables que ya están en Vercel.

- [ ] **Step 6: Commit final (si quedó algo sin commitear) y aviso**

```bash
git status --short
git log --oneline -3
```

Expected: árbol limpio. Avisar a Jesús: qué se deployó, la prueba manual recomendada (dos aparatos, una venta, verla aparecer), y que los negocios de prueba del script se limpian con `scripts/limpiar-pruebas.sql`.