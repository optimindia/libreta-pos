# Libreta — diseño v2 (reconstrucción)

**Fecha:** 2026-08-30 · **Estado:** diseño aprobado por Jesús, pendiente plan de implementación
**Reemplaza a:** `SPEC.md` (v1, agosto 2026) en todo lo técnico. El análisis de mercado, monetización y funnel de aquel documento sigue vigente y no se repite acá.

---

## 1. Qué estamos construyendo

Un POS para almacenes de barrio argentinos: escanear, vender, anotar el fiado y saber cuánto se ganó. Producto comercial multi-negocio, vendido por suscripción, con la marca de cada cliente.

**Por qué se reconstruye.** La v1 llegó a 958 líneas con toda la aplicación dentro de `src/app/page.tsx`, sin nube, sin sincronización y con una estética de boutique (negro y oro, confetti al cobrar) que no corresponde a la herramienta de trabajo de un almacenero. El esqueleto de features era razonable; la forma de sostenerlo, no. Se conserva el repositorio y su historia; se descarta el código de `src/`.

## 2. Decisiones tomadas y por qué

Estas seis decisiones son el corazón del diseño. Cada una cierra una discusión que ya tuvimos.

### 2.1 Una sola base de datos para todos los negocios

Cada cliente es una fila en la tabla `negocios`, no un despliegue aparte.

**Por qué.** El modelo alternativo —un proyecto de Supabase y un despliegue de Vercel por cliente— funciona con tres clientes y estrangula con treinta: treinta juegos de variables de entorno, y cada corrección de un error obliga a correr la misma migración treinta veces a mano. Además hay un tope duro: el plan gratuito de Supabase permite dos proyectos activos por organización, así que el modelo se rompe en el cliente número tres.

Con base única: se actualiza una vez y lo tienen todos, una migración por cambio, y dar de alta un cliente es insertar una fila en vez de crear infraestructura.

**Lo que no se pierde.** El logo y los colores salen de la fila del negocio, así que cada cliente ve su marca. Si un cliente quiere dominio propio, Vercel permite apuntar varios dominios al mismo despliegue y la aplicación resuelve el negocio por el dominio de entrada.

### 2.2 El aislamiento se hace con RLS, no con confianza en el código

Row Level Security de Postgres: cada tabla lleva una política que sólo deja ver las filas cuyo `negocio_id` coincide con el del usuario autenticado.

**Por qué.** Es seguridad dentro de la base, no dentro de la aplicación. Aunque una consulta tuviera un error y olvidara filtrar, Postgres igual no devuelve las filas de otro negocio. Depender de que ningún `WHERE` se olvide nunca es una apuesta que se pierde una vez y se paga con datos de un cliente vistos por otro.

### 2.3 Offline-first de verdad: el teléfono es la fuente de verdad

IndexedDB (Dexie) guarda todo en el dispositivo. La venta se registra ahí y se confirma al instante, sin esperar a la red. Una cola de sincronización empuja los cambios a Supabase cuando hay señal.

**Por qué.** Es el diferencial defendible del producto y la razón por la que Alegra no compite acá. El almacén tiene mala conexión y no se puede frenar una venta por eso. Consecuencia importante: aunque la base crezca o Supabase se caiga un martes, **nadie deja de vender**.

**Sobre conflictos.** Las ventas son inserciones, nunca ediciones: dos dispositivos que venden a la vez generan filas distintas y no chocan. El conflicto real aparece sólo en el stock y en el saldo de fiados, que son valores calculados; por eso no se sincroniza el número final sino los hechos que lo producen (esta venta, este pago), y el saldo se recalcula. Es la diferencia entre sincronizar "el stock es 7" —que se pisa— y "salieron 2 yerbas" —que se suma.

### 2.4 Sin cuenta para empezar

La aplicación abre y se puede vender en el primer minuto, con los datos en el dispositivo. La cuenta (teléfono + PIN) se pide cuando el usuario quiere respaldo, un segundo dispositivo o la capa de inteligencia.

**Por qué.** Jesús eligió dejar cuentas y suscripción fuera del alcance de la v1, y la fricción de un registro antes de ver el valor mata la demostración. Al crear la cuenta, los datos locales se suben al negocio nuevo: nada de lo cargado se pierde.

### 2.5 El diseño es un marco sobrio que recibe la marca del cliente

Sistema visual definido y aprobado (sección 4). Tema claro y oscuro, ambos obligatorios.

**Por qué.** Arriba a la izquierda va el logo del almacén, no el de Libreta. Un diseño que grita tapa la marca del cliente, y el modelo de negocio es justamente vender la aplicación con la marca de cada negocio.

### 2.6 No se guarda un movimiento por cada venta

El stock se calcula desde dos fuentes que ya existen: lo que entró (las compras al mayorista) menos lo que salió (los ítems vendidos).

