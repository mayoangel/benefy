from rest_framework import serializers

from core import models

# Usuario Serializers

#Create
class UsuarioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = [
            "firebase_uid",
            "nombre",
            "apellido",
            "telefono",
            "correo",
            "rol",
            "foto_perfil",
        ]

#List
class UsuarioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = [
            "id",
            "nombre",
            "apellido",
            "correo",
            "rol",
        ]

#Retrieve
class UsuarioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = "__all__"

#Update
class UsuarioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = [
            "nombre",
            "apellido",
            "telefono",
            "correo",
            "rol",
            "foto_perfil",
        ]
#Delete
class UsuarioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = "__all__"

#Categoria-Negocio Serializers

#Create
class CategoriaNegocioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.CategoriaNegocio
        fields = [
            "nombre",
            "descripcion",
        ]

#List
class CategoriaNegocioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.CategoriaNegocio
        fields = [
            "id",
            "nombre",
        ]

#Retrieve
class CategoriaNegocioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.CategoriaNegocio
        fields = "__all__"

#Update
class CategoriaNegocioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.CategoriaNegocio
        fields = [
            "nombre",
            "descripcion",
        ]
#Delete
class CategoriaNegocioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.CategoriaNegocio
        fields = "__all__"


#Negocio Serializers

#Create
class NegocioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = [
            "stripe_id",
            "nombre",
            "descripcion",
            "direccion",
            "telefono",
            "correo",
            "logo_url",
            "banner_url",
            "slug",
            "status",
            "categoria",
        ]

#List
class NegocioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = [
            "id",
            "nombre",
            "slug",
            "status",
            "categoria",
        ]

#Retrieve
class NegocioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = "__all__"

#Update
class NegocioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = [
            "stripe_id",
            "nombre",
            "descripcion",
            "direccion",
            "telefono",
            "correo",
            "logo_url",
            "banner_url",
            "slug",
            "status",
            "categoria",
        ]
#Delete
class NegocioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = "__all__"


#Sucursal Serializers

#Create
class SucursalSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = [
            "nombre",
            "direccion",
            "telefono",
            "ciudad",
            "codigo_postal",
            "qr_uuid",
            "nfc_uid",
            "status",
            "negocio",
        ]

#List
class SucursalSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = [
            "id",
            "nombre",
            "direccion",
            "ciudad",
            "status",
            "negocio",
        ]

#Retrieve
class SucursalSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = "__all__"

#Update
class SucursalSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = [
            "nombre",
            "direccion",
            "telefono",
            "ciudad",
            "codigo_postal",
            "qr_uuid",
            "nfc_uid",
            "status",
            "negocio",
        ]
#Delete
class SucursalSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = "__all__"


#Usuario-Negocio Serializers

#Create
class UsuarioNegocioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioNegocio
        fields = [
            "usuario",
            "negocio",
            "sucursal",
            "rol_comercio",
            "status",
        ]

#List
class UsuarioNegocioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioNegocio
        fields = [
            "id",
            "usuario",
            "negocio",
            "sucursal",
            "rol_comercio",
            "status",
        ]

#Retrieve
class UsuarioNegocioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioNegocio
        fields = "__all__"

#Update
class UsuarioNegocioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioNegocio
        fields = [
            "usuario",
            "negocio",
            "sucursal",
            "rol_comercio",
            "status",
        ]
#Delete
class UsuarioNegocioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.UsuarioNegocio
        fields = "__all__"


#Dinamica Serializers

#Create
class DinamicaSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Dinamica
        fields = [
            "nombre",
            "descripcion",
            "tipo",
            "meta",
            "regla_conversion",
            "fecha_inicio",
            "fecha_fin",
            "status",
            "negocio",
        ]

#List
class DinamicaSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Dinamica
        fields = [
            "id",
            "nombre",
            "tipo",
            "fecha_inicio",
            "fecha_fin",
            "status",
            "negocio",
        ]

