"""Serializers de los endpoints transaccionales de lealtad."""

from rest_framework import serializers

from core import models


class RegistrarVisitaSerializer(serializers.Serializer):
    qr_uuid = serializers.UUIDField()
    metodo_validacion = serializers.ChoiceField(
        choices=('qr', 'nfc'), default='qr', required=False,
    )


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


class VisitaResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.RegistroActividad
        fields = [
            'id', 'usuario', 'negocio', 'sucursal', 'metodo_validacion', 'tipo',
            'fecha', 'fecha_negocio', 'es_valida',
        ]


class SaldoPuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SaldoPuntos
        fields = ['negocio', 'saldo_actual', 'fecha_actualizacion']


class LotePuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LotePuntos
        fields = [
            'id', 'negocio', 'dinamica', 'origen', 'cantidad_otorgada',
            'cantidad_disponible', 'fecha_otorgamiento', 'fecha_expiracion',
        ]


class MovimientoPuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.MovimientoPuntos
        fields = [
            'id', 'negocio', 'lote', 'cupon', 'tipo', 'cantidad',
            'referencia', 'descripcion', 'fecha',
        ]


class CicloTarjetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CicloTarjeta
        fields = [
            'id', 'dinamica', 'negocio', 'numero_ciclo', 'sellos_actuales',
            'meta', 'estado', 'recompensa_titulo', 'recompensa_descripcion',
            'recompensa_condiciones', 'fecha_inicio', 'fecha_fin', 'cupon',
        ]


class CuponLealtadSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CuponUsuario
        fields = [
            'uuid', 'recompensa', 'negocio', 'origen', 'status',
            'titulo_beneficio', 'descripcion_beneficio', 'tipo_beneficio',
            'descuento_beneficio', 'condiciones_beneficio', 'costo_pagado',
            'fecha_emision', 'fecha_expiracion',
        ]


class CatalogoRecompensaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Recompensa
        fields = [
            'id', 'titulo', 'descripcion', 'tipo', 'descuento',
            'costo_desbloqueo', 'terminos_condiciones', 'fecha_expiracion',
            'vigencia_dias', 'cantidad_disponible',
        ]
