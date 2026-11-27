# Capacidades de Benef AI

**Versión de la entrega:** 2026-11-27
**Alcance:** dashboard web de negocios. Benef AI sigue siendo un asistente de
solo lectura.

## Arquitectura

```text
React (BenefAIChat)
   │  Bearer de Supabase + negocio + sucursal seleccionada
   ▼
Django  POST /api/v1/negocios/{id}/benef-ai/chat/
   │  - valida membresía y sucursal
   │  - firma HMAC del cuerpo
   ▼
Benef AI  /chat
   │  - obtiene contexto autorizado desde Django
   │  - construye instrucción con identidad, plan, tiempo y permisos
   │  - ejecuta tools de solo lectura
   ▼
Django  /benef-ai/contexto/ y /benef-ai/analitica/
   ▼
PostgreSQL
```

La identidad y los permisos nunca se aceptan desde el texto del usuario. El
negocio viaja en la ruta validada por Django y cada consulta vuelve a aplicar el
alcance del rol y la sucursal.

## Contexto confiable

Django calcula y entrega:

- nombre del usuario, rol comercial y si es propietario;
- negocio, categoría, zona horaria y sucursal seleccionada;
- sucursales autorizadas;
- plan actual, límites, uso, excedentes y estado de suscripción;
- fecha/hora local, fecha de hoy y rangos de:
  `hoy`, `ayer`, `esta semana`, `semana pasada`, `este mes`, `mes pasado`,
  `últimos 7 días`, `últimos 30 días`, `últimos 90 días` y `este año`;
- periodo anterior de igual duración para comparaciones;
- capacidades autorizadas y confirmación de que no puede escribir.

Benef AI no calcula fechas relativas por su cuenta. Cuando una tool recibe
`periodo`, Django resuelve el rango con el reloj y la zona horaria del negocio.
Si recibe fechas explícitas, rechaza fechas futuras, rangos invertidos o rangos
mayores a 366 días.

## Herramientas

### `consultar_analitica`

Una tool parametrizada con los siguientes temas:

| Tema | Datos principales |
| --- | --- |
| `resumen` | visitas válidas/anuladas, clientes únicos, canjes, puntos, cupones, tarjetas completadas, alianzas y comparación |
| `visitas` | total, evolución diaria/semanal/mensual, sucursales, días de mayor actividad, top de clientes (solo dueño) y comparación |
| `clientes` | ranking por visitas, canjes, puntos, última visita o nombre; activos/inactivos; frecuencia; límite top-N |
| `puntos` | otorgados, consumidos, expirados, ajustes, saldo total, lotes, puntos por vencer y fuentes |
| `tarjetas` | configuración, ciclos en curso, sellos actuales, ciclos completados y dinámicas más utilizadas |
| `recompensas` | configuración actual, vigencia, stock, disponibilidad, emisiones, canjes y tasa |
| `cupones` | emitidos, disponibles, canjeados, vencidos, anulados, tasa con denominador explícito y próximos vencimientos |
| `canjes` | total, anulados, por recompensa, sucursal, método y top de clientes (dueño) |
| `sucursales` | visitas, clientes, canjes y última actividad por sucursal autorizada |
| `equipo` | miembros visibles, rol, sucursal, estado e invitaciones pendientes, sin correos |
| `alianzas` | aliado, dirección, estado, vigencia, fecha de fin, días restantes, condición y recompensas compartidas |
| `plan` | plan vigente, límites, uso, excedentes y suscripción |
| `negocio` | identidad y sucursales autorizadas |

Parámetros compartidos: `periodo`, `desde`, `hasta`, `sucursal_id`, `comparar`,
`orden`, `limite` (1-20), `incluir_inactivos` y `estado` para alianzas.

### `consultar_conocimiento_benefy`

Base mantenible en `benef-ai/knowledge.py` con temas:

`general`, `visitas`, `puntos`, `tarjetas`, `recompensas`, `cupones`, `canjes`,
`sucursales`, `qr`, `equipo`, `planes`, `facturacion`, `alianzas`, `clientes`,
`escritura` y `privacidad`.

La base distingue reglas funcionales de los límites numéricos del plan. Los
límites se leen del contexto del negocio, no se duplican en el conocimiento.

## Matriz de capacidades

| Pregunta de ejemplo | Tool / tema | Resultado esperado |
| --- | --- | --- |
| «¿Quién soy y qué negocio administro?» | Contexto inyectado | Nombre, rol, negocio, plan y sucursal autorizada |
| «¿Cuál es mi plan?» | Contexto / `plan` | Plan visible, límites y uso real |
| «¿Tengo alianzas activas?» / «¿Con quién?» | `alianzas` | Aliado, estado, fechas y recompensas |
| «¿Cuándo termina?» | `alianzas` usando historial | Fecha de fin de la alianza mencionada |
| «¿Y el mes pasado?» | `visitas` con `periodo=mes_pasado` | Datos del mes anterior y comparación |
| «¿Qué clientes visitaron más en 30 días?» | `clientes`, `orden=visitas` | Ranking con visitas, última visita y estado |
| «¿Qué recompensas tengo activas?» | `recompensas` | Configuración, vigencia, stock y uso |
| «¿Qué cupones se vencieron?» | `cupones` | Vencidos, disponibles y tasa de canje |
| «¿Qué sucursal tuvo más visitas?» | `visitas` / `sucursales` | Ranking por sucursal |
| «¿Cómo va el uso de mi plan?» | `plan` | Uso y límite por recurso |
| «¿Qué puedo crear con mi plan?» | `plan` + `recompensas`/`tarjetas` | Capacidades reales y límites |
| «¿Puedes crear un cupón?» | `conocimiento:escritura`/`cupones` | Explica que no puede escribir y orienta al portal |
| «¿Qué tipos de cupones existen?» | `conocimiento:cupones` | Orígenes y tipos de beneficio reales |
| «¿Qué pasa si vuelvo al plan gratis?» | `conocimiento:planes` | Conservación de datos y excedentes |

