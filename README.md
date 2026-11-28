# Benefy

Benefy es una plataforma SaaS de lealtad para comercios y consumidores, con
programas de puntos, sellos y cupones. El repositorio contiene el backend, el
portal web, la aplicación móvil y el servicio de IA.

## Arquitectura

| Componente | Tecnología | Entrada |
| --- | --- | --- |
| Backend | Django 5.2 + Django REST Framework | `backend/manage.py`, `backend/config/urls.py`, app `core/` |
| Base de datos | PostgreSQL de Supabase | Conexión SSL desde el backend |
| Identidad | Supabase Auth | Verificación remota en cada petición |
| Portal web | React 18 + Vite + TypeScript | `frontend-web/src/main.tsx` → `src/App.tsx` |
| App móvil | Expo + React Native + Expo Router | `mobile-app/src/app/` |
| Benef AI | FastAPI + Gemini | `benef-ai/main.py` |
| Facturación | Stripe Billing/Checkout/Customer Portal | Sandbox/Test Mode |

El backend concentra las reglas de negocio y la autorización. La web y el móvil
consumen la API con el bearer de Supabase; el navegador nunca recibe claves
administrativas ni secretos de Stripe o PostgreSQL. Benef AI se consume a través
del proxy autenticado de Django y no ejecuta escrituras.

## Alcance actual

- Motor de lealtad: visitas por QR con límite diario, puntos por lotes con FIFO,
  tarjetas de sellos, adquisición idempotente de cupones y canje irreversible.
- Portal por rol: propietario, supervisor, empleado y administrador de plataforma.
- Planes Free/Premium con límites reales, auditoría de cambios y excedentes.
- Alianzas bilaterales con cupos por plan y beneficios por negocio.
- Onboarding idempotente, invitaciones, aislamiento por sucursal y baja de cuenta
  con anonimización.
- Stripe Checkout, Customer Portal, webhooks idempotentes y reconciliación en
  Sandbox/Test Mode.
- App móvil conectada a la API real, con perfil, foto, cartera, historial,
  directorio, cupones, canje, notificaciones y escáner QR.
- Benef AI de solo lectura con contexto autorizado por Django.

Límites conocidos de producción: Stripe sigue en Sandbox y no hay cobros reales,
CFDI ni impuestos; las notificaciones push y las exportaciones avanzadas no están
integradas. Consulta [planes y facturación](./docs/planes-y-facturacion.md) y
[operaciones](./docs/operaciones.md).

## Puesta en marcha de producción

1. Configura Supabase Auth, PostgreSQL y el bucket de avatares.
2. Revisa [`backend/.env.production.example`](./backend/.env.production.example)
   y define los secretos en el panel del servicio, nunca en Git.
3. Despliega el backend con `backend/Dockerfile.prod` y `backend/railway.json`.
4. Compila el portal con `npm run build` y publica `frontend-web/dist/`.
5. Publica la app móvil con EAS.
6. Despliega Benef AI si el chat está habilitado.
7. Aplica el SQL de avatares y ejecuta las migraciones con el procedimiento
   controlado.
8. Verifica el despliegue con el
   [smoke de operaciones](./docs/operaciones.md#smoke-de-despliegue).

El detalle está en:

- [Backend](./backend/README.md)
- [Frontend web](./frontend-web/README.md)
- [Aplicación móvil](./mobile-app/README.md)
- [Benef AI](./benef-ai/README.md)
- [Operaciones](./docs/operaciones.md)

## Documentación

- [API](./docs/api.md): rutas, permisos y errores.
- [Identidad, acceso y cuentas](./docs/identidad-y-cuentas.md): Supabase Auth,
  roles, onboarding, avatares y baja de cuenta.
- [Reglas de lealtad](./docs/lealtad.md): visitas, puntos, tarjetas y cupones.
- [Planes y facturación](./docs/planes-y-facturacion.md): límites Free/Premium y
  Stripe Sandbox.
- [Operaciones](./docs/operaciones.md): despliegue, migraciones, respaldos y
  runbooks.
- [Desarrollo local y demostración](./docs/desarrollo-local.md): fuera de la
  operación de producción.
- [Índice completo](./docs/README.md).

## Convenciones y secretos

- Las guías y comentarios se escriben en español; los identificadores de código,
  en inglés.
- Los nombres de dominio y las rutas existentes en español se conservan.
- Python usa dependencias fijadas en `requirements.txt`; los clientes usan npm y
  lockfiles propios.
- Los archivos `.env` reales están ignorados por Git. Los ejemplos solo contienen
  valores públicos, placeholders o credenciales exclusivas de desarrollo.
- Los prefijos `VITE_` y `EXPO_PUBLIC_` exponen valores al cliente; no incluyas
  contraseñas PostgreSQL, claves secretas ni tokens de sesión.
