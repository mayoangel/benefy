"""Catálogo de planes, resumen del plan y cambios administrativos."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models, permissions
from core.services import planes


def _datos_plan(plan, es_admin=False):
    datos = {
        'id': plan.pk,
        'codigo': plan.codigo,
        'nombre': plan.nombre,
        'descripcion': plan.descripcion,
        'orden': plan.orden,
        'limites': planes.validar_limites(plan.limites),
        'caracteristicas': planes.validar_caracteristicas(plan.caracteristicas),
        'caracteristicas_implementadas': list(planes.CARACTERISTICAS_IMPLEMENTADAS),
        'precios': [
            {
                'intervalo': precio.intervalo,
                'monto': str(precio.monto) if precio.monto is not None else None,
                'divisa': precio.divisa,
                'status': precio.status,
                **({'stripe_price_id': precio.stripe_price_id} if es_admin else {}),
            }
            for precio in plan.precios.all()
            if precio.status
        ],
    }
    return datos


class CatalogoPlanesAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request):
        es_admin = permissions.es_admin_sistema(request.user)
        planes_qs = models.PlanSuscripcion.objects.filter(
            status=True,
        ).prefetch_related('precios').order_by('orden', 'nombre')
        return Response([
            _datos_plan(plan, es_admin=es_admin) for plan in planes_qs
        ])


class PlanNegocioAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_acceder_negocio(request.user, negocio):
            return Response(
                {'codigo': 'sin_permiso', 'detalle': 'No tienes acceso a este negocio.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(planes.resumen_plan(negocio))

    def post(self, request, pk):
        if not permissions.es_admin_sistema(request.user):
            raise PermissionDenied('Solo un administrador del sistema puede cambiar el plan.')

        negocio = get_object_or_404(models.Negocio, pk=pk)
        codigo = request.data.get('plan_codigo')
        plan_id = request.data.get('plan')
        if codigo:
            plan = models.PlanSuscripcion.objects.filter(
                codigo=str(codigo).strip().lower(),
            ).first()
        elif plan_id:
            try:
                plan = models.PlanSuscripcion.objects.filter(pk=int(plan_id)).first()
            except (TypeError, ValueError):
                plan = None
        else:
            raise ValidationError({
                'plan_codigo': 'Indica plan_codigo (free o premium) o plan (id).'
            })
        if plan is None:
            raise ValidationError({'plan_codigo': 'El plan indicado no existe.'})

        motivo = str(request.data.get('motivo', '')).strip()
        if len(motivo) < 5:
            raise ValidationError({
                'motivo': 'Registra un motivo de al menos 5 caracteres.'
            })

        try:
            planes.cambiar_plan(
                negocio=negocio,
                plan=plan,
                actor=request.user,
                motivo=motivo,
                origen='manual',
            )
        except planes.ErrorPlan as exc:
            raise ValidationError({'detail': str(exc)}) from None
        except planes.ErrorConfiguracionPlan as exc:
            raise ValidationError({'detail': str(exc)}) from None

        return Response(planes.resumen_plan(negocio))


class HistorialPlanAPIView(APIView):
    permission_classes = [permissions.EsUsuarioBenefy]

    def get(self, request, pk):
        negocio = get_object_or_404(models.Negocio, pk=pk)
        if not permissions.puede_acceder_negocio(request.user, negocio):
            return Response(
                {'codigo': 'sin_permiso', 'detalle': 'No tienes acceso a este negocio.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        historial = planes.historial_plan(negocio)
        return Response([
            {
                'id': cambio.pk,
                'plan_anterior': (
                    cambio.plan_anterior.codigo if cambio.plan_anterior_id else None
                ),
                'plan_nuevo': cambio.plan_nuevo.codigo,
                'origen': cambio.origen,
                'motivo': cambio.motivo,
                'actor_correo': cambio.actor_correo,
                'fecha': cambio.fecha,
            }
            for cambio in historial
        ])
