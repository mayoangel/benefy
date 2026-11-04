# Frontend web

Dashboard web de Benefy para la administración de comercios afiliados.

## Responsabilidades previstas

- Administrar comercios, programas de lealtad y campañas.
- Mostrar métricas y operaciones del negocio.
- Consumir la API del [`backend`](../backend/README.md).

## Estado actual

Proyecto inicializado con React, TypeScript y Vite. La estructura base es
`src/` (código fuente), `index.html` y `vite.config.ts`.

Las variables de entorno usan el prefijo `VITE_` y Vite las carga
automáticamente desde `frontend-web/.env` (generado a partir de
`.env.example`); en el código se leen con `import.meta.env`.

## Cómo ejecutar

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
```

Otros comandos disponibles:

- `npm run build`: compilación de producción (`tsc -b` + `vite build`).
- `npm run preview`: vista previa del build de producción.
- `npm run lint`: análisis estático con oxlint.

## Tecnologías

React, TypeScript y Vite. Tailwind CSS está previsto para fases posteriores.
