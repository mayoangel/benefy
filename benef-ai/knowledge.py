"""Base de conocimiento funcional de Benefy para Benef AI.

Se mantiene deliberadamente cerca de la implementación real. Los límites
numéricos de los planes no se fijan aquí: se leen del contexto del negocio.
"""

from dataclasses import dataclass

VERSION = '2026-11-27'


@dataclass(frozen=True)
class Tema:
    id: str
    titulo: str
    contenido: str
    pantallas: tuple[str, ...] = ()
    relacionados: tuple[str, ...] = ()


TEMAS = {
    'general': Tema(
        'general',
        'Qué es Benefy',
        (
            'Benefy es una plataforma de lealtad para negocios. Permite registrar '
            'visitas con QR, otorgar puntos, avanzar tarjetas de sellos, emitir '
            'cupones y validar canjes. El portal de negocios separa la operación '
            'por negocio y sucursal, y los clientes usan la experiencia móvil para '
            'consultar su progreso y sus beneficios.'
        ),
        relacionados=('visitas', 'puntos', 'tarjetas', 'cupones'),
    ),
    'visitas': Tema(
        'visitas',
        'Visitas y límite diario',
        (
            'El cliente registra una visita escaneando el QR del negocio o de una '
            'sucursal. Solo se permite una visita válida por cliente y negocio al '
            'día; el día se calcula con la zona horaria del negocio. Si el cliente '
            'vuelve a escanear el mismo día, la visita no vuelve a otorgar puntos '
            'ni sellos. La primera visita válida del día también otorga puntos y '
            'avanza las tarjetas elegibles. Una visita puede anularse mediante un '
            'flujo auditado; anularla no revierte automáticamente puntos ni sellos.'
        ),
        pantallas=('Portal > Actividad > Visitas',),
        relacionados=('puntos', 'tarjetas', 'qr'),
    ),
    'puntos': Tema(
        'puntos',
        'Puntos por visita',
        (
            'Cada negocio puede tener un solo programa de puntos activo. El negocio '
            'define cuántos puntos otorga cada visita y, opcionalmente, cuántos días '
            'duran. Los puntos se guardan por lotes y el consumo usa primero los '
            'lotes con expiración más próxima; los lotes sin expiración se consumen '
            'al final. Los cambios de configuración no modifican puntos ya '
            'otorgados. El saldo se comparte entre las sucursales del negocio.'
        ),
        pantallas=('Portal > Fidelización > Puntos',),
        relacionados=('visitas', 'recompensas', 'tarjetas'),
    ),
    'tarjetas': Tema(
        'tarjetas',
        'Tarjetas de sellos',
        (
            'Una visita válida avanza un sello en cada tarjeta de sellos elegible. '
            'Cada tarjeta tiene una meta y una única recompensa meta. Si es '
            'repetible, al completar la meta se emite el cupón y comienza un nuevo '
            'ciclo; si es de una sola ocasión, el cliente no vuelve a iniciar ciclos '
            'para esa tarjeta. Los ciclos ya iniciados conservan su meta y su '
            'recompensa aunque la configuración cambie. Una tarjeta desactivada no '
            'inicia ciclos nuevos, pero los ciclos en curso pueden completarse.'
        ),
        pantallas=('Portal > Fidelización > Tarjetas',),
        relacionados=('visitas', 'recompensas', 'cupones'),
    ),
    'recompensas': Tema(
        'recompensas',
        'Recompensas',
        (
            'Las recompensas pueden ser producto o servicio gratis, porcentaje de '
            'descuento o monto fijo de descuento. Se adquieren con puntos o se '
            'entregan como meta de una tarjeta. Tienen vigencia y, si se configura, '
            'stock limitado. Una recompensa con puntos descuenta el saldo al '
            'adquirirse y emite un cupón; una recompensa meta se emite al completar '
            'el ciclo. El propietario puede crear y editar recompensas desde el '
            'portal, respetando el límite de su plan.'
        ),
        pantallas=('Portal > Fidelización > Recompensas',),
        relacionados=('cupones', 'puntos', 'tarjetas', 'planes'),
    ),
    'cupones': Tema(
        'cupones',
        'Cupones',
        (
            'Un cupón es un beneficio emitido a un cliente. Puede originarse al '
            'adquirir una recompensa con puntos, al completar una tarjeta o por una '
            'emisión administrativa. Conserva el título, las condiciones, el costo y '
            'la vigencia del momento en que se emitió. Se valida una sola vez y no '
            'puede reactivarse. Los cupones disponibles pueden vencer si llega su '
            'fecha de expiración. El propietario no crea cupones manualmente desde '
            'el portal: se generan al adquirir recompensas o completar tarjetas. '
            'Benef AI no puede emitir ni canjear cupones.'
        ),
        pantallas=('Portal > Actividad > Cupones',),
        relacionados=('recompensas', 'canjes', 'tarjetas', 'escritura'),
    ),
    'canjes': Tema(
        'canjes',
        'Canjes',
        (
            'El canje se inicia desde la experiencia del cliente. El cupón se '
            'consume al confirmar, no al terminar el contador; el contador usa la '
            'hora del backend y por defecto dura cinco minutos. Un cupón canjeado no '
            'puede reactivarse. El negocio puede consultar los canjes y su estado, '
            'pero no puede modificar directamente visitas, puntos, cupones ni canjes '
            'desde Benef AI; las correcciones usan anulación o ajuste auditados.'
        ),
        pantallas=('Portal > Actividad > Canjes',),
        relacionados=('cupones', 'escritura'),
    ),
    'sucursales': Tema(
        'sucursales',
        'Sucursales y QR',
        (
            'El propietario administra las sucursales del negocio. Cada sucursal '
            'tiene su propio QR y su actividad se registra por separado, aunque los '
            'puntos, tarjetas y cupones son del negocio completo. También existe un '
            'QR general del negocio. El número de sucursales activas permitido '
            'depende del plan vigente. Supervisores y empleados solo operan en las '
            'sucursales autorizadas.'
        ),
        pantallas=(
            'Portal > Administración > Sucursales',
            'Portal > Configuración > Ver QR del negocio',
        ),
        relacionados=('qr', 'equipo', 'planes', 'visitas'),
    ),
    'qr': Tema(
        'qr',
        'Códigos QR',
        (
            'Cada sucursal tiene un QR propio y el negocio tiene un QR general. El '
            'cliente escanea el QR para registrar su visita; la visita queda '
            'asociada al negocio y, cuando corresponde, a la sucursal. El QR se '
            'puede consultar, descargar o imprimir desde el portal. Compartir el QR '
            'no otorga acceso al portal ni a los datos del negocio.'
        ),
        pantallas=(
            'Portal > Administración > Sucursales > Ver QR',
            'Portal > Configuración > Ver QR del negocio',
        ),
        relacionados=('visitas', 'sucursales'),
    ),
    'equipo': Tema(
        'equipo',
        'Roles y equipo',
        (
            'El propietario administra el negocio completo, sus sucursales, el '
            'equipo, las recompensas y el plan. El supervisor consulta y opera la '
            'actividad de la sucursal asignada. El empleado registra visitas y valida '
            'canjes dentro de su sucursal. Los roles no dependen del plan. El '
            'propietario puede invitar integrantes desde el portal y el número de '
            'supervisores y empleados activos depende del plan. Un integrante puede '
            'tener membresías laborales en más de un negocio, pero una cuenta solo '
            'puede ser propietaria de un negocio activo.'
        ),
        pantallas=('Portal > Administración > Equipo',),
        relacionados=('sucursales', 'planes', 'privacidad'),
    ),
    'planes': Tema(
        'planes',
        'Planes gratis y premium',
        (
            'El plan pertenece al negocio. El plan gratis está pensado para '
            'empezar con una sucursal y un equipo pequeño. El plan premium amplía '
            'la capacidad de sucursales, tarjetas de sellos, recompensas y equipo, '
            'y habilita la posibilidad de proponer alianzas. Los límites exactos y '
            'el uso actual están en el contexto del negocio y en la pantalla del '
            'plan; no deben inventarse ni suponerse. Cambiar de plan no borra '
            'datos: los recursos que excedan un límite se conservan y bloquean '
            'nuevas altas hasta regularizarse. La contratación se realiza desde la '
            'sección de Suscripción del portal. Si el contexto del plan marca una '
            'función del catálogo como no implementada, no la presentes como '
            'disponible.'
        ),
        pantallas=(
            'Portal > Administración > Suscripción',
            'Portal > Administración > Plan y facturación',
        ),
        relacionados=('facturacion', 'sucursales', 'equipo', 'recompensas'),
    ),
    'facturacion': Tema(
        'facturacion',
        'Facturación y suscripción',
        (
            'El plan premium se contrata desde la sección de Suscripción del portal. '
            'La pantalla muestra el importe vigente, la modalidad mensual o anual y '
            'el estado de la suscripción. En este entorno la facturación opera en '
            'modo de prueba: no se realizan cargos reales ni se emiten facturas '
            'fiscales. La cancelación programada conserva el acceso hasta el final '
            'del periodo pagado y después el negocio vuelve al plan gratis sin '
            'perder su historial. No afirmes que un pago fue real ni inventes '
            'importes: consulta el estado y los precios reales.'
        ),
        pantallas=('Portal > Administración > Suscripción',),
        relacionados=('planes',),
    ),
    'alianzas': Tema(
        'alianzas',
        'Alianzas comerciales',
        (
            'Dos negocios pueden acordar un beneficio para los clientes del otro. '
            'El plan gratis puede recibir y aceptar alianzas dentro de su cupo, '
            'pero no puede proponerlas. El plan premium puede proponer y recibir, '
            'con cupos separados para aliados del plan gratis y del plan premium. '
            'Las recompensas de una alianza pertenecen al negocio que las ofrece y '
            'solo aparecen mientras la alianza está activa y vigente. Una alianza '
            'activa puede vencer por fecha de fin; finalizarla no borra el historial.'
        ),
        pantallas=(
            'Portal > Alianzas',
            'Portal > Fidelización > Recompensas',
        ),
        relacionados=('planes', 'recompensas', 'cupones'),
    ),
    'clientes': Tema(
        'clientes',
        'Clientes y privacidad',
        (
            'El propietario puede consultar los clientes del negocio, sus visitas, '
            'puntos y cupones. El ranking de clientes se calcula con visitas válidas '
            'del periodo; un cliente activo tiene al menos una visita en el periodo '
            'y uno inactivo tiene historial previo pero ninguna visita en el periodo. '
            'Los correos y datos personales no se muestran en las respuestas del '
            'asistente. Supervisores y empleados no reciben rankings nominales de '
            'clientes; su alcance es la operación de su sucursal.'
        ),
        pantallas=('Portal > Actividad > Clientes',),
        relacionados=('visitas', 'privacidad', 'equipo'),
    ),
    'escritura': Tema(
        'escritura',
        'Operaciones de escritura',
        (
            'Benef AI es un asistente de solo lectura. No puede crear, editar, '
            'anular ni canjear recompensas, tarjetas, cupones, visitas, puntos, '
            'pagos, alianzas ni membresías. Cuando el usuario pida una acción, '
            'explica que todavía no está disponible desde el asistente y oriéntalo '
            'a la pantalla real del portal. No confundas esta limitación del '
            'asistente con una falta de permisos del usuario.'
        ),
        pantallas=(
            'Portal > Fidelización > Recompensas',
            'Portal > Fidelización > Tarjetas',
            'Portal > Administración > Sucursales',
            'Portal > Administración > Equipo',
            'Portal > Alianzas',
        ),
        relacionados=('recompensas', 'cupones', 'tarjetas', 'canjes'),
    ),
    'privacidad': Tema(
        'privacidad',
        'Privacidad y alcance',
        (
            'Benef AI solo consulta el negocio y las sucursales autorizadas para el '
            'usuario autenticado. No puede cambiar de negocio, suplantar a otra '
            'persona ni consultar información de negocios ajenos. Las respuestas no '
            'incluyen correos, tokens, identificadores de pago ni datos personales '
            'innecesarios. Si una consulta no tiene permisos, se explica el límite '
            'del rol en lugar de inventar datos.'
        ),
        relacionados=('clientes', 'equipo'),
    ),
}


def obtener_tema(tema):
    return TEMAS.get((tema or '').strip().lower())


def indice():
    return [
        {'tema': item.id, 'titulo': item.titulo}
        for item in TEMAS.values()
    ]


def como_dict(tema):
    item = obtener_tema(tema)
    if item is None:
        return {
            'error': 'tema_desconocido',
            'detalle': 'Elige uno de los temas disponibles.',
            'temas': indice(),
        }
    return {
        'version': VERSION,
        'tema': item.id,
        'titulo': item.titulo,
        'contenido': item.contenido,
        'pantallas': list(item.pantallas),
        'relacionados': list(item.relacionados),
    }
