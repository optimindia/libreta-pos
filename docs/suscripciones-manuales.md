# Suscripciones manuales de Libreta

## Flujo inicial

1. El cliente escribe por WhatsApp.
2. Se recibe el pago por alias fuera de Libreta.
3. El propietario entra a [`/admin`](https://libreta-sepia.vercel.app/admin).
4. En **Crear una cuenta**, carga negocio, teléfono, PIN y días de prueba.
5. Se envían las credenciales desde el botón de WhatsApp.
6. Cuando llega un nuevo pago, se elige **+30 días** en ese negocio.
7. Si no se renueva, el POS queda bloqueado automáticamente al vencer. Los datos no se eliminan.

El panel también permite elegir un paquete configurable (mensual, trimestral,
semestral, anual, prueba o cortesía) o cargar una cantidad exacta de días. La
renovación puede sumarse al vencimiento actual o empezar desde hoy. También se
puede registrar importe, medio de pago, referencia y nota de seguimiento.

## Componentes

- `administradores_plataforma`: define quién puede usar el panel privado.
- `suscripciones`: mantiene un único estado comercial por negocio.
- `suscripcion_eventos`: registra altas, pruebas, extensiones, pausas y reactivaciones.
- `planes_suscripcion`: catálogo privado de paquetes con días, precio sugerido,
  orden y estado disponible/archivado.
- `supabase/functions/admin`: valida el JWT y ejecuta las operaciones privilegiadas con la clave de servicio de Supabase.
- `ControlAcceso`: impide mostrar el POS hasta tener sesión y suscripción vigente.

La clave privilegiada nunca se configura en Vercel ni se envía al navegador. La función Edge la recibe desde los secretos internos de Supabase. Las tablas comerciales tienen RLS; el cliente sólo puede leer la suscripción de su propio negocio.

Desde la ficha de cada cuenta el propietario puede buscar y filtrar su cartera,
editar nombre/teléfono/nota interna y regenerar el PIN. Cambiar el teléfono
cambia el identificador de ingreso, pero no modifica el historial ni la
suscripción.

## Operación futura

El modelo deja espacio para sumar Mercado Pago más adelante: se puede agregar un proveedor y procesar sus webhooks para llamar a la misma lógica de extensión. El flujo manual actual no depende de Mercado Pago ni de una integración de pagos.

## Variables

En producción, cuando Supabase está configurado, el acceso SaaS se activa por defecto. Para hacerlo explícito se puede definir `NEXT_PUBLIC_SAAS_REQUIRED=true` en Vercel. Para las pruebas locales, Playwright usa `NEXT_PUBLIC_SAAS_REQUIRED=false` y conserva el modo de demostración sin cuentas reales.

## Migración

Las migraciones aplicadas en producción están versionadas en
`scripts/migracion-suscripciones-manuales.sql`,
`scripts/migracion-seguridad-plataforma.sql` y
`scripts/migracion-planes-gestion.sql`. Son idempotentes y no borran datos
existentes. El propietario inicial del proyecto quedó habilitado como
administrador y con una cortesía de transición de 30 días.

Para una instalación nueva, ejecutar también `scripts/migracion-seguridad-plataforma.sql`: activa el bloqueo estricto por vencimiento, las políticas RLS por suscripción, las relaciones compuestas entre negocio y datos, y los permisos mínimos.