**Por qué.** La tabla `inventory_movements` del spec viejo anotaba una fila extra por cada producto vendido, duplicando el volumen de la base para guardar algo ya calculable desde `venta_items`. Un almacén activo genera unas 150.000 filas al año (≈30 MB); con esa tabla serían el doble, sin agregar una sola información nueva.

Las compras sí se registran (`ingresos` e `ingreso_items`), porque no son derivables de nada: son el hecho que trae la mercadería y fija el costo. Y ese costo es la mitad del cálculo de ganancia, que es el gancho de venta del producto.

## 3. Alcance

### Entra en la v1

1. **Vender**: catálogo, escáner de código de barras, ticket, cobro por efectivo / transferencia / QR / fiado.
2. **Fiado**: deudores, antigüedad de la deuda, pagos parciales, saldo por cliente.
3. **Stock**: alta de productos, costo y precio de venta, descuento automático al vender, aviso de faltante.
4. **Plata**: vendido del día y del mes, ganancia estimada, comparación contra el mismo día de la semana anterior, productos más vendidos, medios de pago.
5. **Inteligencia** (elegida explícitamente para la v1, en este orden):
   - **Reposición**: media móvil de ventas por producto → "te quedan 3 yerbas, se te acaban el viernes" → lista de compra lista para enviar por WhatsApp. Estadística pura, corre en el dispositivo, sin costo por uso.
   - **Cobro de fiado**: detecta deudas viejas y arma el mensaje de cobro con una plantilla. Sin modelo de lenguaje.
   - **Foto → stock**: foto de la factura del mayorista, un modelo de visión extrae productos y precios, el usuario confirma antes de aplicar. Es la única función con costo por uso y la única que exige conexión; va última porque es la más cara y la más frágil.
6. **PWA instalable** con los dos temas.

### Queda afuera de la v1

Cuentas y suscripción como producto (el registro existe sólo como respaldo opcional), cobro de la suscripción, multi-dispositivo simultáneo, panel de administración de clientes, historial por cliente, radar de productos muertos, reporte diario por WhatsApp.

### Criterio de terminado

Un almacén puede cargar sus productos, vender toda una jornada sin conexión, anotar y cobrar fiados, ver cuánto ganó, recibir su lista de reposición — y, al recuperar señal, encontrar todo eso en la nube sin haber tocado nada.

## 4. Sistema visual

**Tipografía.** Instrument Sans en toda la interfaz. Los importes usan números tabulares (`font-variant-numeric: tabular-nums`): todos los dígitos ocupan el mismo ancho, así la columna de precios queda alineada y el total no se mueve al cambiar.

**Color.** Cuatro, no diez.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `verde` | `#12694E` | `#2BA97B` | cobrar, ganancia, acción principal |
| `ambar` | `#B4642A` | `#D68B4A` | fiado, deuda, avisos |
| `tinta` | `#1B1A17` | `#F2F0EA` | texto |
| `hueso` | `#FCFBF8` | `#141412` | fondo |

Los neutrales tiran a cálido —hueso, no blanco de hoja— para que la aplicación se sienta amable y no una planilla. El fiado va en ámbar y no en rojo: te deben, no te robaron.

**Íconos.** Dibujados a mano en SVG, mismo grosor de línea y mismas puntas redondeadas. **Ningún emoji**: cada sistema operativo los dibuja distinto y son de otra persona, no de la marca.

**Estados de conexión.** El usuario nunca lee "error" ni "sin conexión". Lee *"Guardado"* con un punto ámbar cuando la venta está anotada y todavía sin subir, y *"Al día"* en verde cuando ya sincronizó. La promesa del producto es tranquilidad, y el texto la sostiene.

**Prohibido:** confetti, sonidos de caja, degradados de color, vidrio esmerilado, sombras de colores, menú hamburguesa (esconde justo lo que se usa todo el día).

## 5. Arquitectura

```
Next.js (App Router) en Vercel   — un repositorio, un despliegue
Supabase                          — Postgres con RLS + Auth por teléfono
Dexie / IndexedDB                 — fuente de verdad en el dispositivo
BarcodeDetector + zxing-wasm      — escáner nativo con respaldo
Tailwind                          — tokens del sistema visual
```

**Resolución del negocio.** Por sesión autenticada; si la aplicación entra por un dominio propio de cliente, por el dominio.

**Organización del código.** El error de la v1 fue un archivo con todo adentro. La estructura se corta por dominio, no por tipo de archivo:

```
src/
  dominio/          reglas puras y testeables: precios, ganancia,
                    saldo de fiado, predicción de reposición
  datos/
    local/          esquema Dexie, repositorios, cola de sincronización
    nube/           cliente Supabase, subida y bajada
  ui/
    vender/  fiados/  stock/  plata/    una carpeta por sección
    sistema/        tokens, íconos, componentes base
  app/              rutas
```

