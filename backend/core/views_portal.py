"""Contexto de acceso al portal comercial."""

from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions
from core.serializers_portal import (
    MembresiaContextoSerializer,
    NegocioContextoSerializer,
    SucursalContextoSerializer,
    UsuarioContextoSerializer,
)
from core.services import planes


def construir_contexto(usuario):
    es_admin = permissions.es_admin_sistema(usuario)
    membresias = list(permissions.membresias_efectivas(usuario))

    if es_admin:
        negocios = list(models.Negocio.objects.filter(status=True))
        sucursales = list(models.Sucursal.objects.filter(
            status=True, negocio__status=True,
        ).select_related('negocio'))
    else:
        negocios_por_id = {}
        sucursales_por_id = {}
        for membresia in membresias:
            negocios_por_id[membresia.negocio_id] = membresia.negocio
            if membresia.rol_comercio == 'dueno':
                for sucursal in membresia.negocio.sucursal_set.filter(status=True):
                    sucursales_por_id[sucursal.pk] = sucursal
            elif membresia.sucursal_id and membresia.sucursal.status:
                sucursales_por_id[membresia.sucursal_id] = membresia.sucursal
        negocios = list(negocios_por_id.values())
        sucursales = list(sucursales_por_id.values())

    return {
        'usuario': UsuarioContextoSerializer(usuario).data,
        'es_admin_sistema': es_admin,
        'puede_portal': es_admin or bool(membresias),
        'membresias': MembresiaContextoSerializer(membresias, many=True).data,
        'negocios': NegocioContextoSerializer(
            negocios,
            many=True,
            context={'planes': planes.planes_por_negocio(negocios)},
        ).data,
        'sucursales': SucursalContextoSerializer(sucursales, many=True).data,
    }


class MiContextoAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request):
        return Response(construir_contexto(request.user))
