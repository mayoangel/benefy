# Benefy

Benefy es una plataforma SaaS de lealtad para comercios y consumidores, con
programas de puntos, sellos y cupones. El repositorio contiene subproyectos
independientes. El entorno integrado de desarrollo y demostración se inicia
con `python dev.py up`, sin instalar Node ni Django en el host.

## Estado actual

| Componente | Implementado | Pendiente |
| --- | --- | --- |
| Backend | Django 5.2 + DRF, 25 modelos, quince migraciones de `core`, 106 rutas API, motor de visitas/puntos/tarjetas/cupones, membresías auditadas, onboarding idempotente, invitaciones, aislamiento por sucursal, planes Free/Premium y Django Admin | Analítica avanzada, Stripe y webhooks |
| Identidad | Supabase Auth con login web real, sesión persistente, refresh, recuperación, onboarding automático e invitaciones; perfiles/roles en Django | Integración de Auth en la app móvil |
| Web | Landing React 18 + Vite y portal conectado: dashboards por rol, configuración, sucursales, puntos, tarjetas, recompensas, equipo, visitas, cupones, canjes, clientes y plan con uso/límites | Checkout, exportaciones y E2E en CI |
| Móvil | Dashboard Benefy en Expo SDK 58 con resumen de puntos, retos, cupones y pestañas de demostración | Datos reales, Auth, cámara QR/NFC y cliente API |
| Benef AI | FastAPI y endpoint de estado | Agente, proveedor LLM, herramientas y comunicación autenticada con Django |
| Hardware | Carpeta de documentación | Firmware ESP32-S3 e integración física |

El backend implementa el flujo transaccional del MVP: visitas por QR con
límite diario, puntos por lotes con FIFO, tarjetas de visitas, adquisición
idempotente y canje irreversible. El CRUD genérico de esas entidades es solo
lectura; las operaciones pasan por endpoints y servicios dedicados. La web ya
consume la API con JWT de Supabase. Free/Premium aplica límites reales desde
Django y el portal permite configurar el negocio y operar el programa. Faltan la
app móvil, Stripe y las funciones Premium avanzadas. Detalles en
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
| Dashboard y app de consumidores | Portal web por rol; móvil con datos de demostración |
| IA / ESP32-S3 | FastAPI solo con health check; hardware sin firmware |
| Stripe, FCM, Cloudinary, Sentry | Modelos o placeholders, sin integración |

La siguiente revisión formal del SRS debe actualizar el proveedor de identidad,
la sección de IA y los servicios externos.

## Estructura

| Ruta | Entrada y propósito |
| --- | --- |
| [backend/](./backend/README.md) | `manage.py`, `config/urls.py` y app `core/`: API y persistencia |
| [frontend-web/](./frontend-web/README.md) | `src/main.tsx` → `src/App.tsx`: landing y portal de negocios |
| [mobile-app/](./mobile-app/README.md) | `index.ts` → `App.tsx`: aplicación de consumidores |
| [benef-ai/](./benef-ai/README.md) | `main.py`: servicio IA en preparación |
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

La app móvil sigue siendo un subproyecto Expo con datos simulados. No forma
parte del arranque Compose ni necesita credenciales para su estado actual.

## Documentación y convenciones

- [API](./docs/api.md): rutas, permisos y errores implementados.
- [Autenticación y permisos](./docs/autenticacion.md): Supabase Auth, sesión web, roles y onboarding.
- [Reglas de lealtad](./docs/reglas-lealtad.md): visitas, puntos, tarjetas y cupones.
- [Planes Free y Premium](./docs/planes-free-premium.md): límites y cambios de plan.
- [Desarrollo y demo](./docs/desarrollo-demo.md): arranque, recarga y pruebas locales.
- [SRS original](./docs/Benefy%20SRS.pdf): requisitos de producto; no certifica implementación.

Las guías y comentarios nuevos se escriben en español; los identificadores
de código, en inglés. Se conservan los nombres de dominio y las rutas en
español existentes. Python usa dependencias fijadas en `requirements.txt`;
los clientes usan npm y lockfiles propios.

Los archivos reales de entorno están ignorados por Git. Los ejemplos solo
deben contener valores públicos, placeholders o credenciales exclusivas de
desarrollo. Los prefijos `VITE_` y `EXPO_PUBLIC_` exponen valores al cliente;
no incluyas contraseñas PostgreSQL, claves secretas ni tokens de sesión.
