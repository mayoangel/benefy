"""Serializers de los endpoints transaccionales de lealtad."""

from rest_framework import serializers

from core import models


class RegistrarVisitaSerializer(serializers.Serializer):
    qr_uuid = serializers.UUIDField()
    metodo_validacion = serializers.ChoiceField(
        choices=('qr', 'nfc'), default='qr', required=False,
    )


class ResolverVisitaSerializer(serializers.Serializer):
    qr_uuid = serializers.UUIDField()


class NegocioQrSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Negocio
        fields = ['id', 'nombre', 'logo_url']


class SucursalQrSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = ['id', 'nombre']


class AdquirirCuponSerializer(serializers.Serializer):
    recompensa = serializers.IntegerField(min_value=1)
    clave_idempotencia = serializers.UUIDField()


class AjustePuntosSerializer(serializers.Serializer):
    usuario = serializers.IntegerField(min_value=1)
    negocio = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField()
    motivo = serializers.CharField(max_length=255)
    clave_idempotencia = serializers.UUIDField()

    def validate_cantidad(self, value):
        if value == 0:
            raise serializers.ValidationError('El ajuste no puede ser cero.')
        return value


class MotivoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)


class NegocioResumenMixin:
    """Métodos públicos del negocio para evitar consultas adicionales del móvil."""

    def get_negocio_nombre(self, obj):
        return obj.negocio.nombre if obj.negocio_id else None

    def get_negocio_slug(self, obj):
        return obj.negocio.slug if obj.negocio_id else None

    def get_negocio_logo_url(self, obj):
        return obj.negocio.logo_url if obj.negocio_id else None


class VisitaResumenSerializer(NegocioResumenMixin, serializers.ModelSerializer):
    negocio_nombre = serializers.SerializerMethodField()
    negocio_slug = serializers.SerializerMethodField()
    negocio_logo_url = serializers.SerializerMethodField()
    sucursal_nombre = serializers.SerializerMethodField()

    class Meta:
        model = models.RegistroActividad
        fields = [
            'id', 'usuario', 'negocio', 'negocio_nombre', 'negocio_slug',
            'negocio_logo_url', 'sucursal', 'sucursal_nombre',
            'metodo_validacion', 'tipo', 'fecha', 'fecha_negocio', 'es_valida',
        ]

    def get_sucursal_nombre(self, obj):
        return obj.sucursal.nombre if obj.sucursal_id else None


class SaldoPuntosSerializer(NegocioResumenMixin, serializers.ModelSerializer):
    negocio_nombre = serializers.SerializerMethodField()
    negocio_slug = serializers.SerializerMethodField()
    negocio_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = models.SaldoPuntos
        fields = [
            'negocio', 'negocio_nombre', 'negocio_slug', 'negocio_logo_url',
            'saldo_actual', 'fecha_actualizacion',
        ]


class LotePuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LotePuntos
        fields = [
            'id', 'negocio', 'dinamica', 'origen', 'cantidad_otorgada',
            'cantidad_disponible', 'fecha_otorgamiento', 'fecha_expiracion',
        ]


class MovimientoPuntosSerializer(NegocioResumenMixin, serializers.ModelSerializer):
    negocio_nombre = serializers.SerializerMethodField()
    negocio_slug = serializers.SerializerMethodField()
    negocio_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = models.MovimientoPuntos
        fields = [
            'id', 'negocio', 'negocio_nombre', 'negocio_slug',
            'negocio_logo_url', 'lote', 'cupon', 'tipo', 'cantidad',
            'referencia', 'descripcion', 'fecha',
        ]


class CicloTarjetaSerializer(NegocioResumenMixin, serializers.ModelSerializer):
    negocio_nombre = serializers.SerializerMethodField()
    negocio_slug = serializers.SerializerMethodField()
    negocio_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = models.CicloTarjeta
        fields = [
            'id', 'dinamica', 'negocio', 'negocio_nombre', 'negocio_slug',
            'negocio_logo_url', 'numero_ciclo', 'sellos_actuales', 'meta',
            'estado', 'recompensa_titulo', 'recompensa_descripcion',
            'recompensa_condiciones', 'fecha_inicio', 'fecha_fin', 'cupon',
        ]


class CuponLealtadSerializer(NegocioResumenMixin, serializers.ModelSerializer):
    negocio_nombre = serializers.SerializerMethodField()
    negocio_slug = serializers.SerializerMethodField()
    negocio_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = models.CuponUsuario
        fields = [
            'uuid', 'recompensa', 'negocio', 'negocio_nombre', 'negocio_slug',
            'negocio_logo_url', 'origen', 'status', 'titulo_beneficio',
            'descripcion_beneficio', 'tipo_beneficio', 'descuento_beneficio',
            'condiciones_beneficio', 'costo_pagado', 'fecha_emision',
            'fecha_expiracion',
        ]


class SucursalDirectorioSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = ['id', 'nombre', 'direccion', 'ciudad']


class NegocioDirectorioSerializer(serializers.ModelSerializer):
    categoria = serializers.SerializerMethodField()
    sucursales = serializers.SerializerMethodField()

    class Meta:
        model = models.Negocio
        fields = [
            'id', 'nombre', 'slug', 'descripcion', 'direccion', 'telefono',
            'logo_url', 'banner_url', 'categoria', 'sucursales',
        ]

    def get_categoria(self, obj):
        return {'id': obj.categoria_id, 'nombre': obj.categoria.nombre}

    def get_sucursales(self, obj):
        sucursales = getattr(obj, 'sucursales_activas', None)
        if sucursales is None:
            sucursales = obj.sucursal_set.filter(status=True).order_by('nombre')
        return SucursalDirectorioSerializer(sucursales, many=True).data


class CatalogoRecompensaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = [
            'id', 'titulo', 'descripcion', 'tipo', 'descuento',
            'costo_desbloqueo', 'terminos_condiciones', 'fecha_expiracion',
            'vigencia_dias', 'cantidad_disponible',
        ]
