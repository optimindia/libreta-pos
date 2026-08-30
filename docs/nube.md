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

5. Reiniciar `npm run dev`. La sincronización se enciende sola.

En Vercel, las mismas dos variables se cargan en **Settings → Environment
Variables** del proyecto.

## Verificar que el aislamiento funciona

Con dos usuarios de prueba dados de alta en negocios distintos, consultar
`productos` desde uno de ellos debe devolver **solamente** sus filas. Si
devuelve filas del otro negocio, RLS quedó mal aplicado y no hay que salir a
vender hasta arreglarlo.
