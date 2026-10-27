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

## Verificar que el aislamiento sigue sano

```bash
npm run verificar:aislamiento
```

Comprueba que la superficie pública y el RPC de alta están cerrados sin crear
usuarios ni datos. Para probar dos tenants existentes, agregá además las
variables `AUDITORIA_TOKEN_UNO`, `AUDITORIA_NEGOCIO_UNO`,
`AUDITORIA_TOKEN_DOS` y `AUDITORIA_NEGOCIO_DOS`. **Corrélo cada vez que toques
una política RLS o agregues una tabla**.

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
