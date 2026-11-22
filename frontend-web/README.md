# Frontend web

> Inicia el portal con `python dev.py up` desde la raíz.
> Consulta [la guía de desarrollo](../docs/desarrollo-demo.md).

Landing pública y portal de negocios de Benefy, implementados con React 18,
React Router 7, TypeScript 5, Vite 6 y Supabase Auth. El portal consume la API
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
| `/registro` | Alta de cuenta de negocio o de invitado con `?invitacion=` |
| `/recuperar` | Envío de enlace de recuperación |
| `/actualizar-password` | Definición de nueva contraseña |
| `/completar-perfil` | Onboarding de perfil para cuentas heredadas o invitados |
| `/completar-registro` | Reintento del onboarding comercial |
| `/registrar-negocio` | Alta de un negocio adicional |
| `/invitacion/:token` | Consulta y aceptación de una invitación |
| `/acceso-restringido` | Consumidor sin membresía comercial |
| `/portal` | Redirección según rol y contexto |
| `/portal/negocio/:id` | Resumen del negocio o sucursal |
| `/portal/negocio/:id/configuracion` | Datos públicos y de contacto |
| `/portal/negocio/:id/sucursales` | CRUD de sucursales |
| `/portal/negocio/:id/puntos` | Programa de puntos |
| `/portal/negocio/:id/tarjetas` | Tarjetas de sellos y premio meta |
| `/portal/negocio/:id/recompensas` | CRUD de recompensas |
| `/portal/negocio/:id/equipo` | Membresías e invitaciones |
| `/portal/negocio/:id/visitas` | Visitas con filtros y paginación |
| `/portal/negocio/:id/canjes` | Canjes con filtros y paginación |
| `/portal/negocio/:id/cupones` | Cupones emitidos (solo dueño) |
| `/portal/negocio/:id/clientes` | Clientes agregados (solo dueño) |
| `/portal/admin` | Administración global (`admin_sistema`) |
| Cualquier otra | Muestra Inicio mediante la ruta comodín |

Cabecera y pie se comparten en la landing. El portal usa
`src/styles/portal.css`. El diseño emplea CSS propio y Font Awesome; Tailwind
no está instalado. Los textos de planes e IA de la landing son contenido
comercial: no implican pagos ni analítica implementados.

## Autenticación y API

- `src/lib/supabase.ts`: cliente único con `persistSession`, `autoRefreshToken`
  y `detectSessionInUrl`. Solo usa la clave publicable.
- `src/auth/AuthProvider.tsx`: restaura la sesión, escucha cambios, completa el
  onboarding comercial si es necesario, carga perfil y contexto, y expone login,
  logout y reintento.
- `src/lib/api.ts`: cliente HTTP con bearer, refresh único ante `401`, sin
  reintentos en `403`, y lectura de los errores `codigo`/`detalle` de DRF.
- `src/auth/guards.tsx`: `RequireSession`, `RequirePortalAccess` y `RequireAdmin`.
  Solo controlan navegación; Django valida cada petición.
- `src/portal/PortalLayout.tsx`: shell compartido, selector de negocio y
  sucursal, navegación por rol y adaptación móvil.
- `src/portal/components/PlanPanel.tsx`: plan actual, uso y límites, excedentes
  y funciones Premium con su estado de disponibilidad.
- `src/portal/pages/`: configuración, sucursales, puntos, tarjetas, recompensas,
  equipo, visitas, canjes, cupones y clientes.
- `src/pages/InvitationPage.tsx`: aceptación de invitaciones con el correo
  autenticado.

Un consumidor sin membresías no entra al portal: se le redirige a
`/acceso-restringido` con el CTA para registrar su negocio. El onboarding
comercial se completa automáticamente tras confirmar el correo, sin repetir el
formulario. El portal consulta `/planes/` y `/negocios/{id}/plan/`; Django
conserva la autoridad sobre los límites. El detalle está en
[autenticación](../docs/autenticacion.md), [API](../docs/api.md) y
[planes](../docs/planes-free-premium.md).

## Ejecución y verificación

El único Dockerfile sirve Vite con HMR en http://localhost:5173. El código se
monta desde el repositorio y las dependencias residen en un volumen Docker.
No hay build estático intermedio ni archivos `.env` propios de la web.

`compose.yaml` deriva las variables públicas desde el `.env` de la raíz:
URL Supabase, clave publicable y `/api/v1`. El proxy conecta con Django sin
exponer credenciales privadas. El launcher valida que la clave sea publicable.

Para verificaciones locales, desde `frontend-web/` con Node instalado:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Las E2E usan respuestas controladas en el puerto 5174 y Edge; no modifican la
base remota. `tests/smoke.mjs` comprueba el servidor real y HMR sin credenciales.
`tests/showcase-live.mjs` comprueba los roles reales usando contraseñas solo
por entorno. Las pruebas visuales siguen comprobando el responsive del portal.

`npm run build` produce `dist/` para validar compilación; la demo sirve el código
actual mediante Vite. No existe un montaje de producción o un túnel incluido.
