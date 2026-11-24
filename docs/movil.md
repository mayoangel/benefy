# Aplicación móvil Benefy

La app Expo/React Native consume la API real de Django y Supabase Auth. Las
pantallas normales no usan datos de demostración: si una consulta falla, la
interfaz muestra el error y permite reintentar.

## Arquitectura

- **Expo Router** define las rutas en `mobile-app/src/app/`.
- **Supabase Auth** administra el registro, el inicio de sesión, el refresco de
  tokens y la recuperación de contraseña. La app nunca envía contraseñas a
  Django.
- **Django REST** es la fuente de verdad de perfil, directorio, lealtad,
  cupones, notificaciones y baja de cuenta.
- **React Query** mantiene la caché de las consultas autenticadas y la
  invalida después de visitas, adquisiciones, canjes y cambios de perfil.
- `AuthProvider` no renderiza las rutas privadas hasta que el perfil local de
  Django existe. Si una identidad nueva recibe `403`, el cliente crea el perfil
  con los metadatos del registro; un `409` indica que otra petición ya lo creó.
- `apiRequest` agrega el bearer, aplica un tiempo límite de 15 segundos y, ante
  un `401`, intenta refrescar la sesión una sola vez con Supabase.

## Configuración

Crea `mobile-app/.env` a partir de `.env.example`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave publicable>
EXPO_PUBLIC_API_URL=http://<ip-lan>:8000/api
EXPO_PUBLIC_TERMS_URL=
EXPO_PUBLIC_PRIVACY_URL=
```

`EXPO_PUBLIC_API_URL` debe terminar en `/api`; el cliente agrega `/v1/...`.
También tolera una base configurada por error como `/api/v1`. En un teléfono
físico, `localhost` apunta al teléfono: usa la IP LAN del equipo que ejecuta
Django y revisa el firewall. Con Docker Compose el backend se publica en el
puerto `8001`.

Las variables `EXPO_PUBLIC_*` son públicas. Nunca coloques ahí la service role
key, contraseñas de PostgreSQL ni secretos de Stripe.

## Matriz de pantallas y endpoints

| Pantalla / ruta | Endpoints principales | Uso |
| --- | --- | --- |
| Inicio `(tabs)/index` | `GET /v1/autenticacion/perfil/`, `GET /v1/mi/billetera/`, `GET /v1/notificaciones/listar/` | Saldo, tarjetas, premios listos y avisos sin leer |
| Explorar `explore` | `GET /v1/negocios/descubrir/?q=&categoria=&page=&page_size=` | Directorio paginado de negocios activos |
| Detalle `business/[id]` | `GET /v1/negocios/{id}/catalogo/` | Datos públicos, sucursales y recompensas |
| Tienda `shop/[id]` | `GET /v1/negocios/{id}/catalogo/`, `GET /v1/mi/billetera/` | Catálogo y saldo del negocio |
| Aliados `business-allies/[id]` | Igual que tienda | Filtra recompensas con `es_alianza` |
| Recompensa `reward/[id]` | `POST /v1/cupones/adquirir/` | Compra idempotente con `clave_idempotencia` |
| Mis cupones `coupons` | `GET /v1/cupones-usuario/listar/` | Cupones disponibles e historial |
| Detalle de cupón `coupon/[id]` | `GET /v1/cupones-usuario/listar/` | Consulta por UUID |
| Canje `redeem/[id]` | `POST /v1/cupones/{uuid}/canjear/` | Genera el token temporal de validación |
| Cartera `(tabs)/wallet` | `GET /v1/mi/billetera/`, `GET /v1/cupones-usuario/listar/` | Saldos, tarjetas y cupones |
| Mis tarjetas `dynamics` | `GET /v1/mi/billetera/` | Progreso de sellos por ciclo |
| Historial `history` | `GET /v1/mi/historial/` | Visitas, movimientos de puntos y canjes |
| Notificaciones `notifications` | `GET /v1/notificaciones/listar/`, `PATCH /v1/notificacion/actualizar/{id}/` | Bandeja y marcado de lectura |
| Perfil `(tabs)/profile` | `GET /v1/autenticacion/perfil/`, `GET /v1/mi/billetera/` | Datos reales, métricas y QR de miembro |
| Editar perfil `profile-edit` | `PATCH /v1/autenticacion/perfil/` | Nombre, apellido, teléfono y foto |
| Foto de perfil | Supabase Storage `avatars/{uid}/...` + `PATCH` del perfil | Subida directa con RLS y validación en Django |
| Eliminar cuenta `delete-account` | `POST /v1/mi/cuenta/eliminar/` | Baja idempotente y cierre de sesión |
| Registrar `(tabs)/register` | `POST /v1/visitas/resolver/`, `POST /v1/visitas/registrar/` | Lector QR real |
| Confirmar visita `scan/confirm` | `POST /v1/visitas/registrar/` | Confirma comercio y registra la visita |
| Resultado `scan/success` | Respuesta de la visita | Puntos, sellos y cupones emitidos |
| Configuración, ayuda, legal, privacidad | Sin API de negocio | Preferencias locales y documentos vía `EXPO_PUBLIC_*` |

`GET /v1/mi/contexto/` existe para el portal web y no se usa en el flujo móvil.

## Reglas de estado

- La visita invalida billetera, cupones, historial y notificaciones.
- La adquisición invalida billetera, cupones y catálogo.
- El canje invalida billetera, cupones, historial y notificaciones.
- El perfil actualizado se escribe directamente en la caché de React Query.
- La baja de cuenta limpia toda la caché y cierra la sesión de Supabase.
- Los filtros de historial y cupones se aplican en el cliente sobre datos ya
  autorizados por el servidor; nunca se confía en IDs enviados por el usuario
  para autorizar recursos.

## Verificación

Desde `mobile-app/`:

```bash
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android
```

Resultados de la entrega actual:

- **29 pruebas Jest OK** para cliente API, perfiles, lealtad y Storage.
- **TypeScript OK**.
- **ESLint OK** (`npx eslint .` y `npm run lint`).
- **Expo Doctor: 20/20**.
- **Bundle Android exportado** con Expo Router (1,407 módulos).
- **Backend: 318 pruebas OK** en un contenedor aislado con PostgreSQL local.

Las pruebas del backend se ejecutaron dentro de la red de Docker con
`DB_HOST=postgres`, sin tocar la base remota de negocio.

## Limitaciones conocidas

- El bucket `avatars` y sus políticas RLS deben aplicarse con
  [el SQL de Storage](./sql/avatars_storage.sql) usando un rol
  administrador de Supabase. Sin ese paso, la app muestra un error accionable y
  el resto de la aplicación sigue funcionando.
- La entrega de notificaciones push no forma parte de este MVP; la bandeja y
  las preferencias locales sí están conectadas a los datos reales.
- Los documentos legales requieren `EXPO_PUBLIC_TERMS_URL` y
  `EXPO_PUBLIC_PRIVACY_URL`.
- No hay persistencia offline de la cartera. React Query conserva la caché en
  memoria durante la sesión.
- No se ejecutó una prueba E2E en emulador o dispositivo físico; el bundle
  Android se verificó con `expo export`. La lista manual recomendada es:
  registro, confirmación de correo, alta automática del perfil, visita QR,
  compra de cupón, canje, historial, edición de perfil y baja de cuenta.
