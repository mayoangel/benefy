# Frontend web

Landing pública de Benefy, implementada con React 18, React Router 6,
TypeScript 5 y Vite 5. Incluye pantallas de acceso (login, registro y
recuperación) simuladas. El dashboard administrativo sigue pendiente.

## Código y páginas

La entrada es `src/main.tsx`, que configura `BrowserRouter` y carga
`src/App.tsx`. Las rutas implementadas son:

| Ruta | Página |
| --- | --- |
| `/` | Inicio |
| `/about` | Información del proyecto |
| `/precios` | Planes y precios de presentación |
| `/login` | Inicio de sesión simulado |
| `/registro` | Registro de negocio simulado |
| `/recuperar` | Recuperación de contraseña simulada |
| Cualquier otra | Muestra Inicio mediante la ruta comodín |

Cabecera y pie se comparten entre páginas. El diseño usa CSS en
`src/styles/tokens.css` y `src/styles/site.css`, además de Font Awesome.
Tailwind no está instalado. Los textos de planes e IA de la landing son
contenido comercial: no implican integraciones de pagos o analítica.

Las pantallas de acceso validan el formulario y muestran un éxito simulado:
no hay SDK Supabase, cliente HTTP ni conexión con los endpoints Django.
Consulta el [estado del producto](../docs/estado-implementacion.md).

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

`typecheck` ejecuta `tsc --noEmit`. `build` solo ejecuta `vite build`;
por eso deben ejecutarse ambos comandos. `preview` sirve el contenido de
`dist/` para revisión local. No hay scripts de pruebas ni lint.

En PowerShell con scripts deshabilitados puedes usar `npm.cmd` en lugar
de `npm`. No es necesario cambiar la política de ejecución del sistema.

## Variables y autenticación futura

Crea `.env` desde [.env.example](./.env.example) si no existe. Vite utiliza
`VITE_*` y el código debe leerlo mediante `import.meta.env`; actualmente
las variables API, Google y Stripe del ejemplo no se consumen.

Para integrar sesiones, el cliente deberá autenticarse en Supabase y enviar
el access token a Django como bearer. El contrato está en
[autenticación](../docs/autenticacion.md) y las rutas en [API](../docs/api.md).
Los nombres `NEXT_PUBLIC_*` de ejemplos Next.js no son los usados por Vite.

Todo valor `VITE_*` termina siendo público en el navegador. No incluyas
claves `service_role`, contraseñas de base de datos ni claves secretas.

## Publicación

`npm run build` produce `dist/`. El hosting debe devolver `index.html`
para rutas como `/about` y `/precios`, dado que se utiliza BrowserRouter.
El montaje de demostración (`compose.demo.yaml`) compila `dist/` con
`frontend-web/Dockerfile` y Caddy lo sirve junto a la API; para un hosting
aparte, publica ese contenido con la misma regla de fallback. El servidor
Vite de desarrollo no es el hosting de producción.
