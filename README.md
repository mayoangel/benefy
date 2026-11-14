# Benefy

Benefy es una plataforma SaaS de lealtad para comercios y consumidores, con
programas de puntos, sellos y cupones. El repositorio contiene subproyectos
independientes; no existe un gestor de paquetes ni un comando de ejecución
único para todo el producto.

## Estado actual

| Componente | Implementado | Pendiente |
| --- | --- | --- |
| Backend | Django 5.2 + DRF, 16 modelos, cuatro migraciones de `core`, 82 rutas API, permisos por negocio/sucursal y Django Admin | Servicios completos de acumulación, emisión y canje; analítica y webhooks |
| Identidad | Verificación remota de Supabase Auth y perfiles/roles en Django | Login y gestión de sesión en los clientes |
| Web | Landing React 18 + Vite: Inicio, Nosotros y Precios | Dashboard administrativo y consumo de API |
| Móvil | Dashboard Benefy en Expo SDK 58 con resumen de puntos, retos, cupones y pestañas de demostración | Datos reales, Auth, cámara QR/NFC y cliente API |
| Benef AI | FastAPI y endpoint de estado | Agente, proveedor LLM, herramientas y comunicación autenticada con Django |
| Hardware | Carpeta de documentación | Firmware ESP32-S3 e integración física |

El CRUD existente no equivale a un flujo de lealtad terminado: registrar una
actividad no actualiza automáticamente el progreso ni emite cupones; crear
un canje no cambia automáticamente el estado del cupón ni evita carreras
concurrentes. Consulta [estado y correspondencia con el SRS](./docs/estado-implementacion.md).

## Estructura

| Ruta | Entrada y propósito |
| --- | --- |
| [backend/](./backend/README.md) | `manage.py`, `config/urls.py` y app `core/`: API y persistencia |
| [frontend-web/](./frontend-web/README.md) | `src/main.tsx` → `src/App.tsx`: landing pública |
| [mobile-app/](./mobile-app/README.md) | `index.ts` → `App.tsx`: aplicación de consumidores |
| [benef-ai/](./benef-ai/README.md) | `main.py`: servicio IA en preparación |
| [hardware/](./hardware/README.md) | Futuro firmware ESP32-S3 |
| [docs/](./docs/README.md) | Guías técnicas y SRS revisión 1.0 |
| [Caddyfile](./Caddyfile) | Proxy inverso y servidor de la web en el montaje de demostración |
| [compose.yaml](./compose.yaml) | Desarrollo: PostgreSQL local, backend y Benef AI |
| [compose.demo.yaml](./compose.demo.yaml) | Demostración local tipo producción: Caddy, Gunicorn y Supabase |

## Inicio rápido de desarrollo

Requisitos: Docker con Compose v2 para los servicios y npm/Node.js para los
clientes. Los proyectos Node usan sus propios `package-lock.json`; utiliza
`npm ci`. El CI de GitHub Actions ejecuta las pruebas de Django, el typecheck
y el build del frontend; no hay un comando global de lint/pruebas en la raíz.

Desde la raíz, crea los archivos de entorno que no existan:

| Archivo real | Plantilla | Uso |
| --- | --- | --- |
| `.env` | [.env.example](./.env.example) | Credenciales del PostgreSQL local para Compose |
| `backend/.env` | [backend/.env.example](./backend/.env.example) | Settings locales y conexión con Supabase Auth |
| `backend/.env.production` | [backend/.env.production.example](./backend/.env.production.example) | Variables de producción; no necesarias para iniciar desarrollo |
| `benef-ai/.env` | [benef-ai/.env.example](./benef-ai/.env.example) | Entorno del servicio; integraciones aún sin uso |
| `frontend-web/.env` | [frontend-web/.env.example](./frontend-web/.env.example) | Variables públicas web previstas |
| `mobile-app/.env` | [mobile-app/.env.example](./mobile-app/.env.example) | Variables públicas móviles previstas |

No sobrescribas archivos reales al copiar plantillas. Configura
`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en el backend para usar rutas
autenticadas. El proveedor Auth requiere internet también durante desarrollo.

```bash
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml exec backend python manage.py migrate
docker compose -f compose.yaml exec backend python manage.py check
docker compose -f compose.yaml exec backend python manage.py test --noinput
```

URLs locales: backend en <http://localhost:8000/>, Admin en
<http://localhost:8000/admin/>, Benef AI en <http://localhost:5000/>.
Los health checks comprueban Django y su conexión con PostgreSQL; no
verifican Supabase Auth.

Para crear una cuenta staff del Admin de Django:

```bash
docker compose -f compose.yaml exec backend python manage.py createsuperuser
```

Esa cuenta es distinta de una identidad de Supabase y del rol Benefy
`admin_sistema`. Consulta [autenticación](./docs/autenticacion.md).

Ejecuta cada cliente en su propia terminal, desde su carpeta:

```bash
cd frontend-web
npm ci
npm run dev
```

```bash
cd mobile-app
npm ci
npm run start
```

Detén los clientes con Ctrl+C y los servicios Docker con:

```bash
docker compose -f compose.yaml down
```

El volumen de PostgreSQL se conserva. Evita `down -v` si necesitas sus datos.
Si otro proyecto usa 5432, 8000 o 5000, resuelve el conflicto antes del inicio.

## Base de datos y entornos

Desarrollo fija PostgreSQL en `db:5432`. El montaje de demostración usa
Supabase con los parámetros `DB_*` de `backend/.env.production`, SSL
obligatorio y Gunicorn. Los modelos y archivos de migración son los mismos;
los datos de ambos entornos no se sincronizan ni se copian automáticamente.

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml config --quiet
```

Consulta la [guía del backend](./backend/README.md) para migraciones manuales,
comprobación de conexión y secretos. Iniciar contenedores no aplica migraciones.

## Demostración local tipo producción

`compose.demo.yaml` ejecuta el mismo stack con Gunicorn, WhiteNoise y Caddy en
un solo origen (`https://localhost`), usando Supabase como base de datos. Sirve
para presentar el proyecto y practicar un despliegue real sin publicar puertos
ni pagar hosting.

```bash
cp backend/.env.production.example backend/.env.production   # completar secretos
docker compose --env-file backend/.env.production -f compose.demo.yaml build
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

El backend no publica puertos: solo Caddy lo alcanza. Los puertos 80 y 443 se
enlazan a `127.0.0.1`. Para una demo pública existe el perfil `tunnel`
(Cloudflare Tunnel). Los detalles, la CA interna de Caddy y las diferencias con
desarrollo están en [docs/despliegue-local.md](./docs/despliegue-local.md).

## Documentación y convenciones

- [API actual](./docs/api.md): rutas y métodos implementados.
- [Autenticación y permisos](./docs/autenticacion.md): Supabase Auth, perfiles y roles.
- [Estado y SRS](./docs/estado-implementacion.md): funcionalidades existentes y pendientes.
- [SRS original](./docs/Benefy%20SRS.pdf): requisitos de producto; no certifica implementación.

Las guías y comentarios nuevos se escriben en español; los identificadores
de código, en inglés. Se conservan los nombres de dominio y las rutas en
español existentes. Python usa dependencias fijadas en `requirements.txt`;
los clientes usan npm y lockfiles propios.

Los archivos reales de entorno están ignorados por Git. Los ejemplos solo
deben contener valores públicos, placeholders o credenciales exclusivas de
desarrollo. Los prefijos `VITE_` y `EXPO_PUBLIC_` exponen valores al cliente;
no incluyas contraseñas PostgreSQL, claves secretas ni tokens de sesión.
