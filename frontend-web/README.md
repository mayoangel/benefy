# Frontend web

Landing pública y portal de negocios de Benefy, implementados con React 18,
React Router 6, TypeScript 5, Vite 5 y Supabase Auth. El portal consume la API
real de Django; no hay datos ni inicios de sesión simulados.

## Código y páginas

La entrada es `src/main.tsx`, que configura `BrowserRouter`, `AuthProvider` y
carga `src/App.tsx`. Las rutas implementadas son:

| Ruta | Página |
| --- | --- |
| `/` | Inicio |
| `/about` | Información del proyecto |
| `/precios` | Planes y precios de presentación |
| `/login` | Inicio de sesión con Supabase |
| `/registro` | Alta de cuenta de negocio |
| `/recuperar` | Envío de enlace de recuperación |
| `/actualizar-password` | Definición de nueva contraseña |
| `/completar-perfil` | Onboarding del perfil Django |
| `/registrar-negocio` | Alta de negocio y membresía de dueño |
| `/acceso-restringido` | Consumidor sin membresía comercial |
| `/portal` | Redirección según rol y contexto |
| `/portal/negocio/:id` | Resumen del negocio o sucursal |
| `/portal/negocio/:id/sucursales` | Sucursales accesibles |
| `/portal/negocio/:id/equipo` | Membresías visibles |
| `/portal/negocio/:id/visitas` | Visitas del alcance |
| `/portal/negocio/:id/cupones` | Cupones del negocio (solo dueño) |
| `/portal/admin` | Administración global (`admin_sistema`) |
| Cualquier otra | Muestra Inicio mediante la ruta comodín |

Cabecera y pie se comparten en la landing. El portal usa
`src/styles/portal.css`. El diseño emplea CSS propio y Font Awesome; Tailwind
no está instalado. Los textos de planes e IA de la landing son contenido
comercial: no implican pagos ni analítica implementados.

## Autenticación y API

- `src/lib/supabase.ts`: cliente único con `persistSession`, `autoRefreshToken`
  y `detectSessionInUrl`. Solo usa la clave publicable.
- `src/auth/AuthProvider.tsx`: restaura la sesión, escucha cambios, carga el
  perfil y `GET /mi/contexto/`, y expone login, logout y onboarding.
- `src/lib/api.ts`: cliente HTTP con bearer, refresh único ante `401`, sin
  reintentos en `403`, y lectura de los errores `codigo`/`detalle` de DRF.
- `src/auth/guards.tsx`: `RequireSession`, `RequirePortalAccess` y `RequireAdmin`.
  Solo controlan navegación; Django valida cada petición.
- `src/portal/PortalLayout.tsx`: shell compartido, selector de negocio y
  sucursal, navegación por rol y adaptación móvil.
- `src/portal/components/PlanPanel.tsx`: plan actual, uso y límites, excedentes
  y funciones Premium con su estado de disponibilidad.

Un consumidor sin membresías no entra al portal: se le redirige a
`/acceso-restringido` con el CTA para registrar su negocio. El portal consulta
`/planes/` y `/negocios/{id}/plan/`; Django conserva la autoridad sobre los
límites. El detalle del contrato está en [autenticación](../docs/autenticacion.md),
[API](../docs/api.md) y [planes](../docs/planes-free-premium.md).

## Ejecución y verificación

Desde `frontend-web/`:

```bash
npm ci
npm run dev
```

Vite suele usar <http://localhost:5173/>; confirma la dirección que imprime
la terminal, porque puede seleccionar otro puerto si está ocupado.

```bash
npm run typecheck
npm run build
npm run preview
```

`typecheck` ejecuta `tsc --noEmit`. `build` solo ejecuta `vite build`; por eso
deben ejecutarse ambos comandos. `preview` sirve el contenido de `dist/` para
revisión local. No hay scripts de pruebas ni lint.

En PowerShell con scripts deshabilitados puedes usar `npm.cmd` en lugar
de `npm`. No es necesario cambiar la política de ejecución del sistema.

## Variables

El código lee `import.meta.env`; crea `.env` desde [.env.example](./.env.example):

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

En producción, `VITE_API_BASE_URL=/api/v1` porque Caddy sirve la SPA y la API
en el mismo origen. `Dockerfile` recibe las tres variables como `ARG` y
`compose.demo.yaml` toma las de Supabase de `SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY`.

Todo valor `VITE_*` termina siendo público en el navegador. No incluyas
claves `service_role`, contraseñas de base de datos ni claves secretas.

## Publicación

`npm run build` produce `dist/`. El hosting debe devolver `index.html`
para rutas como `/about`, `/precios` o `/portal/negocio/1`, dado que se utiliza
BrowserRouter. El montaje de demostración (`compose.demo.yaml`) compila `dist/`
con `frontend-web/Dockerfile` y Caddy lo sirve junto a la API; para un hosting
aparte, publica ese contenido con la misma regla de fallback. El servidor
Vite de desarrollo no es el hosting de producción.
