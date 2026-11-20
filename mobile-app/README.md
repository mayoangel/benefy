# Aplicación móvil

Aplicación Expo SDK 58 con React Native 0.88, React 19 y TypeScript, orientada
a consumidores de Benefy. La navegación principal incluye Inicio, Cartera,
Registrar y Perfil. Desde estas pestañas se puede consultar el detalle de
comercios, la tienda de cupones, el historial, los avisos y la configuración.

## Estado del código

Expo Router usa `expo-router/entry` como entrada y las rutas viven en
`src/app/`. La configuración de Expo está en `app.json`.

- Los comercios, movimientos, avisos, recompensas y el perfil son datos de
  demostración. Las operaciones sobre una cuenta real requieren una sesión
  autenticada y una conexión a la API móvil. La demostración no acredita
  visitas, descuenta puntos, confirma canjes ni modifica cuentas.
- La pestaña Registrar usa la cámara para leer QR. Para probar el recorrido
  local se puede codificar `benefy-demo:blend`, `benefy-demo:blend:nuevo` o
  `benefy-demo:blend:vencido` en un QR. No se toman ni se guardan imágenes.
- La app usa el selector de fotos del dispositivo y consulta los permisos del
  sistema para avisos. La bandeja y las preferencias de demostración viven en
  memoria. La entrega de notificaciones push requiere integración de servidor.
- Configura `EXPO_PUBLIC_TERMS_URL` y `EXPO_PUBLIC_PRIVACY_URL` con documentos
  publicados en texto plano UTF-8 para habilitar el visor legal.

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

Crea `.env` a partir de [.env.example](./.env.example) si no existe.
El prefijo público móvil es `EXPO_PUBLIC_*`; las variables del ejemplo aún
no se consumen en `App.tsx`.

Para un dispositivo físico, `EXPO_PUBLIC_API_URL` deberá usar la IP LAN del
equipo que ejecuta Django, por ejemplo `http://192.168.1.50:8000/api/v1`.
`localhost` en el teléfono apunta al propio teléfono. Comprueba red y firewall.
El backend del montaje de demostración está ligado al loopback del servidor;
requiere publicación HTTPS para el acceso móvil externo.

La autenticación prevista para los clientes es Supabase Auth; el backend ya
verifica access tokens y aplica permisos. Consulta [autenticación](../docs/autenticacion.md)
y [API](../docs/api.md). Los IDs OAuth Google del ejemplo son placeholders;
Firebase está pospuesto y no se encuentra integrado.

Nunca uses variables `EXPO_PUBLIC_*` para passwords, claves secretas o
credenciales de PostgreSQL. La app se ejecuta fuera de Docker.
