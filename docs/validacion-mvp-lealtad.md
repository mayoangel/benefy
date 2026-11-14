# Validación funcional del motor de lealtad — Supabase

**Fecha:** 14 de noviembre de 2026.
**Rama:** `feat/lealtad-mvp`.
**Commit funcional validado:** `60d2e97` (incluye la corrección de tarjetas de una sola ocasión).
**Entorno:** montaje demo (`compose.demo.yaml`) contra PostgreSQL de Supabase.

---

## 1. Servicios del montaje demo

| Servicio | Verificación | Resultado |
|---|---|---|
| PostgreSQL Supabase | `SELECT current_database(), version()` | `postgres`, PostgreSQL 17.11 |
| Backend Django/Gunicorn | `GET /health/db/` | `200`, `database: ok` |
| Backend, contenedor | `docker compose ps` | `Up (healthy)` |
| Frontend web + Caddy | `GET https://localhost/` | `200`, SPA servida |
| Caddy → API | `GET /api/v1/autenticacion/perfil/` sin token | `401` |
| Caddy → Admin | `GET /admin/` | `302` al login de Django Admin |
| Benef AI | `GET http://127.0.0.1:5000/` dentro del contenedor | `200`, `status: ok` |

Caddy publica `127.0.0.1:80` y `127.0.0.1:443`. Benef AI no tiene puerto público; solo es accesible dentro de la red Compose. Caddy no expone una ruta `/ai/`.

La CA interna de Caddy genera una advertencia normal en el navegador hasta que se confía en ella. No es un fallo de la aplicación.

---

## 2. Migraciones y esquema

Antes de la validación se confirmó:

- Proyecto Supabase: `rmwwrgahhuztylqkduya`.
- Host: `aws-1-us-west-1.pooler.supabase.com`.
- Base: `postgres`.
- Migraciones `core.0001`–`0004` ya aplicadas.
- Plan pendiente: solo `core.0005`, `0006` y `0007`.
- Cero registros en las 20 tablas de `core`.

Se generó un respaldo de esquema antes de migrar y se aplicaron las tres migraciones autorizadas. Después:

- `core.0001`–`0007` aparecen aplicadas.
- `migrate --plan` no tiene operaciones pendientes.
- `manage.py check` no reporta problemas.
- Las tablas, columnas y restricciones nuevas existen.
- No se usó `flush`, `reset` ni eliminación de tablas.

Los respaldos están en:

```text
C:\Users\angel\AppData\Local\Temp\opencode\benefy-supabase-backup\
  supabase-public-schema-20261114-110230.sql
  supabase-public-schema-post-20261114-110448.sql
```

---

## 3. Datos de prueba creados

Los datos son identificables por el sufijo `20261114192154-72802a` y por el prefijo `QA`:

| Entidad | Identificador | Uso |
|---|---|---|
| Usuario admin QA | `1` | Ajustes de puntos y permisos de sistema |
| Usuario dueño QA | `2` | Permisos de negocio y métricas |
| Consumidor QA 1 | `3` | Visitas, puntos, tarjetas, adquisición y canje |
| Consumidor QA 2 | `4` | Aislamiento de billetera y cupón ajeno |
| Negocio QA | `1` | Negocio de prueba |
| Sucursal QA | `1` | QR alternativo de sucursal |
| Dinámica de puntos | `1` | 10 puntos por visita |
| Tarjeta única | `2` | Meta 1, no repetible |
| Tarjeta repetible | `3` | Meta 2, repetible |
| Recompensa de catálogo | `3` | Costo 10 puntos, stock 1 |

Cupones creados:

| UUID | Origen | Estado |
|---|---|---|
| `75056018-ca1e-443b-9f13-88a7096684b3` | Meta de tarjeta única | `disponible` |
| `6b234cc1-380f-42c5-ae6f-9d436b9b6fac` | Catálogo con puntos | `canjeado` |
| `c96f6fd0-3be7-415d-9ac8-5e33a811bc61` | Meta de tarjeta repetible | `disponible` |

Conteos posteriores:

```text
Usuario 4, CategoriaNegocio 1, Negocio 1, Sucursal 1, UsuarioNegocio 1,
Dinamica 3, Recompensa 5, RegistroActividad 2, CuponUsuario 3, Canje 1,
SaldoPuntos 1, LotePuntos 3, MovimientoPuntos 4, CicloTarjeta 3.
```

No se eliminaron ni modificaron estos datos después de la prueba. Su eliminación requiere autorización expresa.