## Seguridad y límites

- Máximo 4 rondas de tools y 6 llamadas por respuesta.
- Historial máximo: 12 turnos y 12 000 caracteres.
- Resultados top-N acotados; las consultas de clientes tienen un máximo de
  1 000 candidatos históricos.
- Timeout total del chat: 40 s por defecto; timeout por llamada Gemini: 30 s.
- Se desactivan los reintentos automáticos del cliente experimental de
  Interactions para respetar el presupuesto de tiempo.
- Si todas las tools devuelven 5xx, el chat responde 502 y no permite que el
  modelo invente una conclusión.
- Si Gemini falla o excede el tiempo, se responde 502/504 con mensaje seguro.
- No hay SQL directo desde Gemini. Todas las consultas pasan por Django.
- No se envían correos, tokens, QR, IDs de pago ni datos de otros negocios al
  modelo.
- El ranking nominal de clientes y el detalle de uso de cupones/puntos están
  reservados al propietario, igual que en el portal.
- El agente no puede cambiar de negocio ni aceptar un `negocio_id` alternativo
  dentro de los argumentos de una tool.

## Contexto conversacional

- El historial se envía como turnos reales `user_input` / `model_output`, no como
  un único bloque de texto.
- Las preguntas de seguimiento reutilizan la conversación y pueden volver a
  consultar la tool para obtener el detalle que falte.
- El componente React reinicia la conversación al cambiar de negocio, de
  sucursal o de sesión y descarta respuestas tardías.
- No hay persistencia de conversaciones; no se almacenan datos personales en una
  base de chat.

## Contrato futuro para acciones con confirmación

No hay acciones de escritura habilitadas. Para una fase futura se reserva este
contrato, sin implementarlo todavía:

```json
{
  "accion": "crear_recompensa",
  "parametros": {},
  "resumen": "Crear una recompensa de 15% para Café Aurora",
  "requiere_confirmacion": true,
  "token_confirmacion": "<token efímero ligado a usuario, negocio y payload>"
}
```

La ejecución requeriría un endpoint separado, permiso de propietario, validación
del payload y confirmación explícita del usuario. Ningún endpoint de escritura
de Benef AI existe en esta entrega.

## Pruebas ejecutadas

- Django: **369 pruebas** (incluye 22 pruebas nuevas de tiempo, contexto,
  analítica, permisos y contrato del proxy).
- Benef AI: **54 pruebas** (contexto, historial, tools, conocimiento, errores,
  timeout, límites y contrato HTTP).
- Vitest: **56 pruebas** (chat, sucursal, reinicio, errores, accesibilidad).
- Playwright: **40 pruebas** (portal, landing, autenticación y responsive).
- TypeScript y build de Vite: correctos.

### Prueba real acotada con Gemini

Se probó con `aurora@benefy.com` y el negocio Café Aurora:

- Identidad y plan: respondió correctamente nombre, negocio y Plan Premium.
- Visitas: respondió 47 visitas válidas en los últimos 30 días, comparadas con
  39 del periodo anterior (+20.5 %).
- Seguimiento «¿Y el mes pasado?»: respondió 40 visitas en octubre de 2026 y
  comparó con el periodo previo.
- Alianzas y recompensas: respondió que no había alianzas activas y listó las
  tres recompensas reales.
- La prueba usó `sucursal_id=7` (Centro) y las fechas locales de Tijuana.
- Durante la ventana de prueba el proveedor Gemini devolvió algunos `503`
  intermitentes; el sistema los manejó como error seguro y no produjo cifras
  inventadas. La prueba se mantuvo por debajo del límite de consumo.

## Limitaciones reales

- No existe un movimiento histórico independiente por sello; se muestran el
  progreso actual, los ciclos completados y las visitas que los hicieron avanzar.
  Si se necesita un histórico exacto por sello, requiere un cambio de modelo de
  fidelización, fuera del alcance de esta mejora.
- Benef AI no ejecuta escrituras ni confirma acciones futuras.
- La conversación no se conserva al recargar la página.
- No hay streaming token por token.
- Las capacidades avanzadas del catálogo Premium (analítica avanzada,
  exportación y personalización) no se anuncian como operativas si aún no lo
  están.
- La disponibilidad y latencia dependen de Gemini; el sistema falla de forma
  segura, pero no puede garantizar disponibilidad del proveedor.
