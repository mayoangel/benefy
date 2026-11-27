# Imágenes de negocios en Supabase Storage

Los logos y banners se guardan en el bucket público `business-assets`. El
backend autoriza cada subida con una URL firmada de Supabase Storage; el
cliente no recibe ni necesita la service role key.

## Políticas del bucket

Permite lectura pública con una política `SELECT` sobre
`bucket_id = 'business-assets'`. No agregues políticas `INSERT`, `UPDATE` ni
`DELETE` para `anon` o `authenticated`: la relación entre usuario y dueño del
negocio vive en Django. El endpoint de autorización la comprueba antes de
emitir el token firmado.

Las URLs firmadas se limitan a un objeto concreto, no permiten sobrescribirlo y
expiran a las dos horas. La aplicación debe subir mediante
`uploadToSignedUrl(path, token, archivo, { contentType, upsert: false })`.

## Rutas y límites

```text
businesses/{negocio_id}/logo/{uuid}.{jpg|png|webp}
businesses/{negocio_id}/banner/{uuid}.{jpg|png|webp}
```

El endpoint valida el tipo y el tamaño declarado antes de emitir la firma.
Supabase aplica además el límite de 5 MB y la lista de MIME permitidos al
archivo subido. Al guardar `logo_url` o `banner_url`, Django verifica que la URL
corresponda al host, bucket, negocio y tipo esperados y hace `HEAD` para
comprobar existencia, MIME y tamaño.

## Flujo API

1. El dueño solicita `POST /api/v1/negocios/{id}/imagenes/subida/` con
   `tipo` (`logo` o `banner`), `content_type` y `size_bytes`.
2. Django confirma el permiso de administración del negocio y devuelve `bucket`,
   `path`, `token`, `public_url`, `content_type`, `max_bytes` y `expires_in`.
3. El cliente sube los bytes a Storage usando `uploadToSignedUrl`.
4. El cliente envía `public_url` en
   `PATCH /api/v1/negocio/actualizar/{id}/` como `logo_url` o `banner_url`.
5. Django comprueba el objeto y guarda la URL.

El token firmado tiene una vigencia de dos horas; el rate limit para solicitar
firmas es 20 por hora y usuario. Si se sube el objeto pero falla el paso 4,
queda un objeto huérfano que deberá limpiarse por una tarea de mantenimiento
futura.

## Variables

```dotenv
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<solo-en-el-servidor>
SUPABASE_STORAGE_BUCKET_BUSINESS_ASSETS=business-assets
SUPABASE_STORAGE_MAX_BYTES=5242880
SUPABASE_STORAGE_ALLOWED_TYPES=image/jpeg,image/png,image/webp
THROTTLE_NEGOCIO_IMAGEN_SUBIDA=20/hour
```

`SUPABASE_SERVICE_ROLE_KEY` debe permanecer exclusivamente en el backend. No
se necesita una migración de base de datos: se reutilizan `Negocio.logo_url` y
`Negocio.banner_url`.
