# Reglas de lealtad — Benefy MVP

**Estado:** aprobadas.
**Alcance:** visitas, puntos, tarjetas de visitas, catálogo y canje de cupones.
**Fuera del MVP:** alianzas con puntos compartidos, beneficios cruzados, NFC, QR
dinámicos y analíticas avanzadas.

Los contratos de API están en [api.md](./api.md).

---

## 1. Visitas

- El cliente registra la visita escaneando un QR de negocio o de sucursal.
- Solo se permite **una visita válida por cliente y negocio al día**.
- El día se calcula con la zona horaria configurada del negocio, no con la del dispositivo.
- La restricción aplica a registros `tipo='visita'`; otros tipos de actividad no se ven afectados.
- La primera visita también otorga puntos y avanza tarjetas.
- Si el cliente vuelve a escanear el mismo día, el backend responde HTTP 200 con `already_registered: true` y no vuelve a otorgar beneficios.
- La sucursal puede ser nula cuando se usa el QR general del negocio.
- Puntos, tarjetas y cupones se comparten entre todas las sucursales del negocio.

## 2. Puntos

- Cada negocio puede tener **una sola dinámica de puntos activa**.
- Cada visita válida otorga los puntos definidos por `regla_conversion` de esa dinámica.
- Los puntos se guardan en **lotes** con origen, cantidad, fecha de otorgamiento, fecha de expiración y saldo disponible.
- Los puntos no caducan por defecto. El negocio puede configurar `dias_expiracion_puntos`.
- El consumo es **FIFO por fecha de expiración más próxima**; los lotes sin expiración se consumen al final.
- Un lote vencido no se consume.
- La expiración genera un movimiento y descuenta el saldo una sola vez.
- Cada consumo registra los lotes específicos de los que se descontaron puntos.
- Los cambios de configuración no alteran puntos ya otorgados.

## 3. Tarjetas de visitas

- Un negocio puede tener varias tarjetas activas.
- Cada visita válida avanza **exactamente un sello** en cada tarjeta elegible.
- Cada tarjeta tiene **una única recompensa meta**.
- La tarjeta puede ser:
  - **Repetible:** al completar la meta se emite la recompensa y comienza un nuevo ciclo desde cero.
  - **De una sola ocasión:** al completar la meta se emite la recompensa y la tarjeta queda completada para ese cliente.
- El historial de ciclos se conserva; cada ciclo guarda su meta y los datos de la recompensa al iniciar.
- Los cambios posteriores de configuración no afectan ciclos ya iniciados.
- Si la tarjeta se desactiva, los ciclos existentes pueden completarse y recibir su recompensa, pero no se crean ciclos nuevos hasta que vuelva a estar activa y vigente.

## 4. Catálogo y adquisición de cupones

- Las recompensas pertenecen al negocio y pueden existir con o sin dinámica.
- Una recompensa puede adquirirse con puntos o entregarse como meta de una tarjeta.
- Toda recompensa tiene una vigencia explícita: fecha de expiración o duración desde la adquisición.
- Si la recompensa pertenece a una dinámica con fecha de fin, el cupón no puede superar esa fecha.
- Si pertenece a una alianza, el cupón nunca puede expirar después del fin de la alianza.
- La adquisición es atómica: descuenta puntos, reserva stock y emite el cupón en una sola transacción.
- La adquisición exige una **clave de idempotencia** generada por el cliente. La misma clave debe reutilizarse en reintentos; si se usa para otra recompensa u operación, el backend responde conflicto.
- Un cupón adquirido conserva sus condiciones aunque la recompensa o la dinámica cambien.

## 5. Canje

- El canje lo inicia el cliente desde la aplicación móvil.
- Antes de confirmar se muestra una advertencia de que es irreversible.
- El cupón se consume al confirmar, no al terminar el contador.
- No requiere confirmación digital del cajero.
- La pantalla de validación muestra nombre y descripción del beneficio, contador regresivo, hora actual, barra de progreso e identificación del establecimiento.
- El contador usa la hora del backend; por defecto dura 5 minutos y es configurable por entorno (`CANJE_VALIDACION_SEGUNDOS`).
- Un cupón canjeado no puede reactivarse.

## 6. Historial y correcciones

- No se eliminan ni se modifican directamente visitas, movimientos de puntos, adquisiciones ni canjes.
- Las correcciones se hacen con anulación o ajuste auditados.
- Toda anulación registra fecha, responsable y motivo.
- Anular una visita no revierte puntos automáticamente.
- Anular un cupón no devuelve automáticamente los puntos gastados.
- Los ajustes de puntos solo los realiza `admin_sistema` y no pueden dejar saldo negativo.
- Los ajustes y anulaciones conservan el registro original.

## 7. Seguridad y consistencia

El backend impide:

- Registrar más de una visita válida por cliente y negocio al día.
- Otorgar puntos duplicados por solicitudes repetidas.
- Completar una tarjeta más de una vez por concurrencia.
- Adquirir cupones sin puntos suficientes.
- Entregar más cupones que el stock disponible.
- Canjear un cupón más de una vez.
- Utilizar puntos de una alianza vencida.

## 8. Configuración del negocio

Cada negocio define puntos por visita, vigencia de los puntos, número de visitas
por tarjeta, si la tarjeta es repetible o de una sola ocasión, recompensas con
costos/stock/vigencias y fechas de sus dinámicas.

Benefy no calcula recompensas a partir de montos de compra ni se integra
obligatoriamente con POS o pasarelas de pago.
