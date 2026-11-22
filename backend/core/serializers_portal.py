"""Serializers del contexto de acceso al portal web."""

from rest_framework import serializers

from core import models


class NegocioContextoSerializer(serializers.ModelSerializer):
    plan = serializers.SerializerMethodField()

    class Meta:
        model = models.Negocio
        fields = ['id', 'nombre', 'logo_url', 'status', 'zona_horaria', 'plan']

    def get_plan(self, obj):
        return (self.context.get('planes') or {}).get(obj.pk)


class SucursalContextoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Sucursal
        fields = ['id', 'nombre', 'negocio', 'status']


class MembresiaContextoSerializer(serializers.ModelSerializer):
    negocio = NegocioContextoSerializer(read_only=True)
    sucursal = SucursalContextoSerializer(read_only=True)

    class Meta:
        model = models.UsuarioNegocio
        fields = [
            'id', 'negocio', 'sucursal', 'rol_comercio', 'status',
        ]


class UsuarioContextoSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Usuario
        fields = ['id', 'nombre', 'apellido', 'correo', 'rol', 'is_active']
