# Frontend web

Landing pública y portal de negocios de Benefy, implementados con React 18,
React Router 7, TypeScript 5, Vite 6 y Supabase Auth. El portal consume la API
real de Django; no hay datos ni inicios de sesión simulados.

## Código y páginas

La entrada es `src/main.tsx`, que configura `BrowserRouter`, `AuthProvider` y
carga `src/App.tsx`. Las rutas principales son:

| Ruta | Página |
| --- | --- |
| `/` | Inicio |
| `/about` | Información del proyecto |
| `/precios` | Planes y precios |
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
| `/portal/negocio/:id` | Resumen del negocio, sucursal y panel Benef AI |
| `/portal/negocio/:id/suscripcion` | Plan actual, Checkout y Customer Portal Sandbox |
| `/portal/negocio/:id/configuracion` | Datos públicos y de contacto |
| `/portal/negocio/:id/sucursales` | CRUD de sucursales y QR imprimible |
| `/portal/negocio/:id/puntos` | Programa de puntos |
| `/portal/negocio/:id/tarjetas` | Tarjetas de sellos y premio meta |
| `/portal/negocio/:id/recompensas` | CRUD de recompensas |
| `/portal/negocio/:id/alianzas` | Descubrimiento, propuestas y beneficios de alianzas |
| `/portal/negocio/:id/equipo` | Membresías e invitaciones |
| `/portal/negocio/:id/visitas` | Visitas con filtros y paginación |
| `/portal/negocio/:id/canjes` | Canjes con filtros y paginación |
| `/portal/negocio/:id/cupones` | Cupones emitidos (solo dueño) |
| `/portal/negocio/:id/clientes` | Clientes agregados (solo dueño) |
| `/portal/admin` | Administración global (`admin_sistema`) |
| Cualquier otra | Muestra Inicio mediante la ruta comodín |

Cabecera y pie se comparten en la landing. El portal usa
`src/styles/portal.css`; el diseño emplea CSS propio y Font Awesome. Tailwind no
está instalado. Los textos de planes e IA de la landing son contenido comercial:
no implican pagos ni analítica implementados.

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
  sucursal, navegación por rol, adaptación móvil y botón de Benef AI.
- `src/portal/components/BenefAIChat.tsx`: panel conversacional con historial en
  memoria, sugerencias, estados de carga/error, cancelación y accesibilidad.
- `src/portal/components/PlanPanel.tsx`: plan actual, uso y límites, excedentes
  y funciones Premium con su estado de disponibilidad.
- `src/portal/pages/`: configuración, sucursales con QR, puntos, tarjetas,
  recompensas, alianzas, equipo, visitas, canjes, cupones y clientes.
- `src/pages/InvitationPage.tsx`: aceptación de invitaciones con el correo
  autenticado.

Un consumidor sin membresías no entra al portal: se le redirige a
`/acceso-restringido` con el CTA para registrar su negocio. El onboarding
comercial se completa automáticamente tras confirmar el correo, sin repetir el
formulario. El portal consulta `/planes/` y `/negocios/{id}/plan/`; Django
conserva la autoridad sobre los límites. El QR se genera localmente a partir del
`qr_uuid` de la sucursal; su descarga e impresión están disponibles, y la app
móvil lo escanea con la cámara.

En alianzas, Free puede recibir y aceptar dentro de su cupo, pero proponer es
exclusivo de Premium; el portal muestra el uso y los sublímites del plan. El
detalle está en [identidad y cuentas](../docs/identidad-y-cuentas.md),
[API](../docs/api.md) y [planes](../docs/planes-y-facturacion.md).

## Benef AI

El botón **Benef AI** de la barra superior abre un panel lateral con el negocio
seleccionado. React llama únicamente a
`POST /api/v1/negocios/{id}/benef-ai/chat/`; Django valida membresía, longitud,
historial y rate limit antes de firmar la solicitud hacia Benef AI. El navegador
nunca recibe la clave de Gemini ni el token de servicio.

El historial vive en memoria durante la sesión. Al cambiar de negocio, cerrar
sesión o reiniciar la conversación se aborta la solicitud pendiente y se
descartan respuestas tardías. La UI incluye Enter para enviar, Shift+Enter para
nueva línea, sugerencias, estado de carga, errores recuperables y navegación por
teclado. La arquitectura completa está en
[Benef AI](../benef-ai/README.md).

## Producción

La compilación de producción es un sitio estático:

```bash
cd frontend-web
npm ci
npm run typecheck
npm test
npm run build
```

El resultado está en `dist/`. El hosting debe servir `index.html` para las rutas
del cliente (SPA fallback) y cachear los assets con hash. Variables de build:

```dotenv
VITE_API_BASE_URL=https://<api-host>/api/v1
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave publicable>
```

`VITE_API_BASE_URL` puede ser relativo (`/api/v1`) si el hosting proxya el
backend. No configures claves secretas con prefijo `VITE_`: Vite las expone al
navegador. El detalle de despliegue y seguridad está en
[operaciones](../docs/operaciones.md#portal-web).

## Pruebas

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

- `npm test` ejecuta Vitest sobre componentes, hooks y flujos de autenticación.
- `npm run test:e2e` inicia el servidor de pruebas y ejecuta Playwright con la
  API simulada. Usa Chromium por defecto y no modifica la base remota. Si falta
  el navegador, ejecuta `npx playwright install chromium`. Define
  `PLAYWRIGHT_CHANNEL=msedge` para usar Edge. El workflow
  `.github/workflows/e2e.yml` ejecuta esta suite de forma manual o semanal.
- `tests/smoke.mjs` comprueba el servidor real y HMR sin credenciales.
- `npm run analyze:bundle` genera el manifiesto y revisa el tamaño del bundle.

Las pruebas visuales y de responsive forman parte de Playwright. Consulta
[desarrollo local](../docs/desarrollo-local.md) para el entorno completo.