#Retrieve
class DinamicaSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Dinamica
        fields = "__all__"

#Update
class DinamicaSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Dinamica
        fields = [
            "nombre",
            "descripcion",
            "tipo",
            "meta",
            "regla_conversion",
            "fecha_inicio",
            "fecha_fin",
            "status",
            "negocio",
        ]
#Delete
class DinamicaSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Dinamica
        fields = "__all__"

#Alianza Serializers

#Create
class AlianzaSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Alianza
        fields = [
            "negocio1",
            "negocio2",
            "condicion_participacion",
            "status",
            "fecha_inicio",
            "fecha_fin",
            "fecha_respuesta",
        ]


#List
class AlianzaSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Alianza
        fields = [
            "id",
            "negocio1",
            "negocio2",
            "status",
            "fecha_inicio",
            "fecha_fin",
        ]


#Retrieve
class AlianzaSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Alianza
        fields = "__all__"


#Update
class AlianzaSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Alianza
        fields = [
            "negocio1",
            "negocio2",
            "condicion_participacion",
            "status",
            "fecha_inicio",
            "fecha_fin",
            "fecha_respuesta",
        ]
#Delete
class AlianzaSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Alianza
        fields = "__all__"

#Recompensa Serializers

#Create
class RecompensaSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = [
            "titulo",
            "descripcion",
            "tipo",
            "descuento",
            "costo_desbloqueo",
            "terminos_condiciones",
            "status",
            "dinamica",
            "alianza",
        ]


#List
class RecompensaSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = [
            "id",
            "titulo",
            "tipo",
            "costo_desbloqueo",
            "status",
            "dinamica",
            "alianza",
        ]


#Retrieve
class RecompensaSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = "__all__"


#Update
class RecompensaSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = [
            "titulo",
            "descripcion",
            "tipo",
            "descuento",
            "costo_desbloqueo",
            "terminos_condiciones",
            "status",
            "dinamica",
            "alianza",
        ]
#Delete
class RecompensaSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = "__all__"

#Registro-Actividad Serializers

#Create
class RegistroActividadSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = [
            "usuario",
            "sucursal",
            "metodo_validacion",
            "tipo",
            "monto_transaccion",
        ]


#List
class RegistroActividadSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = [
            "id",
            "usuario",
            "sucursal",
            "metodo_validacion",
            "tipo",
            "monto_transaccion",
            "fecha",
        ]


#Retrieve
class RegistroActividadSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = "__all__"


#Update
class RegistroActividadSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = [
            "usuario",
            "sucursal",
            "metodo_validacion",
            "tipo",
            "monto_transaccion",
        ]
#Delete
class RegistroActividadSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = "__all__"

#Progreso-Usuario Serializers

#Create
class ProgresoUsuarioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.ProgresoUsuario
        fields = [
            "usuario",
            "dinamica",
            "saldo_acumulado",
            "completado",
        ]


#List
class ProgresoUsuarioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.ProgresoUsuario
        fields = [
            "id",
            "usuario",
            "dinamica",
            "saldo_acumulado",
            "completado",
        ]


#Retrieve
class ProgresoUsuarioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.ProgresoUsuario
        fields = "__all__"


#Update
class ProgresoUsuarioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.ProgresoUsuario
        fields = [
            "usuario",
            "dinamica",
            "saldo_acumulado",
            "completado",
        ]
#Delete
class ProgresoUsuarioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.ProgresoUsuario
        fields = "__all__"

#Cupon-Usuario Serializers

#Create
class CuponUsuarioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = [
            "fecha_expiracion",
            "usuario",
            "recompensa",
            "status",
        ]


#List
class CuponUsuarioSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = [
            "id",
            "uuid",
            "usuario",
            "recompensa",
            "status",
            "fecha_expiracion",
        ]


#Retrieve
class CuponUsuarioSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = "__all__"


#Update
class CuponUsuarioSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = [
            "fecha_expiracion",
            "usuario",
            "recompensa",
            "status",
        ]
