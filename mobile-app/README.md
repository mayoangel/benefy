# Aplicación móvil Benefy

Aplicación Expo SDK 58 con React Native 0.88, React 19, TypeScript y Expo
Router, orientada a consumidores de Benefy. La navegación principal incluye
Inicio, Cartera, Registrar y Perfil, además del directorio, tienda de cupones,
detalle de recompensas, canje, historial, notificaciones y configuración.

## Estado del código

Todas las pantallas normales consumen la API real de Django y Supabase Auth.
No se usa `preview.tsx` ni un panel de demostración en los flujos del MVP.

- **Autenticación:** Supabase Auth para registro, login, refresco de token y
  recuperación de contraseña. Django valida el bearer en cada request.
- **Perfil:** se consulta en `GET /api/v1/autenticacion/perfil/`. Si una
  identidad nueva aún no tiene perfil local, se crea automáticamente con los
  metadatos del registro. La edición usa `PATCH` y la foto se sube a Supabase
  Storage antes de guardar la URL.
- **Inicio y cartera:** saldos, tarjetas y cupones reales de
  `GET /api/v1/mi/billetera/` y `GET /api/v1/cupones-usuario/listar/`.
- **Directorio y catálogo:** `GET /api/v1/negocios/descubrir/` y
  `GET /api/v1/negocios/{id}/catalogo/`, con búsqueda, categorías, sucursales
  y recompensas.
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
  requiere integración de servidor y queda fuera del MVP.

La matriz completa de pantallas, endpoints, caché y limitaciones está en
[docs/movil.md](../docs/movil.md).

## Ejecución y verificación

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

## Variables y acceso al backend

Crea `.env` a partir de [.env.example](./.env.example):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave publicable>
EXPO_PUBLIC_API_URL=http://<ip-lan>:8000/api
EXPO_PUBLIC_TERMS_URL=
EXPO_PUBLIC_PRIVACY_URL=
```

`EXPO_PUBLIC_API_URL` debe terminar en `/api`; el cliente agrega `/v1/...`.
Para un dispositivo físico usa la IP LAN del equipo que ejecuta Django:
`http://192.168.1.50:8000/api` con `runserver` o
`http://192.168.1.50:8001/api` con Docker Compose. `localhost` en el teléfono
apunta al propio teléfono. Comprueba red y firewall.

Configura la plantilla de recuperación de Supabase para enviar el código OTP que
solicita la pantalla de recuperación. Nunca uses variables `EXPO_PUBLIC_*` para
passwords, claves secretas o credenciales de PostgreSQL. La app se ejecuta fuera
de Docker.

## Verificación de esta entrega

- 29 pruebas Jest OK.
- `tsc --noEmit` OK.
- ESLint OK.
- Expo Doctor 20/20.
- Bundle Android exportado correctamente.
- Backend: 318 pruebas OK en un contenedor aislado con PostgreSQL local.

## Limitaciones

- El bucket `avatars` y sus políticas RLS requieren aplicar
  [docs/sql/avatars_storage.sql](../docs/sql/avatars_storage.sql) con un rol
  administrador de Supabase. Sin ese paso, la subida de foto muestra un error y
  el resto de la app sigue funcionando.
- No hay entrega push ni persistencia offline de la cartera.
- Los documentos legales requieren las variables `EXPO_PUBLIC_TERMS_URL` y
  `EXPO_PUBLIC_PRIVACY_URL`.
- No se ejecutó E2E en emulador o dispositivo; consulta la lista manual en
  [docs/movil.md](../docs/movil.md).
