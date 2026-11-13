# Aplicación móvil

Base Expo SDK 58 con React Native 0.88, React 19 y TypeScript.
Está orientada a consumidores de Benefy; actualmente solo muestra la pantalla
de la plantilla y no implementa funcionalidades del producto.

## Estado del código

La entrada registrada en `package.json` es `index.ts`, que registra
`App.tsx`. La configuración de Expo está en `app.json`.

No hay navegación, Expo Router, SDK Supabase, cliente API, cámara QR,
lectura NFC, almacenamiento de sesiones ni notificaciones push.
Tampoco existen carpetas nativas `android/` o `ios/` versionadas.

## Ejecución y verificación

Desde `mobile-app/`:

```bash
npm ci
npm run start
```

Los scripts disponibles son:

| Comando | Uso |
| --- | --- |
| `npm run start` | Inicia Metro/Expo; normalmente usa el puerto 8081 |
| `npm run android` | Solicita abrir el proyecto en Android |
| `npm run ios` | Solicita abrir el proyecto en iOS; depende del entorno disponible |
| `npm run web` | Solicita el destino web; requiere comprobar/instalar sus dependencias compatibles |
| `npx tsc --noEmit` | Verifica TypeScript sin generar archivos |

No hay scripts de lint ni pruebas. El script web existe, pero el
`package.json` actual no incluye `react-dom` ni `react-native-web`;
no se considera un destino verificado. En PowerShell puedes usar
`npm.cmd` y `npx.cmd` si la ejecución de scripts está deshabilitada.

Para incorporar paquetes usa `npx expo install <paquete>`, de modo que Expo
resuelva versiones compatibles. Antes de implementar APIs de Expo/React Native,
consulta las [referencias de SDK 58](https://docs.expo.dev/versions/v58.0.0/).
La navegación futura debe seguir las instrucciones locales de Expo del proyecto.

## Variables y acceso al backend

Crea `.env` a partir de [.env.example](./.env.example) si no existe.
El prefijo público móvil es `EXPO_PUBLIC_*`; las variables del ejemplo aún
no se consumen en `App.tsx`.

Para un dispositivo físico, `EXPO_PUBLIC_API_URL` deberá usar la IP LAN del
equipo que ejecuta Django, por ejemplo `http://192.168.1.50:8000/api/v1`.
`localhost` en el teléfono apunta al propio teléfono. Comprueba red y firewall.
El backend del Compose de producción está ligado al loopback del servidor;
requiere publicación HTTPS para el acceso móvil externo.

La autenticación prevista para los clientes es Supabase Auth; el backend ya
verifica access tokens y aplica permisos. Consulta [autenticación](../docs/autenticacion.md)
y [API](../docs/api.md). Los IDs OAuth Google del ejemplo son placeholders;
Firebase está pospuesto y no se encuentra integrado.

Nunca uses variables `EXPO_PUBLIC_*` para passwords, claves secretas o
credenciales de PostgreSQL. La app se ejecuta fuera de Docker.