#Delete
class CuponUsuarioSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = "__all__"

#Canje Serializers

#Create
class CanjeSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Canje
        fields = [
            "cupon",
            "sucursal",
            "validado_por",
        ]


#List
class CanjeSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Canje
        fields = [
            "id",
            "cupon",
            "sucursal",
            "validado_por",
            "fecha",
        ]


#Retrieve
class CanjeSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Canje
        fields = "__all__"


#Update
class CanjeSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Canje
        fields = [
            "cupon",
            "sucursal",
            "validado_por",
        ]
#Delete
class CanjeSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Canje
        fields = "__all__"

#Plan-Suscripcion Serializers

#Create
class PlanSuscripcionSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.PlanSuscripcion
        fields = [
            "nombre",
            "descripcion",
            "intervalo",
            "stripe_price_id",
            "limite_sucursales",
            "limite_dinamicas",
            "status",
        ]


#List
class PlanSuscripcionSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.PlanSuscripcion
        fields = [
            "id",
            "nombre",
            "intervalo",
            "status",
        ]


#Retrieve
class PlanSuscripcionSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.PlanSuscripcion
        fields = "__all__"


#Update
class PlanSuscripcionSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.PlanSuscripcion
        fields = [
            "nombre",
            "descripcion",
            "intervalo",
            "stripe_price_id",
            "limite_sucursales",
            "limite_dinamicas",
            "status",
        ]
#Delete
class PlanSuscripcionSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.PlanSuscripcion
        fields = "__all__"

#Suscripcion Serializers

#Create
class SuscripcionSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Suscripcion
        fields = [
            "stripe_subscription_id",
            "status",
            "periodo_actual_inicio",
            "periodo_actual_fin",
            "en_cancelacion",
            "negocio",
            "plan",
        ]


#List
class SuscripcionSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Suscripcion
        fields = [
            "id",
            "stripe_subscription_id",
            "status",
            "periodo_actual_inicio",
            "periodo_actual_fin",
            "negocio",
            "plan",
        ]


#Retrieve
class SuscripcionSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Suscripcion
        fields = "__all__"


#Update
class SuscripcionSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Suscripcion
        fields = [
            "stripe_subscription_id",
            "status",
            "periodo_actual_inicio",
            "periodo_actual_fin",
            "en_cancelacion",
            "negocio",
            "plan",
        ]
#Delete
class SuscripcionSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Suscripcion
        fields = "__all__"

#Pago Serializers

#Create
class PagoSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Pago
        fields = [
            "stripe_invoice_id",
            "stripe_payment_intent_id",
            "monto",
            "divisa",
            "status",
            "recibo_url",
            "negocio",
            "suscripcion",
        ]


#List
class PagoSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Pago
        fields = [
            "id",
            "stripe_invoice_id",
            "monto",
            "divisa",
            "status",
            "fecha_pago",
            "negocio",
            "suscripcion",
        ]


#Retrieve
class PagoSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Pago
        fields = "__all__"


#Update
class PagoSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Pago
        fields = [
            "stripe_invoice_id",
            "stripe_payment_intent_id",
            "monto",
            "divisa",
            "status",
            "recibo_url",
            "negocio",
            "suscripcion",
        ]
#Delete
class PagoSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Pago
        fields = "__all__"

#Notificacion Serializers

#Create
class NotificacionSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = [
            "titulo",
            "cuerpo",
            "tipo",
            "fcm_token_destino",
            "leida",
            "usuario",
        ]


#List
class NotificacionSerializerList(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = [
            "id",
            "titulo",
            "tipo",
            "leida",
            "fecha_envio",
            "usuario",
        ]


#Retrieve
class NotificacionSerializerDetail(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = "__all__"


#Update
class NotificacionSerializerUpdate(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = [
            "titulo",
            "cuerpo",
            "tipo",
            "fcm_token_destino",
            "leida",
            "usuario",
        ]

#Delete
class NotificacionSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = "__all__"
