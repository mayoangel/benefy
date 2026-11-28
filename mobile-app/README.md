# Aplicación móvil Benefy

Aplicación Expo SDK 58 con React Native, React 19, TypeScript y Expo Router,
orientada a consumidores de Benefy. La navegación principal incluye Inicio,
Cartera, Registrar y Perfil, además del directorio, tienda de cupones, detalle de
recompensas, canje, historial, notificaciones y configuración.

## Estado del código

Todas las pantallas normales consumen la API real de Django y Supabase Auth. No
se usa `preview.tsx` ni un panel de demostración en los flujos actuales.

- **Autenticación:** Supabase Auth para registro, login, refresco de token y
  recuperación de contraseña. Django valida el bearer en cada request.
- **Perfil:** se consulta en `GET /api/v1/autenticacion/perfil/`. Si una
  identidad nueva aún no tiene perfil local, se crea automáticamente con los
  metadatos del registro. La edición usa `PATCH` y la foto se sube a Supabase
  Storage antes de guardar la URL.
- **Inicio y cartera:** saldos, tarjetas y cupones reales de
  `GET /api/v1/mi/billetera/` y `GET /api/v1/cupones-usuario/listar/`.
- **Directorio y catálogo:** `GET /api/v1/negocios/descubrir/` y
  `GET /api/v1/negocios/{id}/catalogo/`, con búsqueda, categorías, sucursales y
  recompensas.
- **Cupones:** adquisición idempotente, canje con token temporal y detalle por
  UUID. La cartera y el historial se invalidan tras cada operación.
- **Registro de visitas:** la pestaña Registrar usa la cámara para leer el
  `qr_uuid` real del negocio o sucursal, resuelve el comercio y registra la
  visita con la sesión de Supabase. No se guardan imágenes.
- **Historial y notificaciones:** visitas, movimientos, canjes y bandeja real;
  las notificaciones se marcan como leídas en Django.
- **Baja de cuenta:** confirmación explícita, anonimización y cierre de sesión.
  Si Storage o Supabase Auth quedan pendientes, la API responde `202` y la app
  informa el estado.
- **Preferencias locales:** tema y avisos del dispositivo. La entrega de push
  requiere integración de servidor y queda fuera del alcance actual.

## Arquitectura

- **Expo Router** define las rutas en `src/app/`.
- **Supabase Auth** administra el registro, el inicio de sesión, el refresco de
  tokens y la recuperación de contraseña. La app nunca envía contraseñas a
  Django.
- **Django REST** es la fuente de verdad de perfil, directorio, lealtad, cupones,
  notificaciones y baja de cuenta.
- **React Query** mantiene la caché de las consultas autenticadas y la invalida
  después de visitas, adquisiciones, canjes y cambios de perfil.
- `AuthProvider` no renderiza las rutas privadas hasta que el perfil local de
  Django existe. Si una identidad nueva recibe `403`, el cliente crea el perfil
  con los metadatos del registro; un `409` indica que otra petición ya lo creó.
- `apiRequest` agrega el bearer, aplica un tiempo límite de 15 segundos y, ante un
  `401`, intenta refrescar la sesión una sola vez con Supabase.

## Configuración

Crea `mobile-app/.env` a partir de [.env.example](./.env.example):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave publicable>
EXPO_PUBLIC_API_URL=https://<api-host>/api
EXPO_PUBLIC_TERMS_URL=
EXPO_PUBLIC_PRIVACY_URL=
```

`EXPO_PUBLIC_API_URL` debe terminar en `/api`; el cliente agrega `/v1/...`.
También tolera una base configurada por error como `/api/v1`. Para un teléfono
físico en desarrollo, `localhost` apunta al teléfono: usa la IP LAN del equipo
que ejecuta Django y revisa el firewall. Con Docker Compose el backend se publica
en el puerto `8001`; con `runserver` local, en `8000`.

Las variables `EXPO_PUBLIC_*` son públicas. Nunca coloques ahí la service role
key, contraseñas de PostgreSQL ni secretos de Stripe. Configura la plantilla de
recuperación de Supabase para enviar el código OTP que solicita la pantalla de
recuperación. La app se ejecuta fuera de Docker.

## Pantallas y endpoints

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

## Desarrollo

Desde `mobile-app/`:

```bash
npm ci
npm run start
```

| Comando | Uso |
| --- | --- |
| `npm run start` | Inicia Metro/Expo; normalmente usa el puerto 8081 |
| `npm run android` | Abre el proyecto en Android |
| `npm run ios` | Abre el proyecto en iOS; depende del entorno disponible |
| `npm run web` | Inicia el destino web si están instaladas sus dependencias |
| `npm run lint` | Ejecuta `expo lint` |
| `npm run typecheck` | Ejecuta `tsc --noEmit` |
| `npm test` | Ejecuta Jest con `jest-expo` |
| `npx expo-doctor` | Revisa dependencias y configuración de Expo |
| `npx expo export --platform android` | Verifica el bundle de producción |

En PowerShell puedes usar `npm.cmd` y `npx.cmd` si la ejecución de scripts está
deshabilitada. Para agregar paquetes usa `npx expo install <paquete>` y consulta
las [referencias de SDK 58](https://docs.expo.dev/versions/v58.0.0/).

## Producción

La app se publica con EAS. El repositorio no incluye `eas.json`; créalo y
configura los perfiles de build y submit según el proyecto de Expo antes de
publicar. Los comandos habituales son:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Antes de publicar:

1. Configura las variables `EXPO_PUBLIC_*` del entorno de build.
2. Verifica que `EXPO_PUBLIC_API_URL` apunte al backend de producción terminando
   en `/api`.
3. Aplica el SQL de avatares en Supabase.
4. Ejecuta `npm test`, `npm run typecheck`, `npm run lint` y `npx expo-doctor`.
5. Verifica el bundle con `npx expo export --platform android`.

## Verificación

```bash
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android
```

Las pruebas unitarias cubren el cliente API, perfiles, lealtad y Storage. No se
ejecutó una prueba E2E en emulador o dispositivo físico; la lista manual
recomendada es: registro, confirmación de correo, alta automática del perfil,
visita QR, compra de cupón, canje, historial, edición de perfil y baja de cuenta.

## Limitaciones conocidas

- El bucket `avatars` y sus políticas RLS deben aplicarse con
  [el SQL de Storage](../docs/sql/avatars_storage.sql) usando un rol
  administrador de Supabase. Sin ese paso, la app muestra un error accionable y
  el resto de la aplicación sigue funcionando.
- La entrega de notificaciones push no forma parte del alcance actual; la
  bandeja y las preferencias locales sí están conectadas a los datos reales.
- Los documentos legales requieren `EXPO_PUBLIC_TERMS_URL` y
  `EXPO_PUBLIC_PRIVACY_URL`.
- No hay persistencia offline de la cartera. React Query conserva la caché en
  memoria durante la sesión.
- No se ejecutó una prueba E2E en emulador o dispositivo físico; el bundle
  Android se verificó con `expo export`.
