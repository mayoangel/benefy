import uuid

from django.db import models
from django.utils.text import slugify

# USUARIO
ROLES = (
    ('consumidor', 'Consumidor'),
    ('negocio', 'Usuario de Negocio'),
    ('admin_sistema', 'Administrador del sistema')
)

class Usuario(models.Model):
    # Se conserva el identificador anterior para una vinculación manual auditada.
    legacy_firebase_uid = models.CharField(max_length=128, unique=True, null=True, blank=True, editable=False)
    supabase_uid = models.UUIDField(unique=True, null=True, blank=True, editable=False)
    is_active = models.BooleanField(default=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    correo = models.EmailField(max_length=255, unique=True)
    rol = models.CharField(max_length=30, choices=ROLES, default=ROLES[0][0])
    foto_perfil = models.URLField(max_length=300, blank=True, null=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)

    def __str__(self):
        return self.nombre

    @property
    def is_authenticated(self):
        return self.is_active and self.supabase_uid is not None

    @property
    def is_anonymous(self):
        return False
    
class CategoriaNegocio(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True, default='No hay descripción para esta categoría')

    def __str__(self):
        return self.nombre
    
class Negocio(models.Model):
    stripe_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True, default='No hay descripción para este negocio')
    direccion = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    correo = models.EmailField(max_length=255, unique=True)
    logo_url = models.URLField(max_length=300, blank=True, null=True)
    banner_url = models.URLField(max_length=300, blank=True, null=True)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    zona_horaria = models.CharField(max_length=64, default='America/Tijuana')
    qr_uuid = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    categoria = models.ForeignKey(CategoriaNegocio, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['qr_uuid'], name='negocio_qr_unico'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.nombre)
            slug = base_slug
            contador = 2

            while Negocio.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                sufijo = f"-{contador}"
                slug = f"{base_slug[:170 - len(sufijo)]}{sufijo}"
                contador += 1

            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre

class Sucursal(models.Model):
    nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    ciudad = models.CharField(max_length=100)
    codigo_postal = models.CharField(max_length=10, blank=True, null=True)
    qr_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    nfc_uid = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.negocio.nombre} - {self.nombre}"

ROLES_COMERCIO = (
    ('empleado', 'Empleado'),
    ('admin', 'Administrador'),
    ('dueno', 'Dueño')
)

class UsuarioNegocio(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE, blank=True, null=True)
    rol_comercio = models.CharField(max_length=30, choices=ROLES_COMERCIO, default=ROLES_COMERCIO[0][0])
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return (
            f"{self.usuario.correo} - {self.negocio.nombre} "
            f"({self.get_rol_comercio_display()})"
        )

TIPOS_DINAMICAS = (
    ('puntos', 'Puntos para compras'),
    ('cupones', 'Cupones de descuento'),
    ('sellos', 'Tarjeta de sellos')
)

class Dinamica(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True, default='No hay descripción para esta dinámica')
    tipo = models.CharField(max_length=30, choices=TIPOS_DINAMICAS, default=TIPOS_DINAMICAS[0][0])
    meta = models.PositiveIntegerField(null=True, blank=True)
    regla_conversion = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    es_repetible = models.BooleanField(default=False)
    dias_expiracion_puntos = models.PositiveIntegerField(null=True, blank=True)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField(null=True, blank=True)
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['negocio'],
                condition=models.Q(tipo='puntos', status=True),
                name='una_dinamica_puntos_activa_por_negocio',
            ),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()}) - {self.negocio.nombre}"

ESTADOS_ALIANZA = (
    ('pendiente', 'Pendiente de aprobación'),
    ('activa', 'Activa'),
    ('finalizada', 'Finalizada'),
    ('rechazada', 'Rechazada')
)

class Alianza(models.Model):
    negocio1 = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name="alianza_negocio1")
    negocio2 = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name="alianza_negocio2")
    condicion_participacion = models.TextField()
    status = models.CharField(max_length=30, choices=ESTADOS_ALIANZA, default=ESTADOS_ALIANZA[0][0])
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    fecha_solicitud = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return (
            f"Alianza: {self.negocio1.nombre} -> {self.negocio2.nombre} "
            f"({self.get_status_display()})"
        )

