# Backend

API Django 5.2 + Django REST Framework. La configuración está en `config/`;
`core/` contiene 30 modelos, serializers, vistas, permisos y 22 migraciones
de dominio. La entrada de URLs es `config/urls.py`.

## Funcionalidad disponible

- 126 rutas API: CRUD administrativo, identidad/contexto/onboarding, baja de cuenta, directorio móvil, lealtad, planes, operaciones, invitaciones, alianzas, subida firmada de imágenes de negocio, facturación Stripe Sandbox y proxy de Benef AI.
- Verificación de sesiones Supabase Auth y permisos según usuario, negocio y sucursal; URLs firmadas de Storage para imágenes de negocios solo para propietarios.
- Perfil propio editable con foto validada contra Supabase Storage y baja idempotente con anonimización y borrado de identidad Supabase.
- Directorio de negocios activos para consumidores con búsqueda, filtro por categoría y paginación.
- Respuestas móviles enriquecidas con nombre, slug y logo del negocio.
- Onboarding comercial idempotente: perfil, negocio, membresía de dueño y plan Free desde una sola captura.
- Aislamiento por sucursal en visitas, registros de actividad, canjes y métricas; los cupones globales solo los ve el dueño.
- Planes Free/Premium con límites configurables, Free automático, cambio manual auditado y bloqueo transaccional de altas por encima del cupo.
- Invitaciones con aceptación por correo verificado y protección del último propietario activo.
- Consultas paginadas de visitas, cupones, canjes y clientes, y creación atómica de tarjetas con recompensa meta.
- Registro de visitas por QR de negocio o sucursal con límite diario por zona horaria.
- Flujo bilateral de alianzas: descubrimiento, propuesta, aceptación, rechazo, finalización y beneficios por negocio, con auditoría, cupos Free/Premium por contraparte y CRUD genérico de alianzas de solo lectura.
- Puntos por lotes con consumo FIFO, expiración configurable y ajustes auditados.
- Tarjetas de visitas repetibles o de una sola vez, con snapshots por ciclo.
- Adquisición idempotente de cupones con stock y canje irreversible iniciado por el cliente.
- Django Admin con los modelos registrados y cuentas staff separadas de los perfiles Benefy.
- PostgreSQL Supabase con SSL para desarrollo/demo y PostgreSQL aislado para pruebas.
- Stripe Checkout/Billing, webhooks idempotentes, Customer Portal, precios 399/3,990 MXN y reconciliación, exclusivamente en Sandbox/Test Mode.
- Comandos `db_info`, `expirar_puntos`, `verificar_puntos`, `configurar_stripe_sandbox`, `reconciliar_stripe` y `reintentar_eliminaciones_cuenta`.
- Pruebas de salud, configuración, autenticación, permisos, membresías, onboarding, invitaciones, portal, planes, límites, concurrencia, operaciones, aislamiento, migración, lealtad, facturación Sandbox y PostgreSQL.

## Producción

La imagen de producción es `Dockerfile.prod`, con Gunicorn, WhiteNoise y un
entrypoint que ejecuta `collectstatic`. Railway detecta `railway.json`; el
procedimiento completo, variables, dominio y migraciones está en
[despliegue en Railway](../docs/despliegue-railway.md) y
[migraciones de producción](../docs/migraciones-produccion.md).

Las migraciones se ejecutan en un release controlado, no en cada réplica. La
service role de Supabase solo se usa en el servidor para eliminar identidades.

Consulta [API](../docs/api.md) para las rutas,
[autenticación](../docs/autenticacion.md) para la matriz de acceso,
[eliminación de cuenta](../docs/eliminacion-cuenta.md),
[avatares](../docs/supabase-storage-avatares.md),
[imágenes de negocio](../docs/supabase-storage-negocios.md),
[despliegue en Railway](../docs/despliegue-railway.md) y
[facturación Stripe Sandbox](../docs/facturacion-stripe-sandbox.md) para el
checkout, webhooks y portal. Las notificaciones push siguen sin integración.
Stripe live, impuestos/CFDI, analítica avanzada y el cliente móvil siguen
pendientes.

## Configuración y operación

La configuración está exclusivamente en el `.env` de la raíz.
`compose.yaml` inyecta las variables necesarias y usa `config.devdemo`,
con Django runserver, orígenes locales restringidos y recarga automática.
No existen archivos de entorno por servicio.

Desde la raíz:

```powershell
python dev.py up
python dev.py check
python dev.py migrate-plan
docker compose logs --tail 50 backend
python dev.py test-backend --local
python dev.py down
```

La API se publica en http://localhost:8001/api/v1 y el Admin en
http://localhost:8001/admin/. Las cuentas staff de Django Admin son distintas
de los perfiles Benefy y de las identidades Supabase.

El arranque no aplica migraciones ni semillas. Una migración remota requiere
revisión expresa del destino y respaldo. Las pruebas utilizan una base local
`test_*` aislada y conservan las pruebas de migración y concurrencia.

La URL y clave publicable de Supabase verifican las sesiones; la service role
solo se usa en el servidor para firmar subidas y administrar/borrar objetos e
identidades. Las contraseñas PostgreSQL y claves administrativas nunca se
envían al navegador. Evita imprimir
`docker compose config` sin `--quiet`: muestra valores privados.

Consulta [la guía de desarrollo](../docs/desarrollo-demo.md) y
[el dataset de demo](../docs/demo-dataset.md).
