# Backend

API Django 5.2 + Django REST Framework. La configuración está en `config/`;
`core/` contiene modelos, serializers, vistas, permisos, servicios y migraciones
de dominio. La entrada de URLs es `config/urls.py`.

## Funcionalidad

- Autenticación con Supabase Auth y permisos según usuario, negocio y sucursal.
- Perfil propio editable con foto validada contra Supabase Storage.
- Onboarding comercial idempotente: perfil, negocio, membresía de dueño y plan
  Free desde una sola captura.
- Directorio de negocios activos para consumidores con búsqueda, filtro por
  categoría y paginación.
- Respuestas móviles enriquecidas con nombre, slug y logo del negocio.
- Aislamiento por sucursal en visitas, registros de actividad, canjes y métricas.
- Planes Free/Premium con límites configurables, Free automático, cambio manual
  auditado y bloqueo transaccional de altas por encima del cupo.
- Invitaciones con aceptación por correo verificado y protección del último
  propietario activo.
- Consultas paginadas de visitas, cupones, canjes y clientes, y creación atómica
  de tarjetas con recompensa meta.
- Registro de visitas por QR de negocio o sucursal con límite diario por zona
  horaria.
- Flujo bilateral de alianzas: descubrimiento, propuesta, aceptación, rechazo,
  finalización y beneficios por negocio, con auditoría y cupos Free/Premium.
- Puntos por lotes con consumo FIFO, expiración configurable y ajustes auditados.
- Tarjetas de visitas repetibles o de una sola vez, con snapshots por ciclo.
- Adquisición idempotente de cupones con stock y canje irreversible iniciado por
  el cliente.
- Baja de cuenta con anonimización, limpieza de avatares y borrado de identidad
  Supabase.
- Django Admin con los modelos registrados y cuentas staff separadas de los
  perfiles Benefy.
- PostgreSQL de Supabase con SSL para producción y PostgreSQL aislado para
  pruebas.
- Stripe Checkout/Billing, webhooks idempotentes, Customer Portal y
  reconciliación, exclusivamente en Sandbox/Test Mode.
- Proxy autenticado de Benef AI con firma HMAC.

Los contratos de API están en [API](../docs/api.md). La identidad y los permisos
están en [identidad y cuentas](../docs/identidad-y-cuentas.md).

## Configuración

La configuración de producción está en las variables del servicio. La plantilla
de referencia es [`backend/.env.production.example`](./.env.production.example).
No subas valores reales al repositorio.

Para desarrollo local, la configuración está exclusivamente en el `.env` de la
raíz y `compose.yaml` inyecta las variables necesarias. Consulta
[desarrollo local](../docs/desarrollo-local.md).

Las claves y secretos relevantes:

- `SECRET_KEY`, `DB_*` y `SUPABASE_SERVICE_ROLE_KEY`: solo servidor.
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`: verificación de sesiones.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_MODE=test`: Sandbox.
- `BENEF_AI_SERVICE_TOKEN`: secreto compartido con Benef AI.
- `THROTTLE_*`: límites por endpoint.

La service role de Supabase solo se usa en el servidor para eliminar identidades
y limpiar avatares.

## Producción

La imagen de producción es `Dockerfile.prod`, con Gunicorn, WhiteNoise y un
entrypoint que ejecuta `collectstatic`. Railway detecta `railway.json`.

El procedimiento completo, variables, dominio, migraciones y rollback está en
[operaciones](../docs/operaciones.md).

Las migraciones se ejecutan en un release controlado, no en cada réplica. No se
aplican seeds ni resets al arrancar.

## Comandos de operación

| Comando | Uso |
| --- | --- |
| `python manage.py db_info` | Comprueba la conexión y el destino de base de datos |
| `python manage.py expirar_puntos` | Procesa expiraciones de puntos |
| `python manage.py verificar_puntos` | Verifica consistencia de saldos y lotes |
| `python manage.py configurar_stripe_sandbox` | Vincula catálogo y Customer Portal de Sandbox |
| `python manage.py reconciliar_stripe` | Reconcilia suscripciones y pagos desde Stripe |
| `python manage.py reintentar_eliminaciones_cuenta` | Reintenta limpieza de cuentas anonimizadas |
| `python manage.py auditar_propietarios` | Auditoría de solo lectura de propiedad única |
| `python manage.py corregir_propietario_unico` | Corrige propietarios con plan revisable |
| `python manage.py crear_cuentas_propietarios` | Crea cuentas verificadas para transferencias |

Los runbooks de propietario único, baja de cuenta y avatares están en
[operaciones](../docs/operaciones.md#runbooks) e
[identidad y cuentas](../docs/identidad-y-cuentas.md).

## Pruebas

La suite de producción se ejecuta contra PostgreSQL aislado:

```bash
python dev.py test-backend --local
```

También se puede ejecutar dentro del contenedor:

```bash
python manage.py test core.tests --noinput
```

Las pruebas de demostración e históricas están separadas en
`backend/optional_tests/` y no forman parte del CI:

```bash
python manage.py test optional_tests
```

No ejecutes pruebas contra el Supabase remoto de producción.
