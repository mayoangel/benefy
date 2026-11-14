# Validación E2E de autenticación real — Supabase Auth + Django

**Fecha:** 14 de noviembre de 2026.
**Entorno:** montaje demo (`compose.demo.yaml`) con Caddy en `https://localhost`.
**Usuario de prueba:** `admin@benefy.com`.
**Perfil Django:** `core_usuario.id = 5`, rol `consumidor`.
**Método:** login normal con email y contraseña en Supabase Auth; JWT real; solicitudes HTTPS a Caddy; sin `force_authenticate`.

---

## 1. Resultado general

- Login normal en Supabase Auth: **correcto**.
- JWT real obtenido: **sí**, duración 3600 segundos.
- Perfil Django asociado por `supabase_uid`: **correcto**.
- Solicitudes HTTPS reales contra Caddy: **correctas**.
- Pruebas ejecutadas: **12/12 correctas**.
- No se modificó el esquema de Supabase.
- No se eliminó ningún registro.

## 2. Claims del JWT real

| Claim | Valor |
|---|---|
| `iss` | `https://rmwwrgahhuztylqkduya.supabase.co/auth/v1` |
| `aud` | `authenticated` |
| `role` | `authenticated` |
| `email` | `admin@benefy.com` |
| `sub` | `2770e58b-ef32-4528-b4e9-6e58ff0f82fa` |
| `exp` | 3600 segundos desde la emisión |
| `iat` | Válido al momento de la prueba |

Supabase `/auth/v1/user` devolvió:

```text
user_id: 2770e58b-ef32-4528-b4e9-6e58ff0f82fa
email: admin@benefy.com
role: authenticated
aud: authenticated
email_confirmed_at: 2026-11-14T19:43:12.722013Z
is_anonymous: false
```

## 3. Asociación con Django

El usuario Auth no tenía perfil Django. Se creó mediante el flujo oficial:

```http
POST https://localhost/api/v1/usuario/crear/
Authorization: Bearer <JWT real>
Content-Type: application/json

{"nombre":"Admin","apellido":"Benefy"}
```

Resultado: `201`, perfil `id=5`, `correo=admin@benefy.com`, `rol=consumidor`.

La solicitud autenticada posterior a `/api/v1/autenticacion/perfil/` devolvió `200` con el mismo `id` y correo, confirmando la asociación `Usuario.supabase_uid = auth.users.id`.

> El alta propia siempre asigna `rol=consumidor`, aunque el correo sea `admin@benefy.com`. Si se esperaba `admin_sistema`, requiere una promoción autorizada posterior.

## 4. Pruebas ejecutadas

| # | Prueba | Resultado |
|---|---|---|
| 1 | Claims del JWT real | `iss`, `aud`, `role`, `email`, `exp` e `iat` correctos |
| 2 | Perfil Django asociado | `200`, `id=5`, `admin@benefy.com` |
| 3 | Billetera antes de la visita | `200`, sin saldos ni cupones |
| 4 | Visita con QR válido | `201`, 10 puntos, tarjeta única completada, tarjeta repetible 1/2 |
| 5 | Visita duplicada | `200`, `already_registered: true`, 0 puntos |
| 6 | Billetera después de la visita | `200`, saldo 10, tarjeta repetible en curso, 1 cupón meta |
| 7 | Billetera sin token | `401` |
| 8 | Token con firma alterada | `401` |
| 9 | Token malformado | `401` |
| 10 | Token `alg=none` con `exp` pasado | `401` |
| 11 | Consumidor intenta ajuste administrativo | `403` |
| 12 | Consumidor intenta métricas del negocio | `403` |

Datos generados por la visita:

```text
Negocio: 1
Saldo: 10 puntos
Tarjeta única: ciclo 4, completado
Tarjeta repetible: ciclo 5, 1/2 sellos, en curso
Cupón meta: 88969ce9-c87c-4af5-880a-d69ebd31aa45
```

## 5. Hallazgo sobre la validación del token

Django **no verifica localmente** la firma, el emisor ni la audiencia del JWT. `SupabaseAuthentication` llama a:

```text
GET <SUPABASE_URL>/auth/v1/user
```

con el bearer token y la clave publicable. La validación criptográfica y de claims la realiza Supabase Auth; Django solo comprueba:

- Que la respuesta sea un usuario válido.
- Que el UUID sea válido.
- Que `role = authenticated`.
- Que `email_confirmed_at` exista.
- Que la cuenta no sea anónima.
- Que exista o no un perfil Django y que esté activo.

Por tanto:

- Un token alterado, malformado o `alg=none` es rechazado con `401`.
- Un token real es aceptado.
- La expiración, emisor y audiencia son validados por Supabase, no por código local de Django.
- No se probó un token auténticamente expirado porque la vigencia es de 3600 segundos. Se probó un token `alg=none` con `exp` pasado, que fue rechazado.

**Si el requisito es validación local de firma/iss/aud en Django, es una tarea pendiente.** La implementación actual depende de la disponibilidad de Supabase Auth para cada petición.

## 6. Eliminación del usuario manual

El usuario creado manualmente antes de la prohibición de SQL directo sigue existiendo:

```text
Email: qa.e2e.20261114113601@example.com
ID:    17488251-e0ed-4a79-846b-6429cc73bb36
```

No se eliminó porque:

- No hay `SUPABASE_SERVICE_ROLE_KEY` ni `sb_secret_...` en el entorno.
- El JWT de `admin@benefy.com` no tiene permisos administrativos:
  `GET /auth/v1/admin/users` devuelve `403 not_admin`.
- La instrucción vigente prohíbe modificaciones SQL directas en `auth.users` y `auth.identities`.

Se necesita una de estas opciones:

1. Proporcionar una clave administrativa de Supabase en un archivo temporal seguro.
2. Crear/eliminar el usuario desde el Dashboard.
3. Autorizar expresamente un `DELETE` puntual por SQL sobre ese único usuario y sus filas dependientes.

No se eliminará hasta recibir una de esas autorizaciones.

## 7. Archivos temporales

Contienen credenciales o tokens y no están versionados:

```text
C:\Users\angel\AppData\Local\Temp\opencode\benefy-e2e-admin-token.txt
C:\Users\angel\AppData\Local\Temp\opencode\benefy-e2e-auth.json
C:\Users\angel\AppData\Local\Temp\opencode\benefy-e2e-token.txt
```

Se pueden eliminar cuando se cierre la validación.

## 8. Conclusión

La autenticación real de Supabase funciona de extremo a extremo con el montaje demo: login, JWT, asociación con Django, HTTPS, billetera y visita QR. La brecha principal es que la validación criptográfica del token está delegada a Supabase y no se ejecuta localmente en Django. La eliminación del usuario manual queda pendiente por falta de credencial administrativa y por la restricción de no usar SQL directo.
