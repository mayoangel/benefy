# Aplicación móvil

Aplicación Expo SDK 58 con React Native 0.88, React 19 y TypeScript, orientada
a consumidores de Benefy. Incluye un dashboard móvil de demostración con saldo
de puntos, progreso de sellos, dinámicas, cupones y navegación local entre
Inicio, Dinámicas, Cupones y Billetera.

## Estado del código

Expo Router usa `expo-router/entry` como entrada y las rutas viven en
`src/app/`. La configuración de Expo está en `app.json`. El contenido y las
acciones son datos de demostración locales: los códigos se muestran en un
diálogo y las acciones que requieren cámara o backend explican que aún no
están integradas.

No hay SDK Supabase, cliente API, cámara QR, lectura NFC, almacenamiento de
sesiones ni notificaciones push. Tampoco existen carpetas nativas `android/`
o `ios/` versionadas.

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

No hay scripts de lint ni pruebas. El script web existe, pero falta
`react-native-web`; no se considera un destino verificado. En PowerShell puedes usar
`npm.cmd` y `npx.cmd` si la ejecución de scripts está deshabilitada.

Para incorporar paquetes usa `npx expo install <paquete>`, de modo que Expo
resuelva versiones compatibles. Antes de implementar APIs de Expo/React Native,
consulta las [referencias de SDK 58](https://docs.expo.dev/versions/v58.0.0/).
La navegación futura debe seguir las instrucciones locales de Expo del proyecto.

## Variables y acceso al backend

La app actual usa datos simulados y no necesita un archivo `.env`.
La configuración de servicios de Benefy reside en el `.env` de la raíz.
Para integrar un dispositivo físico en el futuro habrá que definir una URL
accesible y autenticación: los servicios actuales están ligados a loopback.

La autenticación prevista para los clientes es Supabase Auth; el backend ya
verifica access tokens y aplica permisos. Consulta [autenticación](../docs/autenticacion.md)
y [API](../docs/api.md). Google OAuth no está implementado;
Firebase está pospuesto y no se encuentra integrado.

Nunca uses variables `EXPO_PUBLIC_*` para passwords, claves secretas o
credenciales de PostgreSQL. La app se ejecuta fuera de Docker.
