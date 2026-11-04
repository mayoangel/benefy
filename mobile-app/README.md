# Aplicación móvil

Aplicación móvil de Benefy orientada al cliente final.

## Responsabilidades previstas

- Permitir la interacción con códigos QR/NFC.
- Consultar el saldo, sellos, cupones y recompensas del cliente.
- Consumir la API del [`backend`](../backend/README.md).

## Estado actual

Proyecto inicializado con React Native y Expo (TypeScript, plantilla
`blank-typescript`). El punto de entrada es `App.tsx`.

Las variables de entorno usan el prefijo `EXPO_PUBLIC_` y Expo las carga
desde `mobile-app/.env` (generado a partir de `.env.example`).

## Cómo ejecutar

```bash
npm run start     # Metro en http://localhost:8081
```

Desde el menú de Expo puedes abrir la app en Expo Go (dispositivo físico),
un emulador de Android/iOS (`npm run android` / `npm run ios`) o la versión
web (`npm run web`).

## Tecnologías

React Native y Expo (SDK 58). La navegación y el enrutado se definirán al
iniciar el desarrollo de pantallas.
