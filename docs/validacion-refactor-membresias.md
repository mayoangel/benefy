# Validación y despliegue del refactor de membresías

**Fecha:** 15 de noviembre de 2026.
**Rama:** `refactor/usuarios-membresias`.
**Commit base:** `00bf7d9`.
**Entorno:** Supabase PostgreSQL 17.11 y montaje demo con Caddy.

---

## 1. Resultado

El refactor se aplicó correctamente en Supabase:

- Roles globales finales: `consumidor`, `admin_sistema`.
- Roles comerciales: `dueno`, `supervisor`, `empleado`.
- `negocio` y `admin` ya no existen en los datos.
- Todos los usuarios activos pueden consumir.
- `business@benefy.com` conserva su membresía `dueno` y puede consumir y administrar.
- `admin@benefy.com` conserva privilegios globales.
- Las tablas de lealtad no se modificaron durante la migración.

## 2. Preflight

Antes de migrar:

```text
Usuario.rol:          2 admin_sistema, 3 consumidor, 2 negocio
UsuarioNegocio:       2 dueno
Duplicados:           0
Dueno con sucursal:   0
Rama sin sucursal:    0
Sucursal ajena:       0
```

Lealtad existente:

```text
Visitas 3, saldos 2, lotes 4, movimientos 5,
ciclos 5, cupones 4, canjes 1.
```

No se detectaron inconsistencias.

## 3. Respaldo previo

Se generó un respaldo completo del esquema `public` antes de migrar:

```text
C:\Users\angel\AppData\Local\Temp\opencode\benefy-supabase-backup\
  supabase-public-full-20261115-180654.sql
```

- Bytes: `102244`
- SHA256: `2F9720F8B7237BD5D6764C16A8B378DD829321CD261EB63C96B2DA7442A2D142`
- Incluye datos de `core_usuario`, `core_usuarionegocio`, lealtad y demás tablas públicas.

## 4. Migraciones aplicadas

Se detuvieron temporalmente `backend` y `web` para evitar código antiguo durante la conversión. Después se aplicó únicamente:

```text
core.0008_membresias_esquema ... OK
core.0009_membresias_datos ... OK
core.0010_membresias_restricciones ... OK
```

No se ejecutó `flush`, `reset`, eliminación de tablas ni migraciones de otras apps.

Verificación posterior:

```text
showmigrations core: 0001–0010 aplicadas
migrate --plan: sin operaciones pendientes
manage.py check: sin problemas
```

## 5. Estado después de migrar

```text
Usuario.rol:       2 admin_sistema, 5 consumidor, 0 negocio
UsuarioNegocio:    2 dueno, 0 admin, 0 supervisor, 0 empleado
Auth users:        3
```

Las dos membresías `dueno` se conservaron:

- `qa.owner...` → negocio QA.
- `business@benefy.com` → negocio QA.

Restricciones verificadas:

```text
membresia_sucursal_coherente
uniq_membresia_negocio
uniq_membresia_sucursal
```

Los índices únicos parciales existen con el tratamiento correcto de `sucursal NULL`.

## 6. Conservación de lealtad

Inmediatamente después de `0008`–`0010`, los conteos de lealtad eran idénticos a los del preflight:

```text
Visitas 3, saldos 2, lotes 4, movimientos 5,
ciclos 5, cupones 4, canjes 1.
```

Las visitas preexistentes conservaron sus IDs `1`, `2` y `3`.

La prueba automatizada de migración también verifica que:

- `SaldoPuntos.saldo_actual` se conserva.
- `LotePuntos.cantidad_disponible` se conserva.
- `RegistroActividad` permanece válido.
- `CicloTarjeta` conserva sus sellos.
- `CuponUsuario` conserva su estado.
- El antiguo `admin` de sucursal mantiene acceso y operación de su sucursal.
- El `dueno` mantiene control total.
- Las membresías no se pierden.

## 7. Pruebas automatizadas

```text
110 pruebas de core
113 pruebas incluyendo config.test_database_settings
manage.py check: sin problemas
makemigrations --check: sin cambios
```

## 8. E2E con JWT reales

Se usaron logins normales en Supabase Auth y solicitudes HTTPS a Caddy. No se usó `force_authenticate`.

| Usuario | Perfil global | Resultado |
|---|---|---|
| `admin@benefy.com` | `admin_sistema` | Login, perfil, 7 usuarios visibles, métricas 200 |
| `business@benefy.com` | `consumidor` + membresía `dueno` | Membresía, negocio y métricas 200; visita 201; billetera 200 |
| `user@benefy.com` | `consumidor` | Visita 201; billetera 200; métricas 403 |

Resultados: **15/15 correctos**.

También se verificó:

- Sin token: `401`.
- Token alterado: `401`.
- `business@benefy.com` puede consumir y administrar la misma cuenta.
- `admin@benefy.com` conserva el alcance global.
- `user@benefy.com` no accede a métricas del negocio sin membresía.

## 9. Datos creados por el E2E

El E2E agregó datos identificables:

- Visita de `business@benefy.com` al negocio QA.
- Visita de `user@benefy.com` al negocio QA.
- Puntos, lotes, movimientos, ciclos y cupones derivados.

Conteos después del E2E:

```text
Visitas 5, saldos 4, lotes 6, movimientos 7,
ciclos 9, cupones 6, canjes 1.
```

Las visitas nuevas son IDs `4` y `5`; las anteriores `1`–`3` siguen intactas. No se eliminó ningún dato.

## 10. Incidencias

- `backend/.env.production` tenía `SECRET_KEY` vacía. Se reutilizó el secreto del contenedor demo existente para poder construir y ejecutar la imagen nueva. No afectó a Supabase.
- No hubo duplicados, combinaciones inválidas ni fallos de migración.
- `AuditoriaMembresia` quedó con 0 filas porque no hubo membresías `admin` que convertir y el E2E no creó membresías. El servicio y sus pruebas de auditoría sí están implementados.
- No se ejecutaron operaciones destructivas.

## 11. Estado final de Supabase

```text
Migraciones core: 0001–0010
Pendientes: 0
Roles globales: consumidor, admin_sistema
Roles comerciales: dueno, supervisor, empleado
Negocio global: eliminado
Admin comercial: eliminado
Lealtad existente: conservada
Restricciones de membresía: activas
```

## 12. Siguiente paso

La base está lista para el frontend web y la aplicación móvil con el contrato nuevo:

- Consumidor disponible para toda cuenta activa.
- Panel comercial solo con membresía activa.
- `supervisor` en lugar de `admin`.
- `business@benefy.com` como cuenta de prueba para consumo + administración.
- `admin@benefy.com` como administrador global.
- `user@benefy.com` como consumidor sin membresía.
