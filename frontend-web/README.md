# Frontend web

Frontend web de Benefy. Actualmente implementa la landing pública; el
dashboard administrativo continúa como una responsabilidad prevista.

## Responsabilidades previstas

- Administrar comercios, programas de lealtad y campañas.
- Mostrar métricas y operaciones del negocio.
- Consumir la API del [`backend`](../backend/README.md).

## Estado actual

Proyecto con React, React Router, TypeScript y Vite. Incluye las páginas de
inicio, información y precios.

Las variables de entorno usan el prefijo `VITE_` y Vite las carga
automáticamente desde `frontend-web/.env` (generado a partir de
`.env.example`); en el código se leen con `import.meta.env`.

## Cómo ejecutar

```bash
npm ci
npm run dev       # servidor de desarrollo en http://localhost:5173
```

Otros comandos disponibles:

- `npm run typecheck`: verificación de tipos sin generar archivos.
- `npm run build`: compilación de producción con Vite.
- `npm run preview`: vista previa del build de producción.

## Tecnologías

React, TypeScript y Vite. Tailwind CSS está previsto para fases posteriores.