TIPOS_RECOMPENSAS = (
    ('gratis', 'Producto/servicio gratis'),
    ('descuento', 'Porcentaje de descuento'),
    ('descuento_fijo', 'Monto fijo de descuento')
)

class Recompensa(models.Model):
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField()
    tipo = models.CharField(max_length=30, choices=TIPOS_RECOMPENSAS, default=TIPOS_RECOMPENSAS[0][0])
    descuento = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    costo_desbloqueo = models.PositiveIntegerField(default=0)
    terminos_condiciones = models.TextField()
    status = models.BooleanField(default=True)
    negocio = models.ForeignKey(
        Negocio, on_delete=models.PROTECT, null=True, blank=True, related_name='recompensas',
    )
    es_meta = models.BooleanField(default=False)
    fecha_expiracion = models.DateTimeField(null=True, blank=True)
    vigencia_dias = models.PositiveIntegerField(null=True, blank=True)
    cantidad_disponible = models.PositiveIntegerField(null=True, blank=True)
    dinamica = models.ForeignKey(Dinamica, on_delete=models.PROTECT, null=True, blank=True)
    alianza = models.ForeignKey(Alianza, on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['dinamica'],
                condition=models.Q(es_meta=True),
                name='una_recompensa_meta_por_dinamica',
            ),
            models.CheckConstraint(
                condition=models.Q(negocio__isnull=False) | models.Q(alianza__isnull=False),
                name='recompensa_con_origen',
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_expiracion__isnull=False) | models.Q(vigencia_dias__isnull=False),
                name='recompensa_con_vigencia',
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_expiracion__isnull=True) | models.Q(vigencia_dias__isnull=True),
                name='recompensa_vigencia_unica',
            ),
            models.CheckConstraint(
                condition=models.Q(es_meta=False) | models.Q(dinamica__isnull=False),
                name='meta_requiere_dinamica',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.negocio_id is None and self.dinamica_id is not None:
            self.negocio_id = self.dinamica.negocio_id
            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                kwargs['update_fields'] = set(update_fields) | {'negocio'}
        super().save(*args, **kwargs)

    def __str__(self):
        if self.dinamica_id:
            origen = self.dinamica.nombre
        elif self.alianza_id:
            origen = f"Alianza #{self.alianza_id}"
        elif self.negocio_id:
            origen = self.negocio.nombre
        else:
            origen = "Sin origen"
        return f"{self.titulo} [{origen}]"

METODOS_VALIDACION = (
    ('qr', 'Código QR'),
    ('nfc', 'Tag NFC')
)

TIPOS_REGISTRO = (
    ('visita', 'Visita'),
    ('compra', 'Compra')
)


class RegistroActividad(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT, null=True, blank=True)
    metodo_validacion = models.CharField(max_length=30, choices=METODOS_VALIDACION, default=METODOS_VALIDACION[0][0])
    tipo = models.CharField(max_length=30, choices=TIPOS_REGISTRO, default=TIPOS_REGISTRO[0][0])
    monto_transaccion = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)
    fecha_negocio = models.DateField(db_index=True)
    es_valida = models.BooleanField(default=True)
    anulada_en = models.DateTimeField(null=True, blank=True)
    anulada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='visitas_anuladas',
    )
    motivo_anulacion = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'negocio', 'fecha_negocio'],
                condition=models.Q(es_valida=True, tipo='visita'),
                name='visita_unica_diaria_por_negocio',
            ),
        ]
        indexes = [
            models.Index(fields=['negocio', 'fecha_negocio'], name='visita_negocio_fecha_idx'),
        ]

    def __str__(self):
        if self.sucursal_id:
            lugar = self.sucursal.nombre
        elif self.negocio_id:
            lugar = self.negocio.nombre
        else:
            lugar = "sin establecimiento"
        return (
            f"{self.usuario.correo} en {lugar} "
            f"({self.fecha.strftime('%d/%m/%Y %H:%M')})"
        )


