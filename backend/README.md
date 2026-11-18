# Backend

API Django 5.2 + Django REST Framework. La configuración está en `config/`;
`core/` contiene 25 modelos, serializers, vistas, permisos y quince migraciones
de dominio. La entrada de URLs es `config/urls.py`.

## Funcionalidad disponible

- 80 rutas CRUD, cuatro rutas de identidad/contexto/onboarding y 22 rutas de lealtad, planes, operaciones e invitaciones.
- Verificación de sesiones Supabase Auth y permisos según usuario, negocio y sucursal.
- Onboarding comercial idempotente: perfil, negocio, membresía de dueño y plan Free desde una sola captura.
- Aislamiento por sucursal en visitas, registros de actividad, canjes y métricas; los cupones globales solo los ve el dueño.
- Planes Free/Premium con límites configurables, Free automático, cambio manual auditado y bloqueo transaccional de altas por encima del cupo.
- Invitaciones con aceptación por correo verificado y protección del último propietario activo.
- Consultas paginadas de visitas, cupones, canjes y clientes, y creación atómica de tarjetas con recompensa meta.
- Registro de visitas por QR de negocio o sucursal con límite diario por zona horaria.
- Puntos por lotes con consumo FIFO, expiración configurable y ajustes auditados.
- Tarjetas de visitas repetibles o de una sola vez, con snapshots por ciclo.
- Adquisición idempotente de cupones con stock y canje irreversible iniciado por el cliente.
- Django Admin con los modelos registrados y cuentas staff separadas de los perfiles Benefy.
- PostgreSQL Supabase con SSL para desarrollo/demo y PostgreSQL aislado para pruebas.
- Comandos `db_info`, `expirar_puntos` y `verificar_puntos`.
- Pruebas de salud, configuración, autenticación, permisos, membresías, onboarding, invitaciones, portal, planes, límites, concurrencia, operaciones, aislamiento, migración, lealtad y PostgreSQL.

Consulta [API](../docs/api.md) para las rutas y
[autenticación](../docs/autenticacion.md) para los payloads y la matriz de acceso.
Los modelos de Stripe y notificaciones no implican que esas integraciones estén
implementadas. El portal web incluye CRUD comercial y consultas operativas; los
detalles avanzados de Stripe, analítica, alianzas y el cliente móvil siguen
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

La URL y clave publicable de Supabase verifican las sesiones; las contraseñas
PostgreSQL y claves administrativas nunca se envían al navegador. Evita imprimir
`docker compose config` sin `--quiet`: muestra valores privados.

Consulta [la guía de desarrollo](../docs/desarrollo-demo.md) y
[el dataset de demo](../docs/demo-dataset.md).