---

## 4. Resultados funcionales

Se ejecutaron 17 comprobaciones contra el backend demo y Supabase. Todas pasaron.

| # | Prueba | Resultado |
|---|---|---|
| 1 | Billetera sin token | `401` |
| 2 | Visita inicial con QR de negocio | `201`, 10 puntos, tarjeta única completada, tarjeta repetible 1/2, saldo 10, 1 cupón meta |
| 3 | Visita duplicada con QR de sucursal | `200`, `already_registered: true`, 0 puntos, una sola visita válida, saldo sin cambios |
| 4 | Usuario con rol negocio intenta registrar visita | `403` |
| 5 | Billetera aislada entre consumidores | Consumidor 1 ve su cupón y saldo; consumidor 2 no ve datos ajenos |
| 6 | Ajuste administrativo de puntos | `201`, saldo 30 |
| 7 | Consumidor intenta ajustar puntos | `403` |
| 8 | Adquisición de cupón con puntos | `201`, saldo 20, stock 0 |
| 9 | Reintento con la misma clave de idempotencia | `200`, mismo cupón, sin doble descuento |
| 10 | Misma clave con otra recompensa | `409 conflicto_idempotencia` |
| 11 | Recompensa con costo superior al saldo | `409 puntos_insuficientes` |
| 12 | Recompensa sin stock | `409 sin_stock` |
| 13 | Consumidor intenta canjear cupón ajeno | `403 cupon_ajeno` |
| 14 | Canje propio y segundo intento | `200` con token y 300 s; segundo intento `409 cupon_no_disponible` |
| 15 | Tarjeta única y tarjeta repetible | Única conserva un solo ciclo; repetible crea ciclo 2; 2 cupones meta |
| 16 | Permisos de métricas e historial | Dueño `200`; consumidor `403`; historial con 2 visitas y 1 canje |
| 17 | Clave de adquisición reutilizada en ajuste | `409 conflicto_idempotencia` |

Además, `manage.py verificar_puntos` respondió:

```text
Todos los saldos son consistentes.
```

### Corrección detectada durante la validación

Se detectó que una tarjeta de una sola ocasión ya completada podía iniciar un ciclo nuevo en una visita posterior si la dinámica seguía activa. Se corrigió el servicio y se agregó una prueba. El cambio quedó en el commit `60d2e97`; no modificó modelos, reglas ni migraciones.

---

## 5. Limitaciones de la prueba

- Las llamadas autenticadas se ejecutaron con `APIClient.force_authenticate` dentro del backend demo, usando identidades Django locales. Esto valida endpoints, permisos y persistencia en Supabase, pero **no valida el transporte de un JWT real de Supabase**.
- No se crearon usuarios en Supabase Auth porque el entorno solo tiene la clave publicable y no se dispone de una identidad de prueba confirmada.
- La prueba de Caddy cubre health, SPA, API sin token y Admin. No se ejecutó un navegador E2E con sesión real.
- Las visitas del segundo día se simularon inyectando `ahora` en el servicio, porque el límite diario impide dos visitas el mismo día. La fila de auditoría `fecha` conserva la hora real y `fecha_negocio` refleja el día simulado.

---

## 6. Integración del frontend web

### Lo que funciona

- SPA React servida por Caddy.
- Rutas públicas: `/`, `/about`, `/precios`, `/login`, `/registro`, `/recuperar`.
- Proxy de Caddy hacia `/api/*`, `/admin/*`, `/static/*` y `/health/*`.
- Formularios visuales de login, registro y recuperación.

### Lo que no está integrado

| Funcionalidad | Estado |
|---|---|
| Cliente HTTP de la API | No existe; no hay `fetch` ni `axios` hacia `/api/v1` |
| Supabase Auth | No hay SDK de Supabase ni sesión real |
| Login | Simulado con `setTimeout`; no llama a Supabase |
| Registro | Solo valida el formulario; `handleSubmit` no envía datos |
| Recuperación de contraseña | Sin integración con Auth |
| Dashboard del negocio | No existe ruta ni pantalla |
| Configuración de dinámicas, metas y recompensas | No existe |
| Clientes, visitas y puntos | No existen pantallas de consulta |
| Catálogo y adquisición de cupones | No existen pantallas |
| Canje y pantalla de validación | No existen |
| Métricas | No existe dashboard; el endpoint está disponible |
| Generación de claves de idempotencia | No implementada en el cliente |
| Sincronización de hora del servidor | No implementada |