class ProgresoUsuario(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    dinamica = models.ForeignKey(Dinamica, on_delete=models.PROTECT)
    saldo_acumulado = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    completado = models.BooleanField(default=False)
    fecha_ultimo_movimiento = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'dinamica'],
                name='progreso_unico_por_usuario_y_dinamica',
            ),
        ]

    def __str__(self):
        return f"{self.usuario.correo} - {self.dinamica.nombre}: {self.saldo_acumulado}"


ESTADOS_CUPON = (
    ('disponible', 'Disponible'),
    ('canjeado', 'Canjeado'),
    ('vencido', 'Vencido'),
    ('anulado', 'Anulado'),
)

ORIGENES_CUPON = (
    ('puntos', 'Adquirido con puntos'),
    ('meta', 'Recompensa de tarjeta'),
    ('admin', 'Emisión administrativa'),
)


class CuponUsuario(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    fecha_emision = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_expiracion = models.DateTimeField()
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    recompensa = models.ForeignKey(Recompensa, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT, null=True, blank=True)
    origen = models.CharField(max_length=30, choices=ORIGENES_CUPON, default='puntos')
    status = models.CharField(max_length=30, choices=ESTADOS_CUPON, default=ESTADOS_CUPON[0][0])
    titulo_beneficio = models.CharField(max_length=150, blank=True, default='')
    descripcion_beneficio = models.TextField(blank=True, default='')
    tipo_beneficio = models.CharField(max_length=30, blank=True, default='gratis')
    descuento_beneficio = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    condiciones_beneficio = models.TextField(blank=True, default='')
    costo_pagado = models.PositiveIntegerField(default=0)
    clave_idempotencia = models.CharField(max_length=64, null=True, blank=True)
    anulada_en = models.DateTimeField(null=True, blank=True)
    anulada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='cupones_anulados',
    )
    motivo_anulacion = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'clave_idempotencia'],
                condition=models.Q(clave_idempotencia__isnull=False),
                name='idempotencia_adquisicion_por_usuario',
            ),
        ]

    def __str__(self):
        return (
            f"{self.recompensa.titulo} ({self.usuario.correo}) - "
            f"{self.get_status_display()}"
        )


class Canje(models.Model):
    cupon = models.ForeignKey(CuponUsuario, on_delete=models.PROTECT)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.PROTECT, null=True, blank=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT, null=True, blank=True)
    validado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    origen = models.CharField(
        max_length=30,
        choices=(('cliente', 'Cliente'), ('personal', 'Personal del negocio')),
        default='personal',
    )
    metodo = models.CharField(
        max_length=30,
        choices=(('visual', 'Validación visual'), ('personal', 'Registro por personal')),
        default='personal',
    )
    token_validacion = models.UUIDField(null=True, blank=True, unique=True)
    expira_en = models.DateTimeField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)
    anulado = models.BooleanField(default=False)
    anulado_en = models.DateTimeField(null=True, blank=True)
    anulado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='canjes_anulados',
    )
    motivo_anulacion = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cupon'], name='un_canje_por_cupon'),
        ]

    def __str__(self):
        lugar = self.sucursal.nombre if self.sucursal_id else (self.negocio.nombre if self.negocio_id else "sin sucursal")
        return f"Canje de {self.cupon} en {lugar}"


class SaldoPuntos(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    saldo_actual = models.PositiveIntegerField(default=0)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'negocio'],
                name='saldo_unico_por_negocio',
            ),
        ]

    def __str__(self):
        return f"{self.usuario.correo} - {self.negocio.nombre}: {self.saldo_actual} puntos"


