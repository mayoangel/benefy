# Validación del MVP de lealtad

**Fecha:** 14 de noviembre de 2026.
**Rama:** `feat/lealtad-mvp`.
**Commits relevantes:** `9c37da6` motor de lealtad, `60d2e97` corrección de tarjetas de una sola ocasión.

---

## 1. Entorno validado

| Servicio | Resultado |
|---|---|
| PostgreSQL Supabase | PostgreSQL 17.11, proyecto `rmwwrgahhuztylqkduya` |
| Backend Django/Gunicorn | `healthy`, `/health/db/` responde `database: ok` |
| Caddy + frontend | `healthy`, `https://localhost/` responde `200` |
| API sin token | `401` |
| Django Admin | `302` al login |
| Benef AI | `200` dentro de la red Compose |

Las migraciones `core.0005`–`0007` se aplicaron en Supabase con respaldo previo de esquema. No se usó `flush`, `reset` ni eliminación de tablas. `migrate --plan` quedó vacío y `manage.py check` sin problemas.

---

## 2. Pruebas funcionales del motor

Se ejecutaron 17 comprobaciones contra el backend demo y Supabase. Todas pasaron.

| Área | Resultado |
|---|---|
| Visita inicial con QR de negocio | `201`, puntos y avance de tarjetas |
| Visita duplicada con QR de sucursal | `200`, `already_registered: true`, sin nuevos beneficios |
| Permiso de visita | Rol `negocio` recibe `403` |
| Billetera aislada | Cada consumidor ve solo sus datos |
| Ajuste administrativo | `201`; consumidor recibe `403` |
| Adquisición de cupón | `201`, descuenta puntos y stock |
| Idempotencia | Mismo cupón al reintentar; otra recompensa da `409` |
| Puntos insuficientes | `409 puntos_insuficientes` |
| Sin stock | `409 sin_stock` |
| Cupón ajeno | `403 cupon_ajeno` |
| Canje | `200` con token y 300 s; segundo intento `409` |
| Tarjeta única | No reinicia ciclos |
| Tarjeta repetible | Completa ciclo 1 y crea ciclo 2 |
| Métricas e historial | Dueño `200`; consumidor `403` |
| Consistencia de puntos | `verificar_puntos` sin diferencias |

Los datos de prueba se identifican por el sufijo `20261114192154-72802a`.

---

## 3. E2E de autenticación real

Se usó `admin@benefy.com` con login normal en Supabase Auth. No se usó `force_authenticate`. El JWT real se envió por HTTPS a Caddy y llegó a Django.

| Prueba | Resultado |
|---|---|
| Login Supabase Auth | Correcto, JWT de 3600 s |
| Claims | `iss`, `aud`, `role`, `email`, `exp` e `iat` correctos |
| Asociación Auth → Django | Perfil `id=5`, `admin@benefy.com` |
| Billetera con JWT | `200` |
| Visita con QR | `201`, 10 puntos, tarjetas avanzadas |
| Visita duplicada | `200`, sin puntos |
| Sin token | `401` |
| Firma alterada | `401` |
| Token malformado | `401` |
| `alg=none` con `exp` pasado | `401` |
| Ajuste administrativo como consumidor | `403` |
| Métricas como consumidor | `403` |

Claims observados:

```text
iss = https://rmwwrgahhuztylqkduya.supabase.co/auth/v1
aud = authenticated
role = authenticated
```

Datos generados por el E2E:

```text
Perfil Django: id=5, rol=consumidor
Negocio: 1
Saldo: 10 puntos
Tarjeta única: completada
Tarjeta repetible: 1/2 en curso
Cupón meta: 88969ce9-c87c-4af5-880a-d69ebd31aa45
```

---

## 4. Hallazgos

### Validación del JWT

Django **no valida localmente** firma, emisor ni audiencia. `SupabaseAuthentication` llama a `GET <SUPABASE_URL>/auth/v1/user`; la validación criptográfica y de claims la realiza Supabase. Django solo comprueba UUID, rol `authenticated`, correo confirmado, cuenta no anónima y perfil activo.

Esto funciona y rechaza tokens alterados o malformados, pero si se exige validación local de firma/`iss`/`aud`, queda como tarea pendiente.

### Perfil de `admin@benefy.com`

El alta propia creó el perfil con rol `consumidor`, aunque el correo sea `admin@benefy.com`. Si debe ser `admin_sistema`, requiere una promoción autorizada.

### Usuario manual

El usuario `qa.e2e.20261114113601@example.com` fue creado manualmente antes de la restricción de SQL directo. El usuario indicó que lo eliminó desde el Dashboard; al cierre de esta revisión seguía apareciendo en `auth.users`. Conviene verificarlo nuevamente en el Dashboard.

---

## 5. Datos de prueba restantes

Conteos al cierre:

```text
Usuario 5, CategoriaNegocio 1, Negocio 1, Sucursal 1, UsuarioNegocio 1,
Dinamica 3, Recompensa 5, RegistroActividad 3, CuponUsuario 4, Canje 1,
SaldoPuntos 2, LotePuntos 4, MovimientoPuntos 5, CicloTarjeta 5.
```

No se eliminaron datos de negocio. Los usuarios, visitas, puntos, cupones y canjes de prueba siguen identificados por el prefijo `QA` y el sufijo indicado. Su eliminación requiere autorización.

---

## 6. Integración de clientes

### Frontend web

- Sin cliente HTTP hacia `/api/v1`.
- Sin SDK de Supabase ni sesión real.
- Login simulado con `setTimeout`; registro y recuperación no envían datos.
- Sin dashboard, configuración de dinámicas, catálogo, canje ni métricas.
- Sin generación de claves de idempotencia.

### Aplicación móvil

- Sin cliente API ni Supabase Auth.
- Sin escáner QR.
- Billetera, tarjetas, cupones y dinámicas son datos locales.
- Sin adquisición, canje, historial ni pantalla de validación.
- Sin manejo de tokens, hora del servidor ni idempotencia.

---

## 7. Limitaciones

- No se probó un JWT auténticamente expirado; la vigencia es de 3600 s. Se probó `alg=none` con `exp` pasado.
- La prueba de Caddy cubre HTTPS, health, SPA y API sin token; no hay E2E automatizado en navegador.
- Las llamadas funcionales del motor usaron identidades Django locales; el E2E de Auth usó JWT real.
- La validación de firma/`iss`/`aud` está delegada a Supabase.
