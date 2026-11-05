import uuid
from django.db import models
from django.utils.text import slugify
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError

# USUARIO
ROLES = (
    ('consumidor', 'Consumidor'),
    ('negocio', 'Usuario de Negocio'),
    ('admin_sistema', 'Administrador del sistema')
)

class Usuario(models.Model):
    firebase_uid = models.CharField(max_length=128, unique=True)
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
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    categoria = models.ForeignKey(CategoriaNegocio, on_delete=models.PROTECT)

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
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE)
    rol_comercio = models.CharField(max_length=30, choices=ROLES_COMERCIO, default=ROLES_COMERCIO[0][0])
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return f"{self.usuario.email} - {self.negocio.nombre} ({self.get_rol_negocio_display()})"

TIPOS_DINAMICAS = (
    ('puntos', 'Puntos para compras'),
    ('cupones', 'Cupones de descuento'),
    ('sellos', 'Tarjeta de sellos')
)

class Dinamica(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True, default='No hay descripción para esta dinámica')
    tipo = models.CharField(max_length=30, choices=TIPOS_DINAMICAS, default=TIPOS_DINAMICAS[0][0])
    meta = models.PositiveIntegerField()
    regla_conversion = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    status = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_actualizacion = models.DateTimeField(auto_now_add=False, auto_now=True)
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_programa_display()}) - {self.negocio.nombre}"

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
        return f"Alianza: {self.negocio1.nombre} -> {self.negocio2.nombre} ({self.estado})"

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
    dinamica = models.ForeignKey(Dinamica, on_delete=models.CASCADE, null=True, blank=True)
    alianza = models.ForeignKey(Alianza, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        origen = self.dinamica.nombre if self.dinamica else f"Alianza #{self.alianza_id}"
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
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE)
    metodo_validacion = models.CharField(max_length=30, choices=METODOS_VALIDACION, default=METODOS_VALIDACION[0][0])
    tipo = models.CharField(max_length=30, choices=TIPOS_REGISTRO, default=TIPOS_REGISTRO[0][0])
    monto_transaccion = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)

    def __str__(self):
        return f"{self.usuario.email} en {self.sucursal.nombre} ({self.fecha_hora.strftime('%d/%m/%Y %H:%M')})"

class ProgresoUsuario(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    dinamica = models.ForeignKey(Dinamica, on_delete=models.CASCADE)
    saldo_acumulado = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    completado = models.BooleanField(default=False)
    fecha_ultimo_movimiento = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.usuario.email} - {self.dinamica.nombre}: {self.saldo_acumulado}"

ESTADOS_CUPON = (
    ('disponible', 'Disponible'),
    ('canjeado', 'Canjeado'),
    ('vencido', 'Vencido')
)

class CuponUsuario(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    fecha_emision = models.DateTimeField(auto_now_add=True, auto_now=False)
    fecha_expiracion = models.DateTimeField()
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    recompensa = models.ForeignKey(Recompensa, on_delete=models.CASCADE)
    status = models.CharField(max_length=30, choices=ESTADOS_CUPON, default=ESTADOS_CUPON[0][0])
    
    def __str__(self):
        return f"{self.recompensa.titulo} ({self.usuario.email}) - {self.get_estado_display()}"

class Canje(models.Model):
    cupon = models.ForeignKey(CuponUsuario, on_delete=models.CASCADE)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE)
    validado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, auto_now=False, db_index=True)

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
        return f"Pago #{self.stripe_invoice_id} - {self.negocio.nombre} (${self.monto} {self.moneda})"

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
        return f"Push para {self.usuario.email}: {self.titulo}"