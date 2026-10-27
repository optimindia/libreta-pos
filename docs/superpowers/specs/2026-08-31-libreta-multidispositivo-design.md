# Multi-dispositivo realtime y ticket por WhatsApp — diseño

Fecha: 2026-08-31 · Rama: `main` · Estado: aprobado por Jesús

## Contexto

Libreta sincroniza en un solo sentido: sube la cola local a Supabase cada 30 segundos,
pero un aparato nuevo que entra con el teléfono y el PIN queda vinculado sin bajar
nada — arranca vacío, y lo que vende otro aparato nunca aparece. `bajarTodo` existe en
`src/datos/nube/sincronizar.ts` pero nadie lo llama desde la UI.

Jesús definió el escenario: **por ahora solo el dueño, con 2-3 aparatos** (celular y
tablet, por ejemplo). Empleados con su propio PIN quedan para una ronda posterior.
Y pidió que la caja "trabaje como en realtime": lo vendido en un aparato se ve en el
otro al instante. En la misma ronda: mandar el ticket de la venta por WhatsApp.

## Objetivos

1. Un aparato nuevo entra con teléfono + el mismo PIN y en menos de 30 segundos tiene
   todo el negocio.
2. Lo que se vende o edita en un aparato aparece en el otro en segundos, con señal.
3. La edición local todavía sin subir nunca se pierde por una bajada.
4. Tras cobrar, se manda el ticket de la venta por WhatsApp en un toque.

## No objetivos

- Empleados con PIN propio, roles y auditoría de quién vendió (ronda futura; el
  diseño no se interpone).
- Fusión de campos por columnas cuando dos aparatos editan la misma fila: gana el
  más nuevo, punto (ver "Conflictos").
- Borrado de filas: la app no da de baja nada hoy; la bajada no maneja DELETE.
- SMS real para verificar el número o recuperar el PIN (sigue el atajo del email invisible).
- Suscripción/cobro y reportes: no en esta ronda.

## 1. Identidad y vinculación

Hoy `crearRespaldo` en `src/datos/nube/sesion.ts` hace dos cosas distintas en una
sola función: crear la cuenta y entrar a ella. Se separan:

- **`crearRespaldo(telefono, pin)`** — sin cambios de comportamiento: primer aparato.
  Crea la cuenta si no existe, crea el negocio con `crear_mi_negocio()` y guarda el
  vínculo local. Sigue apareciendo desde Configuración después de 10 ventas o
  5 productos.
- **`entrar(telefono, pin)`** — nuevo: solo inicia sesión con las credenciales
  derivadas del teléfono y devuelve el `negocioId` del vínculo existente en
  `usuarios_negocio`. No crea nada. Errores con motivo claro: "ese teléfono y PIN no
  coinciden con ningún negocio".

La sesión la persiste supabase-js en localStorage: el aparato queda logueado, igual
que ya pasa hoy tras crear el respaldo.

**Aparato nuevo con datos locales sueltos** (cargó productos antes de decidir entrar):
los datos se quedan y se suben. Los ids son UUID generados por `src/dominio/id.ts`,
así que nada se pisa entre aparatos; el único caso feo es que el mismo producto esté
cargado en los dos lados y quede duplicado. Caso raro, aceptado y documentado en la
UI de entrada con una línea.

## 2. Bajada: completa al entrar, incremental después

### Bajada completa

La existente `bajarTodo` (`sincronizar.ts`), llamada desde dos lugares nuevos: al
confirmar `entrar()` y desde el botón "Bajar todo ahora" en Configuración.

### Bajada incremental

Nueva `src/datos/nube/bajada.ts`, con la función `bajarCambios(negocioId)`:

- Cada tabla sincronizada se pide con `actualizado_en >= cursor`, donde el cursor es
  la marca de tiempo más alta vista en la última bajada, guardada en la fila local del
  negocio (`ultimaBajada: number` en el tipo `Negocio`, epoch ms).
- **El cursor se compara contra el reloj del servidor, nunca contra el del teléfono.**
  Si el celu del almacenero va 5 minutos adelantado, la incremental no se rompe.
- Solape deliberado de 30 segundos hacia atrás en cada pedido: reprocesar es barato
  porque el merge por id es idempotente, y cubre transacciones que llegan a la base
  con la marca apenas anterior al cursor.
- Ventas e ingresos: se filtran las cabeceras por `actualizado_en` y después se traen
  sus items con `in('venta_id', ids)` — los items no necesitan la columna.
- Al terminar, `ultimaBajada` = máxima marca vista.

### Migración en la base (idempotente, `scripts/migracion-multidispositivo.sql`)

1. `actualizado_en` hoy solo existe en `productos`. Se agrega
   `add column if not exists actualizado_en timestamptz not null default now()` a:
   `ventas`, `clientes`, `fiados`, `fiado_pagos`, `ingresos`, `cierres`.
   (`venta_items` e `ingreso_items` bajan junto a su cabecera; `ventas_resumen` no
   se sincroniza.)
2. Trigger `before update` `marca_actualizado()` que fuerza
   `actualizado_en = now()` en las tablas sincronizadas: `productos`, `ventas`,
   `clientes`, `fiados`, `fiado_pagos`, `ingresos`, `cierres`. Un solo reloj: el del
   servidor.
3. `alter publication supabase_realtime add table ...` para esas mismas siete tablas,
   para que postgres_changes las emita. Con la sesión autenticada, Realtime aplica
   las políticas RLS: cada aparato recibe solo los cambios de su negocio.

