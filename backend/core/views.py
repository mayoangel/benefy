"""Vistas CRUD explícitas con identidad Supabase y permisos de Django."""

from django.db import IntegrityError, transaction
from rest_framework import generics
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions, serializers
from core.access import ResourceAccessMixin


class ProfileConflict(APIException):
    status_code = 409
    default_detail = 'El perfil ya existe o requiere una vinculación manual. Contacta al administrador.'


class SoloLecturaMixin:
    """Bloquea escrituras del CRUD genérico; el motor usa endpoints propios."""

    http_method_names = ['get', 'options']


class UsuarioCreateAPIView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = serializers.UsuarioSerializerCreate

    def perform_create(self, serializer):
        identity = self.request.auth
        if isinstance(self.request.user, models.Usuario):
            raise ProfileConflict()
        try:
            with transaction.atomic():
                # Nunca vincular perfiles automáticamente por coincidencia de correo.
                if models.Usuario.objects.filter(correo__iexact=identity.email).exists():
                    raise ProfileConflict()
                serializer.save(supabase_uid=identity.uid, correo=identity.email, rol='consumidor')
        except IntegrityError:
            raise ProfileConflict() from None


class PerfilAPIView(APIView):
    def get(self, request):
        return Response(serializers.UsuarioSerializerDetail(request.user).data)


class UsuarioRolAPIView(generics.UpdateAPIView):
    permission_classes = [permissions.EsAdminSistema]
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioRolSerializer
    http_method_names = ['patch', 'options']

# Usuario: las cinco operaciones mantienen sus rutas independientes.
class UsuarioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerList


class UsuarioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerDetail


class UsuarioUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerUpdate


class UsuarioDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerDelete


# CategoriaNegocio: las cinco operaciones mantienen sus rutas independientes.
class CategoriaNegocioCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerCreate


class CategoriaNegocioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerList


class CategoriaNegocioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerDetail


class CategoriaNegocioUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerUpdate


class CategoriaNegocioDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerDelete


# Negocio: las cinco operaciones mantienen sus rutas independientes.
class NegocioCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerCreate


class NegocioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerList


class NegocioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerDetail


class NegocioUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerUpdate


class NegocioDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerDelete


# Sucursal: las cinco operaciones mantienen sus rutas independientes.
class SucursalCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerCreate


class SucursalListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerList


class SucursalDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerDetail


class SucursalUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerUpdate


class SucursalDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerDelete


# UsuarioNegocio: las cinco operaciones mantienen sus rutas independientes.
class UsuarioNegocioCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerCreate


class UsuarioNegocioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerList


class UsuarioNegocioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerDetail


class UsuarioNegocioUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerUpdate


class UsuarioNegocioDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerDelete


# Dinamica: las cinco operaciones mantienen sus rutas independientes.
class DinamicaCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerCreate


class DinamicaListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerList


class DinamicaDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerDetail


class DinamicaUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerUpdate


class DinamicaDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerDelete


# Alianza: las cinco operaciones mantienen sus rutas independientes.
class AlianzaCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerCreate


class AlianzaListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerList


class AlianzaDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerDetail


class AlianzaUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerUpdate


class AlianzaDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerDelete


# Recompensa: las cinco operaciones mantienen sus rutas independientes.
class RecompensaCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerCreate


class RecompensaListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerList


class RecompensaDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerDetail


class RecompensaUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerUpdate


class RecompensaDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerDelete


# RegistroActividad: las cinco operaciones mantienen sus rutas independientes.
class RegistroActividadCreateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerCreate


class RegistroActividadListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerList


class RegistroActividadDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerDetail


class RegistroActividadUpdateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerUpdate


class RegistroActividadDeleteAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerDelete


# ProgresoUsuario: las cinco operaciones mantienen sus rutas independientes.
class ProgresoUsuarioCreateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerCreate


class ProgresoUsuarioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerList


class ProgresoUsuarioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerDetail


class ProgresoUsuarioUpdateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerUpdate


class ProgresoUsuarioDeleteAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerDelete


# CuponUsuario: las cinco operaciones mantienen sus rutas independientes.
class CuponUsuarioCreateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerCreate


class CuponUsuarioListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerList


class CuponUsuarioDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerDetail


class CuponUsuarioUpdateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerUpdate


class CuponUsuarioDeleteAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerDelete


# Canje: las cinco operaciones mantienen sus rutas independientes.
class CanjeCreateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerCreate


class CanjeListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerList


class CanjeDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerDetail


class CanjeUpdateAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerUpdate


class CanjeDeleteAPIView(SoloLecturaMixin, ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerDelete


# PlanSuscripcion: las cinco operaciones mantienen sus rutas independientes.
class PlanSuscripcionCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerCreate


class PlanSuscripcionListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerList


class PlanSuscripcionDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerDetail


class PlanSuscripcionUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerUpdate


class PlanSuscripcionDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerDelete


# Suscripcion: las cinco operaciones mantienen sus rutas independientes.
class SuscripcionCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerCreate


class SuscripcionListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerList


class SuscripcionDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerDetail


class SuscripcionUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerUpdate


class SuscripcionDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerDelete


# Pago: las cinco operaciones mantienen sus rutas independientes.
class PagoCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerCreate


class PagoListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerList


class PagoDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerDetail


class PagoUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerUpdate


class PagoDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerDelete


# Notificacion: las cinco operaciones mantienen sus rutas independientes.
class NotificacionCreateAPIView(ResourceAccessMixin, generics.CreateAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerCreate


class NotificacionListAPIView(ResourceAccessMixin, generics.ListAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerList


class NotificacionDetailAPIView(ResourceAccessMixin, generics.RetrieveAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerDetail


class NotificacionUpdateAPIView(ResourceAccessMixin, generics.UpdateAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerUpdate


class NotificacionDeleteAPIView(ResourceAccessMixin, generics.DestroyAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerDelete
