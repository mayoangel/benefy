# Dashboard de demostración de Benefy

El panel general vive en `/administracion` y comparte el diseño del panel de negocio.
Configura `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
en `frontend-web/.env` y habilita el proveedor Google en Supabase. Autoriza
las redirecciones del frontend a `/login` y `/login?panel=administracion`.
El backend comprueba el rol de cada cuenta vinculada. Consulta el
[alta inicial y la configuración de Stripe](../../../backend/README.md#administrador-general).
`VITE_PRIVACY_URL` y `VITE_TERMS_URL` apuntan a los documentos legales publicados.
Los avisos aparecen en `/negocio` al entrar con Google con una cuenta de dueño vinculada.

En desarrollo se puede abrir `/administracion` sin iniciar sesión para recorrer
el panel con datos ficticios de solo lectura. Para habilitar esa vista en una
compilación, usa `VITE_PLATFORM_PREVIEW=true` al compilar.

## Panel de demostración del negocio

Refactor de React 18, TypeScript y CSS propio, sin dependencias nuevas ni llamadas de red.

## Organización

- `BusinessDashboard.tsx`: layout, proveedores y rutas. `App.tsx` lo carga con `React.lazy`, `Suspense` y `Skeleton`.
- `pages/`: `Overview`, `Programs` (pantalla de Dinámicas), `Alliances`, `Clients`, `Branches`, `Subscription` y `Settings`.
- `components/`: Card, Metric, Modal, ConfirmModal, Chart, Heatmap, StatusBadge, Toast, EmptyState, ErrorState, Skeleton, ScreenState, FormField, PageHeading, PeriodFilter, AccountMenu, Tabs, BranchForm, BranchQR, DynamicWizard, DynamicPreview y AllianceWizard.
- `data/`: datos tipados, contexto de sesión, contexto de interfaz, formatos y validaciones independientes de React.
- `hooks/`: operaciones con espera simulada de 600 ms, validación de formularios y protección de cambios sin guardar.
- `dashboard-base.css`: escalas y accesibilidad; `dashboard-layout.css`: estructura y navegación; `dashboard-components.css`: controles y estados; `dashboard-pages.css`: pantallas, tablas móviles e impresión.
- `qa/check.cjs`: comprobaciones de lógica con Node y el TypeScript existente. `qa/audit.cjs`: revisión de textos dañados por codificación.
- Se eliminó `dashboard.css`, el archivo minificado anterior. Los componentes y páginas antes incluidos en el archivo único quedaron separados.

## Comprobaciones ejecutadas

Desde `frontend-web`:

```text
npm run typecheck && npm run build
node src/dashboard/qa/check.cjs
node src/dashboard/qa/audit.cjs
```

Typecheck y build se ejecutaron al finalizar cada fase. La revisión de lógica cubre fechas vacías, fechas inexistentes, periodos invertidos, periodos inclusivos, metas positivas y enteras, cantidades infinitas, descuento máximo de 100 %, conversión de puntos, vigencias estrictas, autoalianzas, comercios inexistentes, IDs y escala mínima de texto. La auditoría final de codificación no devolvió incidencias.

No existen scripts `lint` o `test`, ni un entorno Vitest + Testing Library; no se instaló ninguno. Vite necesitó ejecutarse fuera del sandbox porque esbuild recibió `spawn EPERM` en el entorno restringido.

## Decisiones

- La sesión se mantiene únicamente en memoria, incluso al visitar una página pública y volver. Se restablece al recargar; no se utiliza almacenamiento local.
- Los IDs iniciales son estables. Los nuevos registros utilizan un contador de sesión compartido.
- Archivar una sucursal conserva su registro y empleados, la oculta de la lista de sucursales activas y suspende los accesos de su equipo tras confirmar.
- Un periodo personalizado puede comenzar y terminar el mismo día. Las vigencias de dinámicas y alianzas requieren una fecha final posterior a la inicial.
- Los cupones representan porcentajes; la conversión de puntos indica cuántos MXN de consumo corresponden a un punto.
- Las métricas se escalan por la duración del periodo de forma determinista. En pantallas estrechas, la gráfica agrupa intervalos consecutivos y mantiene una tabla alternativa equivalente.
- Dinámicas comienza sin registros para permitir recorrer el flujo de creación y la lista de arranque. Las solicitudes de alianzas incluyen una solicitud recibida de ejemplo.
- El selector de estados de suscripción está identificado como demostración. El selector flotante de estados de pantalla solo se incluye en desarrollo.
- No existen rutas legales dedicadas en `App`; los enlaces de Configuración abren información de disponibilidad dentro de un modal, sin navegar a páginas inexistentes.
- Al recargar o cerrar la pestaña con cambios, el navegador controla el texto de su aviso nativo. Dentro del dashboard se muestran «Continuar editando» y «Descartar cambios».

## Verificación de interacción pendiente

El acceso directo a pestañas no estaba disponible y venció la solicitud de control de Opera. Por ello no se pudo confirmar visualmente la ausencia de errores de consola ni los siguientes recorridos en un navegador. El código responsive está implementado; esto no equivale a una comprobación visual.

1. Revisar Inicio, ranking, listas y modales a 360, 390, 768, 1024 y 1440 px: sin desbordes, controles de al menos 44 px y scroll interno de modales.
2. Abrir un ConfirmModal, recorrerlo con Tab y Mayús+Tab, cancelar con Escape y verificar que el foco vuelve al disparador. Repetir con el drawer y con la confirmación de descarte sobre un formulario.
3. Crear una sucursal y un empleado, navegar a Dinámicas y volver; comprobar persistencia. Editar, cambiar rol, suspender y reactivar con confirmación.
4. Recorrer los tres tipos de dinámica: errores junto a campos, foco en el primer error, conservación de valores, revisión y vista previa. Crear, consultar, editar y desactivar.
5. Recorrer alianzas: comercio propio ausente, solicitud enviada pendiente, aceptación y rechazo de solicitudes recibidas únicamente tras confirmar.
6. Modificar Configuración y probar enlaces, menú de cuenta, botón Atrás del navegador, recarga y cierre de modal con cambios.
7. Aplicar periodos personalizados válidos e inválidos y comprobar que Inicio y Clientes y métricas reaccionan juntos.
8. Forzar cargando, vacío y error en cada ruta en desarrollo; reintentar y recuperar los datos. Simular desconexión y verificar que un guardado no se confirma.
9. Descargar e imprimir el SVG: debe mostrar siempre «QR de ejemplo, no escaneable». Verificar progreso de la lista de arranque tras descargarlo.
10. Revisar navegación por teclado, pestañas con flechas/Home/End, tooltips de la gráfica, lectores de pantalla y preferencia de movimiento reducido.

## Alcance simulado

Los datos, métricas, guardados, alianzas, acceso de empleados, cambios de plan y portal de facturación son de demostración. No hay autenticación, pagos reales, envío de solicitudes a terceros ni integración con servicios. El SVG del QR es un patrón determinista de ejemplo y no se puede escanear para registrar visitas.
