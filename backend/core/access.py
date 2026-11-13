"""Alcance de consultas y autorización de escrituras del CRUD existente."""

from django.db import transaction
from django.db.models import F, Q
from rest_framework.exceptions import PermissionDenied

from core import models, permissions


def scoped_queryset(user, queryset):
    if permissions.es_admin_sistema(user):
        return queryset
    if not permissions.es_usuario_benefy(user):
        return queryset.none()
    model = queryset.model
    businesses = permissions.negocios_accesibles(user)
    branches = permissions.sucursales_accesibles(user)
    rewards = models.Recompensa.objects.filter(
        Q(dinamica__negocio__in=businesses)
        | Q(alianza__negocio1__in=businesses)
        | Q(alianza__negocio2__in=businesses)
    )
    if model is models.Usuario:
        return queryset.filter(pk=user.pk)
    if model in (models.CategoriaNegocio, models.PlanSuscripcion):
        return queryset
    if model is models.Negocio:
        return queryset.filter(pk__in=businesses)
    if model is models.Sucursal:
        return queryset.filter(pk__in=branches)
    if model is models.UsuarioNegocio:
        owner_businesses = models.UsuarioNegocio.objects.filter(
            usuario=user, rol_comercio='dueno', sucursal__isnull=True, status=True,
        ).values('negocio_id')
        admin_branches = models.UsuarioNegocio.objects.filter(
            usuario=user, rol_comercio='admin', status=True,
            sucursal__negocio_id=F('negocio_id'),
        ).values('sucursal_id')
        return queryset.filter(
            Q(usuario=user) | Q(negocio_id__in=owner_businesses)
            | Q(sucursal_id__in=admin_branches)
        )
    if model in (models.Dinamica, models.Suscripcion, models.Pago):
        # Facturación solo para propietarios; programas para miembros del negocio.
        if model in (models.Suscripcion, models.Pago):
            businesses = businesses.filter(usuarionegocio__usuario=user,
                usuarionegocio__rol_comercio='dueno',
                usuarionegocio__sucursal__isnull=True, usuarionegocio__status=True)
        return queryset.filter(negocio__in=businesses)
    if model is models.Alianza:
        return queryset.filter(Q(negocio1__in=businesses) | Q(negocio2__in=businesses)).distinct()
    if model is models.Recompensa:
        return queryset.filter(pk__in=rewards)
    if model is models.RegistroActividad:
        return queryset.filter(Q(usuario=user) | Q(sucursal__in=branches))
    if model is models.ProgresoUsuario:
        return queryset.filter(Q(usuario=user) | Q(dinamica__negocio__in=businesses))
    if model is models.CuponUsuario:
        return queryset.filter(Q(usuario=user) | Q(recompensa__in=rewards))
    if model is models.Canje:
        return queryset.filter(Q(cupon__usuario=user) | Q(sucursal__in=branches))
    if model is models.Notificacion:
        return queryset.filter(usuario=user)
    return queryset.none()


def authorize_write(user, model, data, instance=None, method='POST', supplied_fields=()):
    if permissions.es_admin_sistema(user):
        return
    allowed = False

    def value(field):
        return data.get(field, getattr(instance, field, None))

    if model is models.Usuario:
        allowed = method in ('PUT', 'PATCH') and instance.pk == user.pk
    elif model is models.Negocio:
        allowed = method == 'POST' or (
            method in ('PUT', 'PATCH') and permissions.puede_administrar_negocio(user, instance)
        )
        if 'stripe_id' in supplied_fields:
            allowed = False
    elif model is models.Sucursal:
        business = value('negocio')
        allowed = business is not None and permissions.puede_administrar_negocio(user, business)
        if instance:
            allowed = allowed and instance.negocio_id == business.pk
    elif model is models.UsuarioNegocio:
        if method == 'DELETE':
            allowed = permissions.puede_administrar_membresia(user, instance)
        else:
            allowed = permissions.puede_crear_membresia(
                user, value('negocio'), value('sucursal'), value('rol_comercio') or 'empleado',
            )
            if instance:
                allowed = (allowed and permissions.puede_administrar_membresia(user, instance)
                           and value('negocio').pk == instance.negocio_id
                           and value('usuario').pk == instance.usuario_id)
    elif model is models.Dinamica:
        business = value('negocio')
        allowed = business is not None and permissions.puede_administrar_negocio(user, business)
        if instance:
            allowed = allowed and instance.negocio_id == business.pk
    elif model is models.Recompensa:
        program, alliance = value('dinamica'), value('alianza')
        if program and not alliance:
            allowed = permissions.puede_administrar_negocio(user, program.negocio)
        elif alliance and not program:
            allowed = all(permissions.puede_administrar_negocio(user, business)
                          for business in (alliance.negocio1, alliance.negocio2))
        # El origen de una recompensa existente no se puede trasladar a otro negocio.
        if instance:
            allowed = (allowed and instance.dinamica_id == (program.pk if program else None)
                       and instance.alianza_id == (alliance.pk if alliance else None))
    elif model in (models.RegistroActividad, models.Canje) and method == 'POST':
        branch = value('sucursal')
        allowed = branch is not None and permissions.puede_operar_sucursal(user, branch)
    elif model is models.Notificacion:
        allowed = (instance is not None and instance.usuario_id == user.pk
                   and method in ('PUT', 'PATCH') and set(supplied_fields) <= {'leida'})
    # Saldos, emisión de cupones, alianzas y facturación requieren procesos de
    # negocio específicos; el CRUD de escritura queda reservado al admin.
    if not allowed:
        raise PermissionDenied('No tienes permisos para realizar esta operación.')


class ResourceAccessMixin:
    def get_queryset(self):
        return scoped_queryset(self.request.user, super().get_queryset())

    @transaction.atomic
    def perform_create(self, serializer):
        model = serializer.Meta.model
        authorize_write(self.request.user, model, serializer.validated_data,
                        supplied_fields=self.request.data.keys())
        instance = serializer.save()
        if model is models.Negocio:
            user = self.request.user
            if user.rol == 'consumidor':
                user.rol = 'negocio'
                user.save(update_fields=['rol'])
            models.UsuarioNegocio.objects.create(usuario=user, negocio=instance,
                                                rol_comercio='dueno', sucursal=None)
        elif model is models.UsuarioNegocio and instance.usuario.rol == 'consumidor':
            instance.usuario.rol = 'negocio'
            instance.usuario.save(update_fields=['rol'])

    def perform_update(self, serializer):
        authorize_write(self.request.user, serializer.Meta.model, serializer.validated_data,
                        serializer.instance, self.request.method, self.request.data.keys())
        serializer.save()

    def perform_destroy(self, instance):
        authorize_write(self.request.user, type(instance), {}, instance, 'DELETE')
        instance.delete()
