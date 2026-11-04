from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, serializers


# Usuario CRUD

#Create
class UsuarioCreateAPIView(generics.CreateAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerCreate

#List
class UsuarioListAPIView(APIView):
    def get(self, request):
        usuarios = models.Usuario.objects.all()
        data = serializers.UsuarioSerializerList(usuarios, many=True).data
        return Response(data)

#Detail
class UsuarioDetailAPIView(APIView):
    def get(self, request, pk):
        usuario = models.Usuario.objects.get(pk=pk)
        data = serializers.UsuarioSerializerDetail(usuario).data
        return Response(data)

#Update
class UsuarioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerUpdate

#Delete
class UsuarioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Usuario.objects.all()
    serializer_class = serializers.UsuarioSerializerDelete


# CategoriaNegocio CRUD

#Create
class CategoriaNegocioCreateAPIView(generics.CreateAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerCreate

#List
class CategoriaNegocioListAPIView(APIView):
    def get(self, request):
        categorianegocios = models.CategoriaNegocio.objects.all()
        data = serializers.CategoriaNegocioSerializerList(categorianegocios, many=True).data
        return Response(data)

#Detail
class CategoriaNegocioDetailAPIView(APIView):
    def get(self, request, pk):
        categorianegocio = models.CategoriaNegocio.objects.get(pk=pk)
        data = serializers.CategoriaNegocioSerializerDetail(categorianegocio).data
        return Response(data)

#Update
class CategoriaNegocioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerUpdate

#Delete
class CategoriaNegocioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.CategoriaNegocio.objects.all()
    serializer_class = serializers.CategoriaNegocioSerializerDelete


# Negocio CRUD

#Create
class NegocioCreateAPIView(generics.CreateAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerCreate

#List
class NegocioListAPIView(APIView):
    def get(self, request):
        negocios = models.Negocio.objects.all()
        data = serializers.NegocioSerializerList(negocios, many=True).data
        return Response(data)

#Detail
class NegocioDetailAPIView(APIView):
    def get(self, request, pk):
        negocio = models.Negocio.objects.get(pk=pk)
        data = serializers.NegocioSerializerDetail(negocio).data
        return Response(data)

#Update
class NegocioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerUpdate

#Delete
class NegocioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Negocio.objects.all()
    serializer_class = serializers.NegocioSerializerDelete


# Sucursal CRUD

#Create
class SucursalCreateAPIView(generics.CreateAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerCreate

#List
class SucursalListAPIView(APIView):
    def get(self, request):
        sucursals = models.Sucursal.objects.all()
        data = serializers.SucursalSerializerList(sucursals, many=True).data
        return Response(data)

#Detail
class SucursalDetailAPIView(APIView):
    def get(self, request, pk):
        sucursal = models.Sucursal.objects.get(pk=pk)
        data = serializers.SucursalSerializerDetail(sucursal).data
        return Response(data)

#Update
class SucursalUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerUpdate

#Delete
class SucursalDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Sucursal.objects.all()
    serializer_class = serializers.SucursalSerializerDelete


# UsuarioNegocio CRUD

#Create
class UsuarioNegocioCreateAPIView(generics.CreateAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerCreate

#List
class UsuarioNegocioListAPIView(APIView):
    def get(self, request):
        usuarionegocios = models.UsuarioNegocio.objects.all()
        data = serializers.UsuarioNegocioSerializerList(usuarionegocios, many=True).data
        return Response(data)

#Detail
class UsuarioNegocioDetailAPIView(APIView):
    def get(self, request, pk):
        usuarionegocio = models.UsuarioNegocio.objects.get(pk=pk)
        data = serializers.UsuarioNegocioSerializerDetail(usuarionegocio).data
        return Response(data)

#Update
class UsuarioNegocioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerUpdate

#Delete
class UsuarioNegocioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.UsuarioNegocio.objects.all()
    serializer_class = serializers.UsuarioNegocioSerializerDelete


# Dinamica CRUD

#Create
class DinamicaCreateAPIView(generics.CreateAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerCreate

#List
class DinamicaListAPIView(APIView):
    def get(self, request):
        dinamicas = models.Dinamica.objects.all()
        data = serializers.DinamicaSerializerList(dinamicas, many=True).data
        return Response(data)

#Detail
class DinamicaDetailAPIView(APIView):
    def get(self, request, pk):
        dinamica = models.Dinamica.objects.get(pk=pk)
        data = serializers.DinamicaSerializerDetail(dinamica).data
        return Response(data)

#Update
class DinamicaUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerUpdate

#Delete
class DinamicaDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Dinamica.objects.all()
    serializer_class = serializers.DinamicaSerializerDelete


# Alianza CRUD

#Create
class AlianzaCreateAPIView(generics.CreateAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerCreate

#List
class AlianzaListAPIView(APIView):
    def get(self, request):
        alianzas = models.Alianza.objects.all()
        data = serializers.AlianzaSerializerList(alianzas, many=True).data
        return Response(data)

#Detail
class AlianzaDetailAPIView(APIView):
    def get(self, request, pk):
        alianza = models.Alianza.objects.get(pk=pk)
        data = serializers.AlianzaSerializerDetail(alianza).data
        return Response(data)

#Update
class AlianzaUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerUpdate

#Delete
class AlianzaDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Alianza.objects.all()
    serializer_class = serializers.AlianzaSerializerDelete


# Recompensa CRUD

#Create
class RecompensaCreateAPIView(generics.CreateAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerCreate

#List
class RecompensaListAPIView(APIView):
    def get(self, request):
        recompensas = models.Recompensa.objects.all()
        data = serializers.RecompensaSerializerList(recompensas, many=True).data
        return Response(data)

#Detail
class RecompensaDetailAPIView(APIView):
    def get(self, request, pk):
        recompensa = models.Recompensa.objects.get(pk=pk)
        data = serializers.RecompensaSerializerDetail(recompensa).data
        return Response(data)

#Update
class RecompensaUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerUpdate

#Delete
class RecompensaDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Recompensa.objects.all()
    serializer_class = serializers.RecompensaSerializerDelete


# RegistroActividad CRUD

#Create
class RegistroActividadCreateAPIView(generics.CreateAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerCreate

#List
class RegistroActividadListAPIView(APIView):
    def get(self, request):
        registroactividads = models.RegistroActividad.objects.all()
        data = serializers.RegistroActividadSerializerList(registroactividads, many=True).data
        return Response(data)

#Detail
class RegistroActividadDetailAPIView(APIView):
    def get(self, request, pk):
        registroactividad = models.RegistroActividad.objects.get(pk=pk)
        data = serializers.RegistroActividadSerializerDetail(registroactividad).data
        return Response(data)

#Update
class RegistroActividadUpdateAPIView(generics.UpdateAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerUpdate

#Delete
class RegistroActividadDeleteAPIView(generics.DestroyAPIView):
    queryset = models.RegistroActividad.objects.all()
    serializer_class = serializers.RegistroActividadSerializerDelete


# ProgresoUsuario CRUD

#Create
class ProgresoUsuarioCreateAPIView(generics.CreateAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerCreate

#List
class ProgresoUsuarioListAPIView(APIView):
    def get(self, request):
        progresousuarios = models.ProgresoUsuario.objects.all()
        data = serializers.ProgresoUsuarioSerializerList(progresousuarios, many=True).data
        return Response(data)

#Detail
class ProgresoUsuarioDetailAPIView(APIView):
    def get(self, request, pk):
        progresousuario = models.ProgresoUsuario.objects.get(pk=pk)
        data = serializers.ProgresoUsuarioSerializerDetail(progresousuario).data
        return Response(data)

#Update
class ProgresoUsuarioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerUpdate

#Delete
class ProgresoUsuarioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.ProgresoUsuario.objects.all()
    serializer_class = serializers.ProgresoUsuarioSerializerDelete


# CuponUsuario CRUD

#Create
class CuponUsuarioCreateAPIView(generics.CreateAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerCreate

#List
class CuponUsuarioListAPIView(APIView):
    def get(self, request):
        cuponusuarios = models.CuponUsuario.objects.all()
        data = serializers.CuponUsuarioSerializerList(cuponusuarios, many=True).data
        return Response(data)

#Detail
class CuponUsuarioDetailAPIView(APIView):
    def get(self, request, pk):
        cuponusuario = models.CuponUsuario.objects.get(pk=pk)
        data = serializers.CuponUsuarioSerializerDetail(cuponusuario).data
        return Response(data)

#Update
class CuponUsuarioUpdateAPIView(generics.UpdateAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerUpdate

#Delete
class CuponUsuarioDeleteAPIView(generics.DestroyAPIView):
    queryset = models.CuponUsuario.objects.all()
    serializer_class = serializers.CuponUsuarioSerializerDelete


# Canje CRUD

#Create
class CanjeCreateAPIView(generics.CreateAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerCreate

#List
class CanjeListAPIView(APIView):
    def get(self, request):
        canjes = models.Canje.objects.all()
        data = serializers.CanjeSerializerList(canjes, many=True).data
        return Response(data)

#Detail
class CanjeDetailAPIView(APIView):
    def get(self, request, pk):
        canje = models.Canje.objects.get(pk=pk)
        data = serializers.CanjeSerializerDetail(canje).data
        return Response(data)

#Update
class CanjeUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerUpdate

#Delete
class CanjeDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Canje.objects.all()
    serializer_class = serializers.CanjeSerializerDelete


# PlanSuscripcion CRUD

#Create
class PlanSuscripcionCreateAPIView(generics.CreateAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerCreate

#List
class PlanSuscripcionListAPIView(APIView):
    def get(self, request):
        plansuscripcions = models.PlanSuscripcion.objects.all()
        data = serializers.PlanSuscripcionSerializerList(plansuscripcions, many=True).data
        return Response(data)

#Detail
class PlanSuscripcionDetailAPIView(APIView):
    def get(self, request, pk):
        plansuscripcion = models.PlanSuscripcion.objects.get(pk=pk)
        data = serializers.PlanSuscripcionSerializerDetail(plansuscripcion).data
        return Response(data)

#Update
class PlanSuscripcionUpdateAPIView(generics.UpdateAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerUpdate

#Delete
class PlanSuscripcionDeleteAPIView(generics.DestroyAPIView):
    queryset = models.PlanSuscripcion.objects.all()
    serializer_class = serializers.PlanSuscripcionSerializerDelete


# Suscripcion CRUD

#Create
class SuscripcionCreateAPIView(generics.CreateAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerCreate

#List
class SuscripcionListAPIView(APIView):
    def get(self, request):
        suscripcions = models.Suscripcion.objects.all()
        data = serializers.SuscripcionSerializerList(suscripcions, many=True).data
        return Response(data)

#Detail
class SuscripcionDetailAPIView(APIView):
    def get(self, request, pk):
        suscripcion = models.Suscripcion.objects.get(pk=pk)
        data = serializers.SuscripcionSerializerDetail(suscripcion).data
        return Response(data)

#Update
class SuscripcionUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerUpdate

#Delete
class SuscripcionDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Suscripcion.objects.all()
    serializer_class = serializers.SuscripcionSerializerDelete


# Pago CRUD

#Create
class PagoCreateAPIView(generics.CreateAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerCreate

#List
class PagoListAPIView(APIView):
    def get(self, request):
        pagos = models.Pago.objects.all()
        data = serializers.PagoSerializerList(pagos, many=True).data
        return Response(data)

#Detail
class PagoDetailAPIView(APIView):
    def get(self, request, pk):
        pago = models.Pago.objects.get(pk=pk)
        data = serializers.PagoSerializerDetail(pago).data
        return Response(data)

#Update
class PagoUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerUpdate

#Delete
class PagoDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Pago.objects.all()
    serializer_class = serializers.PagoSerializerDelete


# Notificacion CRUD

#Create
class NotificacionCreateAPIView(generics.CreateAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerCreate

#List
class NotificacionListAPIView(APIView):
    def get(self, request):
        notificacions = models.Notificacion.objects.all()
        data = serializers.NotificacionSerializerList(notificacions, many=True).data
        return Response(data)

#Detail
class NotificacionDetailAPIView(APIView):
    def get(self, request, pk):
        notificacion = models.Notificacion.objects.get(pk=pk)
        data = serializers.NotificacionSerializerDetail(notificacion).data
        return Response(data)

#Update
class NotificacionUpdateAPIView(generics.UpdateAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerUpdate

#Delete
class NotificacionDeleteAPIView(generics.DestroyAPIView):
    queryset = models.Notificacion.objects.all()
    serializer_class = serializers.NotificacionSerializerDelete
