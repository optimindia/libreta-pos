# Revisión de seguridad de Libreta

## Alcance

Revisión de autenticación, bloqueo comercial, RLS multi-negocio, permisos de
Postgres, funciones `SECURITY DEFINER`, sincronización, endpoint de lectura de
facturas, service worker y cabeceras HTTP.

## Cambios aplicados

- Producción falla cerrado: si Supabase no está configurado, el POS no se
  convierte en una versión gratuita.
- La sesión y la suscripción se validan nuevamente contra Supabase antes de
  habilitar el POS. La copia de IndexedDB sólo sirve para explicar un bloqueo;
  nunca concede acceso.
- La fecha `vence_en` es la autoridad. Prueba y plan activo permiten operar
  sólo mientras la fecha no llegó; gracia, suspensión y vencimiento bloquean.
- El vencimiento bloquea también las tablas operativas mediante RLS. El cliente
  sólo puede leer su negocio, su vínculo y el estado de su suscripción.
- El helper de RLS dejó de estar en `public` y se revocó el RPC público. Las
  tablas administrativas tienen una política explícita de denegación.
- Se revocaron permisos innecesarios de `anon` y de `authenticated`; las
  secuencias y tablas sólo reciben los permisos mínimos para sincronizar. El
  navegador tampoco puede escribir `actualizado_en`: lo fija el servidor.
- Se agregaron relaciones compuestas para impedir enganchar filas de un
  negocio con cabeceras o productos de otro y checks para impedir nuevos
  importes o stocks inválidos.
- El catálogo `planes_suscripcion` quedó privado para clientes: sólo la Edge
  administrativa puede crear, editar, archivar o restaurar paquetes. Las
  suscripciones guardan una copia del nombre e importe aplicado para que el
  historial no cambie si después se edita el catálogo.
- La gestión de cuentas se mantiene detrás del mismo JWT y rol: editar datos,
  cambiar teléfono y regenerar PIN no se exponen como escrituras directas al
  navegador.
- Pedidos, items de pedido y ofertas de catálogo quedaron protegidos por RLS
  tenant-safe, claves compuestas e índices de cobertura; una reserva sólo
  bloquea unidades del mismo negocio y el cobro se vincula a su pedido.
- `/api/factura` ahora exige JWT, negocio con suscripción vigente, límite por
  cuenta, payload acotado, MIME/base64 válido y salida de modelo acotada.
- Vercel entrega CSP, `nosniff`, protección contra iframes, política de
  permisos, referrer estricto, COOP y HSTS.
- Supabase Auth dejó de aceptar altas públicas, elevó el mínimo de contraseña
  y usa la URL de producción.

## Verificaciones realizadas

- El advisor de seguridad ya no informa RLS sin política ni funciones
  `SECURITY DEFINER` públicas; queda únicamente la protección de contraseñas
  filtradas, que requiere el plan Pro de Supabase.
- Una consulta anónima a `productos` devuelve HTTP 401.
- El RPC público anterior devuelve 404.
- Las políticas operativas exigen `authenticated` y suscripción vigente: 11
  políticas estrictas y 10 relaciones compuestas tenant-safe.
- El catálogo comercial tiene RLS explícito de denegación para `anon` y
  `authenticated`, además de índice sobre su clave foránea administrativa.
- La auditoría de privilegios dejó cero permisos de `anon` sobre tablas de
  `public`, cero RPC públicos para `anon` y cero privilegios de escritura del
  reloj de sincronización.
- Se verificó que las relaciones cruzadas existentes eran cero antes de crear
  las restricciones; también quedaron verificadas las referencias de items a
  productos y de eventos a suscripciones.
- Pasan TypeScript, ESLint y la suite completa de pruebas.
- `npm audit --omit=dev` no reporta vulnerabilidades conocidas.
- Producción quedó desplegada en Vercel y `/api/factura` y la función admin
  responden 401 sin una sesión válida.

## Riesgos residuales conocidos

- La protección contra contraseñas filtradas no se puede activar en el plan
  actual de Supabase. Conviene habilitarla al pasar a Pro.
- El acceso humano sigue usando un PIN de seis dígitos por comodidad. La
  contraseña real de Auth es más larga y Supabase aplica rate limits, pero
  antes de escalar conviene sumar recuperación por SMS y MFA.
- En modo SaaS se prioriza el control de suscripción: sin una validación
  reciente del servidor no se abre el POS. Los datos locales siguen guardados,
  pero no se muestran ni se sincronizan sin sesión válida.
- IndexedDB queda protegido por el modelo de seguridad del navegador; un
  dispositivo desbloqueado o comprometido puede exponer sus datos locales.
- El límite de lecturas de factura es por instancia de Vercel; antes de
  ofrecerlo a gran escala conviene moverlo a un rate limiter persistente.