La regla que sostiene esto: `dominio/` no importa nada de `datos/` ni de `ui/`. Son funciones que reciben datos y devuelven datos, así que se prueban sin navegador, sin base y sin red — y ahí vive lo que de verdad puede dar mal un número.

## 6. Modelo de datos

Todas las tablas llevan `negocio_id` y su política de RLS.

| Tabla | Contenido |
|---|---|
| `negocios` | nombre, logo, color, plan, dominio propio |
| `usuarios_negocio` | qué usuario accede a qué negocio |
| `productos` | código de barras, nombre, costo, precio, stock, stock mínimo |
| `ventas` | fecha y hora, total, medio de pago, dispositivo de origen |
| `venta_items` | venta, producto, cantidad, precio y costo al momento |
| `clientes` | nombre, teléfono |
| `fiados` | cliente, monto, fecha, vencimiento, estado |
| `fiado_pagos` | fiado, monto, fecha |
| `ingresos` | compra al mayorista: fecha, proveedor, total, origen (manual o foto) |
| `ingreso_items` | ingreso, producto, cantidad, costo unitario |
| `ventas_resumen` | agregado diario por producto (ver 6.2) |

**6.0 El stock no es una columna que se pisa.** `productos.stock` guarda el valor calculado para poder leerlo rápido, pero la verdad son los hechos: ingresos menos ventas. Ante cualquier duda —un dispositivo que sincroniza tarde, un error de carga— el valor se recalcula desde esas dos tablas en vez de arrastrar un número que nadie puede auditar.

**6.1 Precio y costo se copian en `venta_items`.** No se referencia el precio actual del producto: si mañana sube la yerba, la ganancia de las ventas de ayer no puede cambiar sola. Un libro contable no se reescribe.

**6.2 Resumen de lo viejo.** Pasados 12 meses, las ventas se colapsan a un agregado por día y por producto en `ventas_resumen`, y el detalle se descarta. El almacenero no necesita el ticket exacto de un martes de hace dos años; necesita saber cuánto vendió. Corta el crecimiento a una fracción y las estadísticas siguen funcionando.

**6.3 Índices.** Toda consulta filtra primero por negocio: índice compuesto `(negocio_id, fecha)` en `ventas`, `(negocio_id, codigo_barras)` en `productos`. Es la diferencia entre milisegundos y minutos, y se decide el primer día.

**Volumen esperado.** ≈150.000 filas y ≈30 MB por negocio al año. El plan gratuito (500 MB) sostiene unos 15 negocios; el plan Pro (USD 25/mes, 8 GB) sostiene unos 270 negocios-año, y el excedente cuesta USD 0,125 por GB al mes. Con 100 clientes pagando, el almacenamiento cuesta menos de un centavo de dólar por negocio.

## 7. Sincronización

Cada cambio local se escribe en IndexedDB y se encola. La cola sube en segundo plano cuando hay red, reintenta con espera creciente y sobrevive al cierre de la aplicación.

- **Ventas y pagos**: sólo inserciones, identificadas por un UUID generado en el dispositivo. Si una subida se reintenta, la base la reconoce y no la duplica.
- **Productos**: gana la escritura más reciente; el catálogo lo edita una persona por vez.
- **Stock y saldos**: no se sincronizan como número, se recalculan desde los hechos.

**Sin resolución manual de conflictos.** Es un almacén, no un editor colaborativo. Si alguna vez hiciera falta, se resuelve mostrando ambas versiones — pero no se construye ahora.

## 8. Pruebas

- **Dominio** (`dominio/`): pruebas unitarias sobre el cálculo de ganancia, el saldo de fiado con pagos parciales, el descuento de stock y la predicción de reposición. Es donde un error cuesta plata real y donde probar es barato.
- **Cola de sincronización**: pruebas sobre subida duplicada, cortes de red a mitad de camino y reintentos.
- **Recorrido completo**: un flujo de venta con Playwright, incluido el caso sin conexión.

No se persigue cobertura total: se prueba lo que calcula plata y lo que puede perder datos.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Los datos viven en un teléfono que se puede perder | Registro ofrecido en el momento en que ya hay algo que perder, no antes |
| El escáner falla en teléfonos viejos | Dos capas (nativa y zxing) más carga manual por código; el escáner nunca es el único camino |
| La factura por foto extrae mal los precios | El usuario confirma producto por producto antes de aplicar; nunca escribe directo en el stock |
| RLS mal configurado expone datos entre clientes | Prueba automática que intenta leer, desde un negocio, filas de otro y debe fallar |
| Alcance que se estira | La v1 cierra en el criterio de terminado de la sección 3; lo demás se anota y espera |

## 10. Qué sigue

Plan de implementación por etapas verificables, mediante la skill `writing-plans`. Primera etapa prevista: sistema visual y dominio con sus pruebas, antes que cualquier pantalla.
