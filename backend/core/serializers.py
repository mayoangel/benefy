from rest_framework import serializers
from django.utils import timezone

from core import models


# Usuario Serializers

#Create
class UsuarioSerializerCreate(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = [
            "id",
            "nombre",
            "apellido",
            "telefono",
            "foto_perfil",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if set(self.initial_data) - {"nombre", "apellido", "telefono", "foto_perfil"}:
            raise serializers.ValidationError("Solo se permiten los campos editables del perfil.")
        return attrs

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("El nombre no puede estar vacío.")
        return value

    def validate_apellido(self, value):
        if not value.strip():
            raise serializers.ValidationError("El apellido no puede estar vacío.")
        return value

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
        fields = ["id", "supabase_uid", "nombre", "apellido", "telefono", "correo",
                  "rol", "foto_perfil", "qr_token", "is_active", "fecha_registro", "fecha_actualizacion"]

#Update
class UsuarioSerializerUpdate(UsuarioSerializerCreate):
    class Meta:
        model = models.Usuario
        fields = [
            "nombre",
            "apellido",
            "telefono",
            "foto_perfil",
        ]

class UsuarioRolSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = ["rol", "is_active"]

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre de la categoría no puede estar vacío.")
        if models.CategoriaNegocio.objects.filter(nombre__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una categoría con este nombre.")
        return value

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre de la categoría no puede estar vacío.")
        categorias = models.CategoriaNegocio.objects.filter(nombre__iexact=value)
        if self.instance:
            categorias = categorias.exclude(pk=self.instance.pk)
        if categorias.exists():
            raise serializers.ValidationError("Ya existe una categoría con este nombre.")
        return value

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del negocio no puede estar vacío.")
        return value

    def validate_direccion(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La dirección del negocio no puede estar vacía.")
        return value

    def validate_correo(self, value):
        value = value.strip()
        if models.Negocio.objects.filter(correo__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un negocio registrado con este correo.")
        return value

    def validate_slug(self, value):
        value = value.strip()
        if value and models.Negocio.objects.filter(slug__iexact=value).exists():
            raise serializers.ValidationError("Este slug ya está siendo utilizado por otro negocio.")
        return value

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del negocio no puede estar vacío.")
        return value

    def validate_direccion(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La dirección del negocio no puede estar vacía.")
        return value

    def validate_correo(self, value):
        value = value.strip()
        negocios = models.Negocio.objects.filter(correo__iexact=value)
        if self.instance:
            negocios = negocios.exclude(pk=self.instance.pk)
        if negocios.exists():
            raise serializers.ValidationError("Ya existe un negocio registrado con este correo.")
        return value

    def validate_slug(self, value):
        value = value.strip()
        negocios = models.Negocio.objects.filter(slug__iexact=value)
        if self.instance:
            negocios = negocios.exclude(pk=self.instance.pk)
        if value and negocios.exists():
            raise serializers.ValidationError("Este slug ya está siendo utilizado por otro negocio.")
        return value

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre de la sucursal no puede estar vacío.")
        return value

    def validate_direccion(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La dirección de la sucursal no puede estar vacía.")
        return value

    def validate_ciudad(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La ciudad no puede estar vacía.")
        return value

    def validate_nfc_uid(self, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        if models.Sucursal.objects.filter(nfc_uid__iexact=value).exists():
            raise serializers.ValidationError("Este identificador NFC ya está asignado a otra sucursal.")
        return value

    def validate(self, attrs):
        negocio = attrs["negocio"]
        status = attrs.get("status", True)
        if status and not negocio.status:
            raise serializers.ValidationError({
                "negocio": "No se puede activar una sucursal de un negocio inactivo."
            })
        return attrs

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre de la sucursal no puede estar vacío.")
        return value

    def validate_direccion(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La dirección de la sucursal no puede estar vacía.")
        return value

    def validate_ciudad(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La ciudad no puede estar vacía.")
        return value

    def validate_nfc_uid(self, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        sucursales = models.Sucursal.objects.filter(nfc_uid__iexact=value)
        if self.instance:
            sucursales = sucursales.exclude(pk=self.instance.pk)
        if sucursales.exists():
            raise serializers.ValidationError("Este identificador NFC ya está asignado a otra sucursal.")
        return value

    def validate(self, attrs):
        negocio = attrs.get("negocio", self.instance.negocio)
        status = attrs.get("status", self.instance.status)
        if status and not negocio.status:
            raise serializers.ValidationError({
                "negocio": "No se puede activar una sucursal de un negocio inactivo."
            })
        return attrs

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

    def validate(self, attrs):
        negocio = attrs["negocio"]
        sucursal = attrs.get("sucursal")
        if sucursal is not None and sucursal.negocio_id != negocio.pk:
            raise serializers.ValidationError({
                "sucursal": "La sucursal debe pertenecer al negocio indicado."
            })
        if models.UsuarioNegocio.objects.filter(
            usuario=attrs["usuario"],
            negocio=negocio,
            sucursal=sucursal,
        ).exists():
            raise serializers.ValidationError("El usuario ya está asignado a esta sucursal.")
        return attrs

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

    def validate(self, attrs):
        usuario = attrs.get("usuario", self.instance.usuario)
        negocio = attrs.get("negocio", self.instance.negocio)
        sucursal = attrs.get("sucursal", self.instance.sucursal)
        if sucursal and negocio and sucursal.negocio_id != negocio.pk:
            raise serializers.ValidationError({
                "sucursal": "La sucursal debe pertenecer al negocio indicado."
            })

        membresias = models.UsuarioNegocio.objects.filter(
            usuario=usuario,
            negocio=negocio,
            sucursal=sucursal,
        )
        if self.instance:
            membresias = membresias.exclude(pk=self.instance.pk)
        if membresias.exists():
            raise serializers.ValidationError("El usuario ya está asignado a esta sucursal.")
        return attrs

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

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("El nombre no puede estar vacío.")
        return value

    def validate_meta(self, value):
        if value <= 0:
            raise serializers.ValidationError("La meta debe ser mayor que cero.")
        return value

    def validate_regla_conversion(self, value):
        if value <= 0:
            raise serializers.ValidationError("La regla de conversión debe ser mayor que cero.")
        return value

    def validate(self, attrs):
        fecha_inicio = attrs["fecha_inicio"]
        fecha_fin = attrs["fecha_fin"]
        if fecha_fin <= fecha_inicio:
            raise serializers.ValidationError({
                "fecha_fin": "La fecha de fin debe ser posterior a la fecha de inicio."
            })
        return attrs

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

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("El nombre no puede estar vacío.")
        return value

    def validate_meta(self, value):
        if value <= 0:
            raise serializers.ValidationError("La meta debe ser mayor que cero.")
        return value

    def validate_regla_conversion(self, value):
        if value <= 0:
            raise serializers.ValidationError("La regla de conversión debe ser mayor que cero.")
        return value

    def validate(self, attrs):
        fecha_inicio = attrs.get("fecha_inicio", self.instance.fecha_inicio)
        fecha_fin = attrs.get("fecha_fin", self.instance.fecha_fin)
        if fecha_fin <= fecha_inicio:
            raise serializers.ValidationError({
                "fecha_fin": "La fecha de fin debe ser posterior a la fecha de inicio."
            })
        return attrs

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

    def validate_condicion_participacion(self, value):
        if not value.strip():
            raise serializers.ValidationError("La condición de participación no puede estar vacía.")
        return value

    def validate_status(self, value):
        if value != "pendiente":
            raise serializers.ValidationError("Una alianza nueva debe iniciar como pendiente.")
        return value

    def validate_fecha_respuesta(self, value):
        if value is not None:
            raise serializers.ValidationError(
                "La fecha de respuesta se establece al aceptar o rechazar la alianza."
            )
        return value

    def validate(self, attrs):
        if attrs["negocio1"].pk == attrs["negocio2"].pk:
            raise serializers.ValidationError({
                "negocio2": "Un negocio no puede crear una alianza consigo mismo."
            })
        if attrs["fecha_fin"] <= attrs["fecha_inicio"]:
            raise serializers.ValidationError({
                "fecha_fin": "La fecha de fin debe ser posterior a la fecha de inicio."
            })
        return attrs


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

    def validate_condicion_participacion(self, value):
        if not value.strip():
            raise serializers.ValidationError("La condición de participación no puede estar vacía.")
        return value

    def validate(self, attrs):
        negocio1 = attrs.get("negocio1", self.instance.negocio1)
        negocio2 = attrs.get("negocio2", self.instance.negocio2)
        fecha_inicio = attrs.get("fecha_inicio", self.instance.fecha_inicio)
        fecha_fin = attrs.get("fecha_fin", self.instance.fecha_fin)
        if negocio1.pk == negocio2.pk:
            raise serializers.ValidationError({
                "negocio2": "Un negocio no puede crear una alianza consigo mismo."
            })
        if fecha_fin <= fecha_inicio:
            raise serializers.ValidationError({
                "fecha_fin": "La fecha de fin debe ser posterior a la fecha de inicio."
            })
        return attrs

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

    def validate_titulo(self, value):
        if not value.strip():
            raise serializers.ValidationError("El título no puede estar vacío.")
        return value

    def validate(self, attrs):
        tipo = attrs["tipo"]
        descuento = attrs.get("descuento")
        dinamica = attrs.get("dinamica")
        alianza = attrs.get("alianza")

        if (dinamica is None) == (alianza is None):
            raise serializers.ValidationError(
                "La recompensa debe pertenecer a una dinámica o a una alianza, pero no a ambas."
            )
        if tipo == "descuento" and (descuento is None or descuento <= 0 or descuento > 100):
            raise serializers.ValidationError({
                "descuento": "El descuento porcentual debe ser mayor que cero y no superar 100."
            })
        if tipo == "descuento_fijo" and (descuento is None or descuento <= 0):
            raise serializers.ValidationError({
                "descuento": "El descuento fijo debe ser mayor que cero."
            })
        if tipo == "gratis" and descuento is not None:
            raise serializers.ValidationError({
                "descuento": "Una recompensa gratis no debe especificar un descuento."
            })
        return attrs


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

    def validate_titulo(self, value):
        if not value.strip():
            raise serializers.ValidationError("El título no puede estar vacío.")
        return value

    def validate(self, attrs):
        tipo = attrs.get("tipo", self.instance.tipo)
        descuento = attrs.get("descuento", self.instance.descuento)
        dinamica = attrs.get("dinamica", self.instance.dinamica)
        alianza = attrs.get("alianza", self.instance.alianza)

        if (dinamica is None) == (alianza is None):
            raise serializers.ValidationError(
                "La recompensa debe pertenecer a una dinámica o a una alianza, pero no a ambas."
            )
        if tipo == "descuento" and (descuento is None or descuento <= 0 or descuento > 100):
            raise serializers.ValidationError({
                "descuento": "El descuento porcentual debe ser mayor que cero y no superar 100."
            })
        if tipo == "descuento_fijo" and (descuento is None or descuento <= 0):
            raise serializers.ValidationError({
                "descuento": "El descuento fijo debe ser mayor que cero."
            })
        if tipo == "gratis" and descuento is not None:
            raise serializers.ValidationError({
                "descuento": "Una recompensa gratis no debe especificar un descuento."
            })
        return attrs

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

    def validate_monto_transaccion(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("El monto de la transacción no puede ser negativo.")
        return value

    def validate(self, attrs):
        tipo = attrs["tipo"]
        monto = attrs.get("monto_transaccion")
        sucursal = attrs["sucursal"]
        if not sucursal.status:
            raise serializers.ValidationError({
                "sucursal": "No se pueden registrar actividades en una sucursal inactiva."
            })
        if not sucursal.negocio.status:
            raise serializers.ValidationError({
                "sucursal": "No se pueden registrar actividades en un negocio inactivo."
            })
        if tipo == "compra" and (monto is None or monto <= 0):
            raise serializers.ValidationError({
                "monto_transaccion": "Una compra debe tener un monto mayor que cero."
            })
        return attrs


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

    def validate_monto_transaccion(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("El monto de la transacción no puede ser negativo.")
        return value

    def validate(self, attrs):
        tipo = attrs.get("tipo", self.instance.tipo)
        monto = attrs.get("monto_transaccion", self.instance.monto_transaccion)
        sucursal = attrs.get("sucursal", self.instance.sucursal)
        if not sucursal.status:
            raise serializers.ValidationError({
                "sucursal": "No se pueden registrar actividades en una sucursal inactiva."
            })
        if not sucursal.negocio.status:
            raise serializers.ValidationError({
                "sucursal": "No se pueden registrar actividades en un negocio inactivo."
            })
        if tipo == "compra" and (monto is None or monto <= 0):
            raise serializers.ValidationError({
                "monto_transaccion": "Una compra debe tener un monto mayor que cero."
            })
        return attrs

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

    def validate_saldo_acumulado(self, value):
        if value < 0:
            raise serializers.ValidationError("El saldo acumulado no puede ser negativo.")
        return value

    def validate(self, attrs):
        if models.ProgresoUsuario.objects.filter(
            usuario=attrs["usuario"],
            dinamica=attrs["dinamica"],
        ).exists():
            raise serializers.ValidationError("Ya existe un progreso para este usuario y dinámica.")
        return attrs


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

    def validate_saldo_acumulado(self, value):
        if value < 0:
            raise serializers.ValidationError("El saldo acumulado no puede ser negativo.")
        return value

    def validate(self, attrs):
        usuario = attrs.get("usuario", self.instance.usuario)
        dinamica = attrs.get("dinamica", self.instance.dinamica)
        progresos = models.ProgresoUsuario.objects.filter(
            usuario=usuario,
            dinamica=dinamica,
        )
        if self.instance:
            progresos = progresos.exclude(pk=self.instance.pk)
        if progresos.exists():
            raise serializers.ValidationError("Ya existe un progreso para este usuario y dinámica.")
        return attrs

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

    def validate_fecha_expiracion(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("La fecha de expiración debe ser futura.")
        return value

    def validate_status(self, value):
        if value != "disponible":
            raise serializers.ValidationError("Un cupón nuevo debe iniciar como disponible.")
        return value

    def validate(self, attrs):
        usuario = attrs["usuario"]
        recompensa = attrs["recompensa"]
        if usuario.rol != "consumidor":
            raise serializers.ValidationError({
                "usuario": "Los cupones solo pueden emitirse a usuarios consumidores."
            })
        if bool(recompensa.dinamica_id) == bool(recompensa.alianza_id):
            raise serializers.ValidationError({
                "recompensa": "La recompensa debe pertenecer exactamente a una dinámica o alianza."
            })
        if not recompensa.status:
            raise serializers.ValidationError({
                "recompensa": "No se pueden emitir cupones para una recompensa inactiva."
            })
        if recompensa.dinamica_id and not recompensa.dinamica.status:
            raise serializers.ValidationError({
                "recompensa": "No se pueden emitir cupones para una dinámica inactiva."
            })
        if recompensa.alianza_id and recompensa.alianza.status != "activa":
            raise serializers.ValidationError({
                "recompensa": "No se pueden emitir cupones para una alianza que no esté activa."
            })
        return attrs


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

    def validate_fecha_expiracion(self, value):
        if value <= self.instance.fecha_emision:
            raise serializers.ValidationError("La expiración debe ser posterior a la fecha de emisión.")
        return value

    def validate(self, attrs):
        usuario = attrs.get("usuario", self.instance.usuario)
        recompensa = attrs.get("recompensa", self.instance.recompensa)
        fecha_expiracion = attrs.get("fecha_expiracion", self.instance.fecha_expiracion)
        status = attrs.get("status", self.instance.status)

        if usuario.pk != self.instance.usuario_id:
            raise serializers.ValidationError({
                "usuario": "No se puede cambiar el usuario propietario de un cupón emitido."
            })
        if recompensa.pk != self.instance.recompensa_id:
            raise serializers.ValidationError({
                "recompensa": "No se puede cambiar la recompensa de un cupón emitido."
            })
        if self.instance.status in ("canjeado", "vencido") and status != self.instance.status:
            raise serializers.ValidationError({
                "status": "El estado de un cupón canjeado o vencido no se puede reactivar ni modificar."
            })
        if (
            self.instance.status != "disponible"
            and fecha_expiracion != self.instance.fecha_expiracion
        ):
            raise serializers.ValidationError({
                "fecha_expiracion": "La expiración de un cupón ya canjeado o vencido no se puede modificar."
            })
        if status == "canjeado" and not models.Canje.objects.filter(cupon=self.instance).exists():
            raise serializers.ValidationError({
                "status": "El cupón solo puede marcarse como canjeado si existe un canje registrado."
            })
        if status == "vencido" and fecha_expiracion > timezone.now():
            raise serializers.ValidationError({
                "status": "El cupón solo puede marcarse como vencido después de su expiración."
            })
        if status == "disponible" and fecha_expiracion <= timezone.now():
            raise serializers.ValidationError({
                "status": "Un cupón expirado no puede estar disponible."
            })
        if status == "disponible" and models.Canje.objects.filter(cupon=self.instance).exists():
            raise serializers.ValidationError({
                "status": "Un cupón con un canje registrado no puede volver a estar disponible."
            })
        return attrs

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

    def validate(self, attrs):
        request = self.context.get("request")
        if request is not None:
            if attrs.get("validado_por") not in (None, request.user):
                raise serializers.ValidationError({"validado_por": "Debe ser el usuario autenticado."})
            attrs["validado_por"] = request.user
        cupon = attrs["cupon"]
        sucursal = attrs["sucursal"]
        validado_por = attrs.get("validado_por")
        recompensa = cupon.recompensa

        if cupon.status != "disponible":
            raise serializers.ValidationError({"cupon": "El cupón no está disponible para canje."})
        if cupon.fecha_expiracion <= timezone.now():
            raise serializers.ValidationError({"cupon": "El cupón ya venció."})
        if models.Canje.objects.filter(cupon=cupon).exists():
            raise serializers.ValidationError({"cupon": "Este cupón ya fue canjeado."})
        if not sucursal.status:
            raise serializers.ValidationError({"sucursal": "La sucursal está inactiva."})
        if not sucursal.negocio.status:
            raise serializers.ValidationError({"sucursal": "El negocio de la sucursal está inactivo."})

        if recompensa.dinamica_id:
            negocios_validos = [recompensa.dinamica.negocio_id]
        elif recompensa.alianza_id:
            negocios_validos = [recompensa.alianza.negocio1_id, recompensa.alianza.negocio2_id]
        else:
            raise serializers.ValidationError({
                "cupon": "La recompensa asociada al cupón no tiene un origen válido."
            })
        if sucursal.negocio_id not in negocios_validos:
            raise serializers.ValidationError({
                "sucursal": "La sucursal no pertenece a un negocio asociado con esta recompensa."
            })
        from core.permissions import puede_operar_sucursal
        if validado_por and not puede_operar_sucursal(validado_por, sucursal):
            raise serializers.ValidationError({
                "validado_por": "El usuario no tiene una asignación activa en esta sucursal."
            })
        return attrs


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

    def validate(self, attrs):
        cupon = attrs.get("cupon", self.instance.cupon)
        sucursal = attrs.get("sucursal", self.instance.sucursal)
        validado_por = attrs.get("validado_por", self.instance.validado_por)
        mismo_cupon = cupon.pk == self.instance.cupon_id
        recompensa = cupon.recompensa

        if not mismo_cupon:
            if cupon.status != "disponible":
                raise serializers.ValidationError({"cupon": "El cupón no está disponible para canje."})
            if cupon.fecha_expiracion <= timezone.now():
                raise serializers.ValidationError({"cupon": "El cupón ya venció."})
            canjes = models.Canje.objects.filter(cupon=cupon).exclude(pk=self.instance.pk)
            if canjes.exists():
                raise serializers.ValidationError({"cupon": "Este cupón ya fue canjeado."})
        if not sucursal.status:
            raise serializers.ValidationError({"sucursal": "La sucursal está inactiva."})
        if not sucursal.negocio.status:
            raise serializers.ValidationError({"sucursal": "El negocio de la sucursal está inactivo."})

        if recompensa.dinamica_id:
            negocios_validos = [recompensa.dinamica.negocio_id]
        elif recompensa.alianza_id:
            negocios_validos = [recompensa.alianza.negocio1_id, recompensa.alianza.negocio2_id]
        else:
            raise serializers.ValidationError({
                "cupon": "La recompensa asociada al cupón no tiene un origen válido."
            })
        if sucursal.negocio_id not in negocios_validos:
            raise serializers.ValidationError({
                "sucursal": "La sucursal no pertenece a un negocio asociado con esta recompensa."
            })
        if validado_por and not models.UsuarioNegocio.objects.filter(
            usuario=validado_por,
            negocio_id=sucursal.negocio_id,
            sucursal=sucursal,
            status=True,
        ).exists():
            raise serializers.ValidationError({
                "validado_por": "El usuario no tiene una asignación activa en esta sucursal."
            })
        return attrs

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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del plan no puede estar vacío.")
        if models.PlanSuscripcion.objects.filter(nombre__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un plan con este nombre.")
        return value


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

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del plan no puede estar vacío.")
        planes = models.PlanSuscripcion.objects.filter(nombre__iexact=value)
        if self.instance:
            planes = planes.exclude(pk=self.instance.pk)
        if planes.exists():
            raise serializers.ValidationError("Ya existe un plan con este nombre.")
        return value

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

    def validate(self, attrs):
        if attrs["periodo_actual_fin"] <= attrs["periodo_actual_inicio"]:
            raise serializers.ValidationError({
                "periodo_actual_fin": "El fin del periodo debe ser posterior a su inicio."
            })
        return attrs


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

    def validate(self, attrs):
        inicio = attrs.get("periodo_actual_inicio", self.instance.periodo_actual_inicio)
        fin = attrs.get("periodo_actual_fin", self.instance.periodo_actual_fin)
        if fin <= inicio:
            raise serializers.ValidationError({
                "periodo_actual_fin": "El fin del periodo debe ser posterior a su inicio."
            })
        return attrs
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

    def validate_monto(self, value):
        if value < 0:
            raise serializers.ValidationError("El monto del pago no puede ser negativo.")
        return value

    def validate(self, attrs):
        if attrs["suscripcion"].negocio_id != attrs["negocio"].pk:
            raise serializers.ValidationError({
                "suscripcion": "La suscripción debe pertenecer al negocio indicado."
            })
        return attrs


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

    def validate_monto(self, value):
        if value < 0:
            raise serializers.ValidationError("El monto del pago no puede ser negativo.")
        return value

    def validate(self, attrs):
        negocio = attrs.get("negocio", self.instance.negocio)
        suscripcion = attrs.get("suscripcion", self.instance.suscripcion)
        if suscripcion.negocio_id != negocio.pk:
            raise serializers.ValidationError({
                "suscripcion": "La suscripción debe pertenecer al negocio indicado."
            })
        return attrs

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

    def validate_titulo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El título no puede estar vacío.")
        return value

    def validate_cuerpo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El cuerpo de la notificación no puede estar vacío.")
        return value

    def validate_leida(self, value):
        if value:
            raise serializers.ValidationError("Una notificación nueva debe iniciar como no leída.")
        return value


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

    def validate_titulo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El título no puede estar vacío.")
        return value

    def validate_cuerpo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El cuerpo de la notificación no puede estar vacío.")
        return value

    def validate_leida(self, value):
        if self.instance.leida and not value:
            raise serializers.ValidationError("Una notificación leída no puede volver a marcarse como no leída.")
        return value

    def validate(self, attrs):
        usuario = attrs.get("usuario", self.instance.usuario)
        if usuario != self.instance.usuario:
            raise serializers.ValidationError({
                "usuario": "No se puede cambiar el destinatario de una notificación existente."
            })
        return attrs

#Delete
class NotificacionSerializerDelete(serializers.ModelSerializer):
    class Meta:
        model = models.Notificacion
        fields = "__all__"
