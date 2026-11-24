# Benefy

Benefy es una plataforma SaaS de lealtad para comercios y consumidores, con
programas de puntos, sellos y cupones. El repositorio contiene subproyectos
independientes. El entorno integrado de desarrollo y demostración se inicia
con `python dev.py up`, sin instalar Node ni Django en el host.

## Estado actual

| Componente | Implementado | Pendiente |
| --- | --- | --- |
| Backend | Django 5.2 + DRF, 30 modelos, 22 migraciones de `core`, 123 rutas API, motor de visitas/puntos/tarjetas/cupones, alianzas bilaterales auditadas con cupos Free/Premium, membresías auditadas, onboarding idempotente, invitaciones, aislamiento por sucursal, planes Free/Premium, Stripe Billing Sandbox y Django Admin | Analítica avanzada, Stripe live y facturación fiscal |
| Identidad | Supabase Auth con login web real, sesión persistente, refresh, recuperación, onboarding automático e invitaciones; perfiles/roles en Django | Google OAuth |
| Web | Landing React 18 + Vite y portal conectado: dashboards por rol, configuración, sucursales con QR imprimible, puntos, tarjetas, recompensas, alianzas, equipo, visitas, cupones, canjes, clientes, chat de Benef AI y pantalla de suscripción con Checkout/Customer Portal Sandbox | Exportaciones y E2E en CI |
| Móvil | Expo SDK 58 con Auth Supabase, perfil/foto/baja, cartera, historial, directorio, catálogo, cupones, canje, notificaciones y escáner QR reales | Notificaciones push y E2E en dispositivo |
| Benef AI | FastAPI con chat, tools de solo lectura, autenticación HMAC de servicio, proxy Django y panel en el portal | Despliegue en Railway/VPS y E2E con Gemini real |
| Hardware | Carpeta de documentación | Firmware ESP32-S3 e integración física |

El backend implementa el flujo transaccional del MVP: visitas por QR con
límite diario, puntos por lotes con FIFO, tarjetas de visitas, adquisición
idempotente, canje irreversible y alianzas bilaterales con beneficios por
negocio. El CRUD genérico de esas entidades es solo lectura; las operaciones
pasan por endpoints y servicios dedicados. La web ya consume la API con JWT de
Supabase. Free/Premium aplica límites reales desde Django y el portal permite
configurar el negocio, operar el programa, imprimir QR y gestionar alianzas.
Faltan las notificaciones push, Stripe en live/facturación fiscal y las
funciones Premium avanzadas. Detalles en
[reglas de lealtad](./docs/reglas-lealtad.md),
[planes Free/Premium](./docs/planes-free-premium.md), [API](./docs/api.md) y
[autenticación](./docs/autenticacion.md).

## Diferencias con el SRS

El [SRS](./docs/Benefy%20SRS.pdf) (revisión 1.0) describe requisitos de producto,
no funcionalidades terminadas. El código actual difiere en:

| Tema del SRS | Código actual |
| --- | --- |
| Firebase Auth | Supabase Auth verificado remotamente por Django |
| Google API | Solo correo confirmado; Google no está integrado en los clientes |
| React con Tailwind | React 18 con CSS propio |
| Dashboard y app de consumidores | Portal web por rol; móvil conectado a la API real |
| IA / ESP32-S3 | FastAPI solo con health check; hardware sin firmware |
| Stripe, FCM, Cloudinary, Sentry | Stripe Payments/Billing y Customer Portal solo en Sandbox/Test Mode; FCM, Cloudinary y Sentry siguen como placeholders |

La siguiente revisión formal del SRS debe actualizar el proveedor de identidad,
la sección de IA y los servicios externos.

## Estructura

| Ruta | Entrada y propósito |
| --- | --- |
| [backend/](./backend/README.md) | `manage.py`, `config/urls.py` y app `core/`: API y persistencia |
| [frontend-web/](./frontend-web/README.md) | `src/main.tsx` → `src/App.tsx`: landing y portal de negocios |
| [mobile-app/](./mobile-app/README.md) | `src/app/`: aplicación de consumidores con Expo Router |
| [benef-ai/](./benef-ai/README.md) | `main.py`: microservicio FastAPI de chat y tools de solo lectura |
| [hardware/](./hardware/README.md) | Futuro firmware ESP32-S3 |
| [docs/](./docs/README.md) | Guías técnicas y SRS revisión 1.0 |
| [compose.yaml](./compose.yaml) | Desarrollo y demostración con Vite, Django y Supabase |