class LotePuntos(models.Model):
    ORIGENES = (
        ('visita', 'Visita'),
        ('ajuste', 'Ajuste administrativo'),
        ('alianza', 'Alianza'),
    )

    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    dinamica = models.ForeignKey(Dinamica, on_delete=models.PROTECT, null=True, blank=True)
    origen = models.CharField(max_length=30, choices=ORIGENES, default='visita')
    cantidad_otorgada = models.PositiveIntegerField()
    cantidad_disponible = models.PositiveIntegerField()
    fecha_otorgamiento = models.DateTimeField()
    fecha_expiracion = models.DateTimeField(null=True, blank=True)
    referencia = models.CharField(max_length=64, null=True, blank=True)
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='lotes_puntos_creados',
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad_disponible__lte=models.F('cantidad_otorgada')),
                name='lote_cantidad_coherente',
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_expiracion__isnull=True)
                | models.Q(fecha_expiracion__gte=models.F('fecha_otorgamiento')),
                name='lote_expiracion_posterior',
            ),
            models.UniqueConstraint(
                fields=['negocio', 'referencia'],
                condition=models.Q(origen='visita'),
                name='un_lote_por_visita',
            ),
        ]

    def __str__(self):
        return f"Lote {self.pk}: {self.cantidad_disponible}/{self.cantidad_otorgada}"


class MovimientoPuntos(models.Model):
    TIPOS = (
        ('otorgado', 'Otorgado'),
        ('consumido', 'Consumido'),
        ('expirado', 'Expirado'),
        ('ajuste', 'Ajuste'),
    )

    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    lote = models.ForeignKey(LotePuntos, on_delete=models.PROTECT, null=True, blank=True)
    cupon = models.ForeignKey(CuponUsuario, on_delete=models.PROTECT, null=True, blank=True)
    tipo = models.CharField(max_length=30, choices=TIPOS)
    cantidad = models.IntegerField()
    referencia = models.CharField(max_length=64, null=True, blank=True)
    descripcion = models.CharField(max_length=255, blank=True, default='')
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='movimientos_puntos_creados',
    )
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(cantidad=0),
                name='movimiento_cantidad_no_cero',
            ),
            models.CheckConstraint(
                condition=models.Q(tipo='ajuste')
                | models.Q(tipo='otorgado', cantidad__gt=0)
                | models.Q(tipo__in=['consumido', 'expirado'], cantidad__lt=0),
                name='movimiento_signo_coherente',
            ),
            models.UniqueConstraint(
                fields=['lote'],
                condition=models.Q(tipo='expirado'),
                name='una_expiracion_por_lote',
            ),
            models.UniqueConstraint(
                fields=['lote', 'referencia'],
                condition=models.Q(tipo__in=['consumido', 'ajuste'], referencia__isnull=False),
                name='un_consumo_por_lote_y_operacion',
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.cantidad} puntos ({self.usuario.correo})"


class CicloTarjeta(models.Model):
    ESTADOS = (
        ('en_curso', 'En curso'),
        ('completado', 'Completado'),
        ('anulado', 'Anulado'),
    )

    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    dinamica = models.ForeignKey(Dinamica, on_delete=models.PROTECT)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    numero_ciclo = models.PositiveIntegerField(default=1)
    sellos_actuales = models.PositiveIntegerField(default=0)
    meta = models.PositiveIntegerField()
    recompensa = models.ForeignKey(Recompensa, on_delete=models.PROTECT, null=True, blank=True)
    recompensa_titulo = models.CharField(max_length=150, blank=True, default='')
    recompensa_descripcion = models.TextField(blank=True, default='')
    recompensa_tipo = models.CharField(max_length=30, blank=True, default='gratis')
    recompensa_descuento = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    recompensa_condiciones = models.TextField(blank=True, default='')
    recompensa_vigencia_dias = models.PositiveIntegerField(null=True, blank=True)
    recompensa_fecha_expiracion = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=30, choices=ESTADOS, default='en_curso')
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField(null=True, blank=True)
    cupon = models.ForeignKey(CuponUsuario, on_delete=models.PROTECT, null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'dinamica', 'numero_ciclo'],
                name='ciclo_unico_por_numero',
            ),
            models.UniqueConstraint(
                fields=['usuario', 'dinamica'],
                condition=models.Q(estado='en_curso'),
                name='un_ciclo_en_curso',
            ),
            models.UniqueConstraint(
                fields=['cupon'],
                condition=models.Q(cupon__isnull=False),
                name='un_cupon_por_ciclo',
            ),
            models.CheckConstraint(
                condition=models.Q(sellos_actuales__lte=models.F('meta')),
                name='ciclo_sellos_en_rango',
            ),
        ]

    def __str__(self):
        return f"Ciclo {self.numero_ciclo} de {self.dinamica.nombre} ({self.usuario.correo})"

