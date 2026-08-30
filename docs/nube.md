# Encender la nube

Libreta funciona sin esto: todo queda guardado en el teléfono. Estos pasos
agregan el respaldo, el multi-dispositivo y la base para cobrar suscripción.

1. Entrar a supabase.com y crear un proyecto. Región: **São Paulo**, la más
   cercana a Mendoza.
2. En el proyecto, ir a **SQL Editor**, pegar todo el contenido de
   `src/datos/nube/esquema.sql` y ejecutar.
3. En **Project Settings → API**, copiar `Project URL` y la clave `anon public`.
4. Crear el archivo `.env.local` en la raíz del proyecto:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon>
   ```

5. En **Authentication → Providers → Email**, desactivar "Confirm email".
   El almacenero entra con teléfono y PIN; no hay casilla de correo que confirmar.
6. Reiniciar `npm run dev`. La sincronización se enciende sola.

## Cómo entra el almacenero

Con su **teléfono y un PIN de 6 números**, desde Configuración → "Crear mi copia
de seguridad". Por debajo eso usa el login de email de Supabase con una dirección
derivada del teléfono (`54261...@libreta.app`) que el usuario nunca ve.

El motivo: autenticar por teléfono de verdad exige contratar un proveedor de SMS
(Twilio), que cobra por mensaje. **Limitación de este atajo:** el número no queda
verificado y no hay recuperación de PIN olvidado. Cuando haya clientes pagando,
conviene pasar al SMS real.

En Vercel, las mismas dos variables se cargan en **Settings → Environment
Variables** del proyecto.

## Verificar que el aislamiento funciona

Con dos usuarios de prueba dados de alta en negocios distintos, consultar
`productos` desde uno de ellos debe devolver **solamente** sus filas. Si
devuelve filas del otro negocio, RLS quedó mal aplicado y no hay que salir a
vender hasta arreglarlo.

## Verificar que el aislamiento sigue sano

```bash
npm run verificar:aislamiento
```

Crea dos negocios de prueba e intenta, desde uno, leer y escribir en el otro.
Tiene que decir "Aislamiento OK". **Correlo cada vez que toques una política de
RLS o agregues una tabla**: si esto falla, un almacenero puede ver la
facturación de otro. Los negocios de prueba se limpian con
`scripts/limpiar-pruebas.sql`.

## Proyecto ya configurado

- Proyecto: **Libreta** (`wfouklntgkjzcqtmwuou`), organización *CreaciónTiendas*, región us-east-2.
- Esquema aplicado, RLS activo en las 11 tablas, confirmación de email desactivada.
- Las claves están en `.env.local` (fuera de git). Para Vercel hay que cargar las
  mismas dos variables en **Settings → Environment Variables**.