El archivo `frontend-web/src/lib/submitLead.ts` está vacío. El título HTML de la SPA todavía es `frontend-web`, un detalle de presentación pendiente.

---

## 7. Integración de la aplicación móvil

### Lo que funciona

- Dashboard Expo con pestañas de Inicio, Dinámicas, Cupones y Billetera.
- Datos de demostración locales para marcas, visitas, cupones y puntos.

### Lo que no está integrado

| Funcionalidad | Estado |
|---|---|
| Cliente HTTP de la API | No existe |
| Supabase Auth | No existe; no hay login ni sesión |
| Escáner QR | No hay cámara ni librería de escaneo |
| Registro de visita | No existe; los datos son locales |
| Billetera real | Datos hardcodeados |
| Tarjetas y progreso | Datos hardcodeados |
| Catálogo de recompensas | Datos hardcodeados |
| Adquisición de cupones | No existe |
| Canje y pantalla de validación | No existen |
| Historial real | No existe |
| Generación de claves de idempotencia | No existe |
| Hora del servidor y contador de canje | No existen |
| Notificaciones/push | No existen |
| Almacenamiento seguro de tokens | No existe |

Las rutas `src/app/index.tsx`, `wallet.tsx`, `coupons.tsx` y `dynamics.tsx` renderizan el mismo componente local `App.tsx`.

---

## 8. Estado real de integración

| Capa | Estado |
|---|---|
| Base de datos y migraciones | Completa en local y Supabase |
| Motor de lealtad backend | Implementado y validado funcionalmente |
| API de lealtad | Implementada y probada con identidades Django |
| Autenticación real de clientes | Backend listo; clientes sin integrar |
| Frontend web | Landing y auth simulada; sin dashboard ni API |
| Aplicación móvil | Demo visual local; sin API, Auth, QR ni canje |
| Panel de administración | Django Admin disponible; no hay panel de producto |
| Operación periódica de puntos | Comando disponible; falta programarlo en producción |
| Alianzas, NFC, QR dinámico | Fuera del MVP |

**Conclusión:** el backend del MVP está funcional y persistido en Supabase. La brecha principal ya no es el motor, sino la integración de los clientes y la operación del panel.

---

## 9. Tareas pendientes priorizadas para el MVP

### Prioridad 1 — Desbloquear el flujo del consumidor

1. Integrar Supabase Auth en la app móvil: login, refresh, cierre de sesión y creación de perfil.
2. Crear cliente API móvil con manejo de errores, `codigo` y timeout.
3. Implementar escáner QR y llamada a `POST /visitas/registrar/`.
4. Mostrar billetera real, tarjetas, cupones e historial desde `/mi/billetera/` y `/mi/historial/`.
5. Implementar catálogo y adquisición con clave de idempotencia generada por operación.
6. Implementar canje y pantalla de validación con `token_validacion`, `expira_en` y hora del servidor.
7. Probar el flujo completo con un JWT real de Supabase y HTTPS.

### Prioridad 2 — Panel web del negocio

8. Integrar Supabase Auth en la web y proteger rutas.
9. Crear dashboard con métricas del negocio.
10. CRUD visual de dinámicas, tarjetas, recompensas, stock y vigencias.
11. Consulta de clientes, visitas, saldos, cupones y canjes.
12. Advertencias al desactivar dinámicas o recompensas.
13. Herramientas de anulación auditada para visitas y cupones.

### Prioridad 3 — Operación y confiabilidad

14. Programar `expirar_puntos` en producción (cron, systemd o tarea del proveedor).
15. Monitoreo de salud, errores y latencia; alertas de stock y vencimientos.
16. Respaldos automáticos y procedimiento de restauración.
17. Paginación y filtros en listados; pruebas E2E en CI.
18. Revisar exposición de la Data API de Supabase y privilegios de tablas.

### Prioridad 4 — Después del MVP

19. Alianzas con beneficios cruzados y puntos compartidos.
20. NFC.
21. QR dinámicos o regenerables.
22. Analíticas avanzadas y notificaciones push.
23. Integración con Stripe y facturación.

---

## 10. Autorizaciones pendientes

- Eliminar los datos QA identificados en la sección 3.
- Ejecutar cualquier cambio estructural adicional en Supabase.
- Crear usuarios de prueba en Supabase Auth para una prueba E2E con JWT real.

Sin autorización expresa no se eliminarán registros ni se modificarán tablas.
