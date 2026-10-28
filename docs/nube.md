# Encender la nube

Libreta funciona sin esto: todo queda guardado en el teléfono. Estos pasos
agregan el respaldo, el multi-dispositivo y la base para cobrar suscripción.

1. Entrar a supabase.com y crear un proyecto. Región: **São Paulo**, la más
   cercana a Mendoza.
2. En el proyecto, ir a **SQL Editor**, pegar todo el contenido de
   `src/datos/nube/esquema.sql` y ejecutar. En una base existente, ejecutar
   además `scripts/migracion-suscripciones-manuales.sql` y luego
   `scripts/migracion-seguridad-plataforma.sql`. Para activar pedidos y ofertas
   en una base existente, ejecutar también
   `scripts/migracion-clientes-pedidos.sql` y sus índices. Finalmente ejecutar
   `scripts/migracion-preferencias-negocio.sql` para activar la configuración
   sincronizada de funciones.
3. En **Project Settings → API**, copiar `Project URL` y la clave `anon public`.
4. Crear el archivo `.env.local` en la raíz del proyecto:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon>
   ```

5. En producción, mantener **Disable signups** activo: las cuentas se crean
   desde `/admin` y el administrador entrega el teléfono y PIN.
6. Reiniciar `npm run dev`. La sincronización se enciende sola.

## Cómo entra el almacenero

Con su **teléfono y un PIN de 6 números**, enviados por el administrador desde
`/admin`. Por debajo eso usa el login de email de Supabase con una dirección
derivada del teléfono (`54261...@libreta.app`) que el usuario nunca ve.

El motivo: autenticar por teléfono de verdad exige contratar un proveedor de SMS
(Twilio), que cobra por mensaje. **Limitación de este atajo:** el número no queda
verificado y no hay recuperación de PIN olvidado. Cuando haya clientes pagando,
conviene pasar al SMS real.

En Vercel, las mismas dos variables se cargan en **Settings → Environment
Variables** del proyecto.

## Límite de intentos de PIN (SEG-03)

El PIN tiene sólo un millón de combinaciones, así que el ingreso pasa por el
servidor: la pantalla llama a `/api/ingresar`, que reenvía a la función Edge
`ingresar`. Ésta cuenta los intentos por teléfono en `intentos_ingreso` (sólo
service role) y tras **5 intentos en 15 minutos bloquea ese teléfono 15
minutos**. La respuesta es la misma exista o no el teléfono, y el bloqueo
también se aplica a teléfonos inexistentes. La pantalla muestra
"Demasiados intentos. Esperá N minutos y probá de nuevo."

Mientras la función no esté desplegada, `/api/ingresar` responde 501 y la app
entra como antes (sin límite), así que se puede publicar la app primero.

**Importante:** el límite sólo sirve si no se puede probar el PIN directo
contra Supabase Auth. Con la contraseña v1 (`libreta-v1:<tel>:<pin>`) eso
sigue siendo posible. Lo cierra el secreto `LIBRETA_PIN_PEPPER` (contraseña v2,
HMAC que sólo conocen las funciones). Pasos, en este orden:

1. Aplicar `supabase/migrations/20261028141000_intentos_ingreso.sql`.
2. `supabase functions deploy ingresar --no-verify-jwt` y publicar la app.
   Probar un ingreso de dueño y uno de vendedor.
3. Crear el secreto **una sola vez y guardarlo en un lugar seguro**:
   `supabase secrets set LIBRETA_PIN_PEPPER="$(openssl rand -base64 32)"`.
   Si se pierde o se cambia, nadie con contraseña v2 puede entrar hasta que
   se le regenere el PIN.
4. `supabase functions deploy ingresar --no-verify-jwt` y
   `supabase functions deploy admin` (las dos leen el mismo secreto).
   Desde ahí las cuentas nuevas y los PIN regenerados ya nacen en v2, y cada
   cuenta vieja se pasa sola a v2 la próxima vez que entra. Para cerrar ya una
   cuenta vieja, regenerarle el PIN desde `/admin`.

### Verificación humana opcional (Cloudflare Turnstile)

Evita que un bot bloquee teléfonos ajenos a propósito y frena ataques masivos.

1. En Cloudflare → Turnstile, crear un widget (modo *Managed*) con los
   dominios donde está la app (y `localhost` para probar).
2. En Vercel, cargar `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>` y volver a
   publicar (la clave se incrusta al compilar; también abre la CSP a
   `challenges.cloudflare.com`).
3. Recién después: `supabase secrets set TURNSTILE_SECRET_KEY=<secret key>`.
   Con ese secreto la función rechaza cualquier pedido sin token válido.

Opcional y más estricto: activar también el captcha en Supabase
(**Authentication → Attack Protection → Enable CAPTCHA protection**, Turnstile,
mismo secret). Cierra el acceso directo a Auth incluso para las cuentas que
todavía no pasaron a v2, y también `signUp`. La función `ingresar` pide la
sesión con la clave de servicio, que Auth no somete al captcha: probarlo en un
entorno de prueba antes de activarlo en producción. Con eso activo deja de
funcionar el ingreso "como antes" (sin la función) y el respaldo por cuenta
propia (modo sin `NEXT_PUBLIC_SAAS_REQUIRED`).

Límite conocido: todos los ingresos llegan a Auth desde los servidores de
Supabase, que limita `/auth/v1/token` por IP. Con muchos ingresos simultáneos
Auth puede responder 429 y la pantalla dice "Probá de nuevo en un rato".

## Verificar que el aislamiento sigue sano

```bash
npm run verificar:aislamiento
```

Comprueba que la superficie pública y el RPC de alta están cerrados sin crear
usuarios ni datos. Para probar dos tenants existentes, agregá además las
variables `AUDITORIA_TOKEN_UNO`, `AUDITORIA_NEGOCIO_UNO`,
`AUDITORIA_TOKEN_DOS` y `AUDITORIA_NEGOCIO_DOS`. **Corrélo cada vez que toques
una política RLS o agregues una tabla**.

## Permisos del vendedor

`supabase/migrations/20261028140000_permisos_vendedor.sql` hace que la base
también le niegue al vendedor lo que la app no le muestra: Ajustes
(`negocio_configuracion`), Plata (`movimientos_caja`, `cierres`), cargar
mercadería (`ingresos`), dar de alta, editar la ficha o borrar productos,
ajustar stock, anular ventas o fiados y borrar clientes. Vender, fiar, cobrar
fiados, clientes y pedidos siguen igual. El SQL para revertirla está al final
del archivo. El costo sigue siendo legible para el vendedor (ver el
comentario de la migración).

Si la base rechaza algo por permisos (código `42501`), la cola de subida lo
aparta con el motivo y sigue con el resto; no lo reintenta sola.

Para verificar en una rama de Supabase, con la migración aplicada:

```sql
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and (policyname like 'solo_dueno%' or policyname = 'vendedor_solo_ventas');
-- 19 filas
```

y probar como vendedor (`set role authenticated; select
set_config('request.jwt.claim.sub', '<usuario vendedor>', false);`) que un
`insert into movimientos_caja ...` devuelve 42501 y una venta con sus
renglones y `registrar_movimiento_stock(..., -1, 'venta')` pasan.

## Funciones por negocio

Desde **Configuración → Funciones visibles** se puede ocultar cualquier módulo
opcional sin borrar sus datos. Ventas, Cuenta y Configuración permanecen
siempre disponibles. La preferencia vive en `negocio_configuracion`, con una
fila por negocio, RLS para usuarios con suscripción vigente, marca de tiempo
del servidor y Realtime; por eso se replica al iniciar sesión en otro aparato
o cuando vuelve la conexión.

## Proyecto ya configurado

- Proyecto: **Libreta** (`wfouklntgkjzcqtmwuou`), organización *CreaciónTiendas*, región us-east-2.
- Esquema aplicado, RLS activo en las tablas operativas y comerciales, altas
  públicas desactivadas y bloqueo estricto por vencimiento.
- Las claves están en `.env.local` (fuera de git). Para Vercel hay que cargar las
  mismas dos variables en **Settings → Environment Variables**.