En el mapeo (`src/datos/nube/mapeo.ts`), `aFilaPlana` deja de mandar `actualizadoEn`
desde el cliente: en INSERT aplica el `default now()` y en UPDATE el trigger. La
columna sigue mapeándose en `deLaNube` para bajar.

### Merge al bajar (más nuevo gana)

- Si la fila no existe local: se escribe.
- Si existe local: se compara `actualizadoEn` de la fila local contra el
  `actualizadoEn` de la fila que baja. Gana el más nuevo; la perdedora no se toca.
- Esta comparación es la que protege la propiedad clave: una edición local aún en
  cola de subida tiene `actualizadoEn` de ahora, la copia en la nube es de antes,
  así que la bajada nunca la pisa — la subirá el próximo ciclo y el otro aparato la
  recibirá.

## 3. Realtime

Nueva `src/datos/nube/realtime.ts`:

- Suscripción `postgres_changes` a las siete tablas, sin filtro de fila: el RLS ya
  limita los eventos a los del negocio del usuario autenticado.
- El evento no aplica cambios: solo programa `bajarCambios()` con un debounce de
  2 segundos. Llega un lote de eventos por una venta (venta + items + productos
  tocados) → una sola bajada incremental. Idempotente por diseño.
- El `Sincronizador` (`src/ui/sistema/Sincronizador.tsx`) se agranda: cada 30
  segundos, además de subir la cola, baja cambios. Es el respaldo cuando el websocket
  se corta o el proyecto no tiene Realtime habilitado.
- Realtime solo se prende si hay negocio vinculado y sesión activa; se apaga al
  desmontar.

## 4. Ticket por WhatsApp

- `mensajeTicket(negocio, venta)` en `src/dominio/mensajes.ts`, junto a
  `mensajeCierre` que ya existe: nombre del negocio, fecha y hora, un ítem por línea
  con cantidad, nombre y subtotal, el total, y si la venta es fiado el saldo pendiente.
  Texto limpio multilinea, énfasis con *negrita*, **sin tablas** (regla de WhatsApp).
- En `PantallaVender`, tras `cobrar()` la venta confirmada queda en un panel
  "Cobrado" con dos botones: **Mandar ticket por WhatsApp** y **Nueva venta**.
  Hoy el carrito se vacía sin confirmación: ese panel la reemplaza.
- El enlace usa el `enlaceWhatsApp` existente: con `clienteId` y cliente con
  teléfono, directo a `wa.me/<número>?text=...`; si no, `wa.me/?text=...` y el
  almacenero elige el chat. La venta fiada desde Vender hoy no lleva cliente, así
  que el caso común es el segundo.

## 5. UI

- **Puerta de entrada** (componente nuevo en `src/ui/vender/`): solo cuando
  `nubeActiva()`, la base local está vacía (0 productos, 0 ventas) y no hay negocio
  vinculado, el lugar del catálogo muestra dos caminos: *"Ya uso Libreta en otro
  aparato"* (teléfono + PIN → `entrar()` → bajada completa → pantalla normal) y
  *"Empezar de cero acá"* (cierra el panel; uso offline como hoy). Sin nube
  configurada no aparece, como ya pasa con el respaldo.
- **Configuración**: sección "Este aparato" con el teléfono vinculado, el estado de
  sincronización y el botón "Bajar todo ahora".
- Diseño sobrio: nada de emojis como íconos, confetti ni degradados; usa los tokens
  existentes.

## 6. Pruebas

- **Unitarias** (`npm test`): `entrar` contra `crearRespaldo` con el cliente mockeado;
  `mensajeTicket` (contenido, fiado con saldo, sin tablas); merge más-nuevo-gana
  (una edición local sin subir no se pisa, una fila nueva se agrega, una fila vieja
  se actualiza); el cursor avanza con la marca del servidor y pide con el solape.
- **e2e** (`npm run test:e2e`): la puerta de entrada aparece con la app vacía y se
  cierra con "Empezar de cero"; tras cobrar, el botón de WhatsApp genera el link
  `wa.me` con el texto del ticket correcto. La entrada real contra Supabase queda
  cubierta por las unitarias con el cliente mockeado y por `verificar:aislamiento`
  contra la base.
- **`npm run verificar:aislamiento` se agranda**: además de leer y escribir entre
  negocios, suscribe el canal Realtime con el usuario del negocio A, dispara un
  cambio en el negocio B y espera 5 segundos: no tiene que llegar nada.
  Después dispara un cambio en A: tiene que llegar. Si Realtime no respetara el
  RLS, un almacenero vería las ventas de otro en vivo — es el peor riesgo del
  diseño, así que se verifica en cada corrida.

## Conflictos

Regla documentada para el almacenero: si dos aparatos editan la misma fila casi al
mismo tiempo, gana el último. Las ventas nunca se pierden (append por id); el
peor caso es que el stock contable de un producto quede desactualizado unos
segundos si dos aparatos vendieron exactamente el mismo producto a la vez — con
la bajada en segundos, la ventana es mínima.

## Criterios de aceptación

1. Un aparato nuevo entra con teléfono + PIN y en menos de 30 segundos tiene todo.
2. Una venta hecha en un aparato aparece en el otro en ≤5 segundos con señal.
3. Una edición local sin subir sobrevive a cualquier bajada.
4. `npm run verificar:aislamiento` pasa, incluida la prueba de Realtime.
5. `npm test`, `npm run test:e2e`, `npx tsc --noEmit` y `npm run build` en verde.
6. Tras cobrar, el ticket se manda por WhatsApp en un toque.