## Desarrollo y demostración

Requisitos: Docker Desktop con Compose v2 y Python 3.11 o posterior para `dev.py`.
La única configuración de servicios es `compose.yaml` y el único archivo de
credenciales es `.env` en la raíz, ignorado por Git. Para una instalación nueva,
copia `.env.example` a `.env` y configura sus valores sin sobrescribir otro archivo.

```powershell
python dev.py up
# Alternativa directa: docker compose up -d --build --wait
```

El proyecto Docker se llama `benefy`. Abre **http://localhost:5173**; la API está
en http://localhost:8001 y Benef AI en http://localhost:5001. Vite tiene HMR y
los servicios Python recarga automática. Los puertos se limitan a loopback.
No se ejecutan migraciones ni seed al arrancar.

```powershell
python dev.py demo-init   # Completar la demo sin duplicados
python dev.py demo-reset  # Reemplazo explícito, con respaldo previo
python dev.py down       # Detener sin borrar volúmenes
```

Consulta [desarrollo y pruebas](./docs/desarrollo-demo.md) y
[cuentas y dataset de presentación](./docs/demo-dataset.md). El perfil `local`
solo proporciona PostgreSQL aislado para pruebas; no es otro despliegue.
Las pruebas de Django se ejecutan con `python dev.py test-backend --local`,
nunca contra la base remota de demostración.

La app móvil usa Supabase Auth, la API real y el escáner QR. El perfil, la foto,
la baja, la cartera, el historial, el directorio, los cupones y las
notificaciones ya están integrados. No forma parte del arranque Compose; su
configuración y verificación están en [docs/movil.md](./docs/movil.md).

## Documentación y convenciones

- [API](./docs/api.md): rutas, permisos y errores implementados.
- [Benef AI en el dashboard](./docs/benef-ai-chat.md): proxy Django, HMAC, tools y UI del chat.
- [Aplicación móvil](./docs/movil.md): pantallas, endpoints, caché y verificación Expo.
- [Autenticación y permisos](./docs/autenticacion.md): Supabase Auth, sesión web, roles y onboarding.
- [Eliminación de cuenta](./docs/eliminacion-cuenta.md): anonimización, propiedad y reintentos.
- [Avatares en Supabase Storage](./docs/supabase-storage-avatares.md): bucket, RLS y contrato de foto.
- [Reglas de lealtad](./docs/reglas-lealtad.md): visitas, puntos, tarjetas y cupones.
- [Planes Free y Premium](./docs/planes-free-premium.md): límites y cambios de plan.
- [Facturación Stripe Sandbox](./docs/facturacion-stripe-sandbox.md): Checkout, webhooks, portal y pruebas sin dinero real.
- [Despliegue en Railway](./docs/despliegue-railway.md): imagen de producción, variables, dominio y verificación.
- [Despliegue de Benef AI](./docs/despliegue-benef-ai.md): servicio FastAPI, autenticación HMAC, URLs y timeouts.
- [Migraciones de producción](./docs/migraciones-produccion.md): respaldo, aplicación y recuperación.
- [SRS original](./docs/Benefy%20SRS.pdf): requisitos de producto; no certifica implementación.

Las guías y comentarios nuevos se escriben en español; los identificadores
de código, en inglés. Se conservan los nombres de dominio y las rutas en
español existentes. Python usa dependencias fijadas en `requirements.txt`;
los clientes usan npm y lockfiles propios.

Los archivos reales de entorno están ignorados por Git. Los ejemplos solo
deben contener valores públicos, placeholders o credenciales exclusivas de
desarrollo. Los prefijos `VITE_` y `EXPO_PUBLIC_` exponen valores al cliente;
no incluyas contraseñas PostgreSQL, claves secretas ni tokens de sesión.