INTERVALOS_FACTURACION = (
    ('mensual', 'Mensual'),
    ('anual', 'Anual')
)

class PlanSuscripcion(models.Model):
    nombre = models.CharField(max_length=150, unique=True)
    descripcion = models.TextField()
    intervalo = models.CharField(max_length=30, choices=INTERVALOS_FACTURACION, default=INTERVALOS_FACTURACION[0][0])
    stripe_price_id = models.CharField(max_length=100, unique=True, db_index=True)
    limite_sucursales = models.PositiveIntegerField(default=1)
    limite_dinamicas = models.PositiveIntegerField(default=3)
    status = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombre} ({self.get_intervalo_display()})"

ESTADOS_SUSCRIPCION = (
    ('activa', 'Activa'),
    ('pendiente', 'Pago pendiente'),
    ('prueba', 'En prueba'),
    ('incompleta', 'Incompleta'),
    ('cancelada', 'Cancelada'),
)

class Suscripcion(models.Model):
    stripe_subscription_id = models.CharField(max_length=100, unique=True, db_index=True)
    status = models.CharField(max_length=30, choices=ESTADOS_SUSCRIPCION, default=ESTADOS_SUSCRIPCION[3][0])
    periodo_actual_inicio = models.DateTimeField()
    periodo_actual_fin = models.DateTimeField()
    en_cancelacion = models.BooleanField(default=False)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE)
    plan = models.ForeignKey(PlanSuscripcion, on_delete=models.PROTECT)

    def __str__(self):
        return f"{self.negocio.nombre} - {self.plan.nombre} ({self.get_status_display()})"

ESTADOS_PAGO = (
    ('pagado', 'Pagado'),
    ('fallido', 'Fallido / Rechazado'),
    ('reembolsado', 'Reembolsado')
)

DIVISAS = (
    ('MXN', 'Peso Mexicano'),
    ('USD', 'Dolar americano')
)

class Pago(models.Model):
    stripe_invoice_id = models.CharField(max_length=100, unique=True, db_index=True)
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    divisa = models.CharField(max_length=30, choices=DIVISAS, default=DIVISAS[0][0])
    status = models.CharField(max_length=30, choices=ESTADOS_PAGO, default=ESTADOS_PAGO[0][0])
    recibo_url = models.URLField(max_length=500, blank=True, null=True)
    fecha_pago = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.PROTECT)
    suscripcion = models.ForeignKey(Suscripcion, on_delete=models.PROTECT)

    def __str__(self):
        return (
            f"Pago #{self.stripe_invoice_id} - {self.negocio.nombre} "
            f"(${self.monto} {self.divisa})"
        )

TIPOS_NOTIFICACION = (
    ('alianza', 'Cupón de alianza desbloqueado'),
    ('cupon', 'Recompensa / Cupón disponible'),
    ('visita', 'Saldo de lealtad acumulado'),
    ('promocion', 'Aviso de promoción'),
    ('sistema', 'Aviso de la plataforma')
)

class Notificacion(models.Model):
    titulo = models.CharField(max_length=150)
    cuerpo = models.TextField()
    tipo = models.CharField(max_length=30, choices=TIPOS_NOTIFICACION, default=TIPOS_NOTIFICACION[4][0])
    fcm_token_destino = models.CharField(max_length=255, blank=True, null=True)
    leida = models.BooleanField(default=False)
    fecha_envio = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        destinatario = (
            self.usuario.correo
            if self.usuario is not None
            else self.fcm_token_destino or "sin destinatario"
        )
        return f"Push para {destinatario}: {self.titulo}"
