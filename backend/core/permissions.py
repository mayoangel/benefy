from django.db.models import F, Q
from rest_framework.permissions import BasePermission

from core import models

#Roles de usuarios de comercio
ROLES_COMERCIO_SUCURSAL = ("admin", "empleado")

#Validar si es usuario de Benefy
def es_usuario_benefy(user):
    return isinstance(user, models.Usuario) and user.is_authenticated

#Validar si es admin del sistema (superadmin)
def es_admin_sistema(user):
    return es_usuario_benefy(user) and user.rol == "admin_sistema"

#Permisos para consultar datos de negocio
def puede_acceder_negocio(user, negocio):
    if es_admin_sistema(user):
        return True
    if not es_usuario_benefy(user) or user.rol != "negocio":
        return False

    membresia = models.UsuarioNegocio.objects.filter( #Obtener membresia
        usuario=user,
        negocio=negocio,
        status=True,
    )
    membresia_dueno = membresia.filter( #Si es el dueño del negocio
        rol_comercio="dueno",
        sucursal__isnull=True,
    )
    membresia_usuario_comercio = membresia.filter( #Si es admin o empleado de sucursal del negocio
        rol_comercio__in=ROLES_COMERCIO_SUCURSAL,
        sucursal__isnull=False,
        sucursal__negocio=negocio,
    )
    return membresia_dueno.exists() or membresia_usuario_comercio.exists()

#Permisos para gestionar datos de negocio
def puede_administrar_negocio(user, negocio):
    if es_admin_sistema(user):
        return True
    if not es_usuario_benefy(user) or user.rol != "negocio":
        return False
    return models.UsuarioNegocio.objects.filter(
        usuario=user,
        negocio=negocio,
        rol_comercio="dueno",
        sucursal__isnull=True,
        status=True,
    ).exists()

#Verificar si el usuario tiene membresía activa (enlazada al negocio)
def _tiene_membresia_sucursal(user, sucursal, roles):
    if not es_usuario_benefy(user) or user.rol != "negocio":
        return False
    return models.UsuarioNegocio.objects.filter(
        usuario=user,
        negocio_id=sucursal.negocio_id,
        sucursal=sucursal,
        rol_comercio__in=roles,
        status=True,
    ).exists()

#Permisos para consultar datos de sucursal
def puede_acceder_sucursal(user, sucursal):
    if es_admin_sistema(user):
        return True
    return puede_administrar_negocio(user, sucursal.negocio) or _tiene_membresia_sucursal(
        user,
        sucursal,
        ROLES_COMERCIO_SUCURSAL,
    )

#Verificar si se puede operar una sucursal
def puede_operar_sucursal(user, sucursal):
    if es_admin_sistema(user):
        return True
    return (
        sucursal.status
        and sucursal.negocio.status
        and (
            puede_administrar_negocio(user, sucursal.negocio)
            or _tiene_membresia_sucursal(user, sucursal, ROLES_COMERCIO_SUCURSAL)
        )
    )

#Permisos para gestionar datos de sucursal
def puede_administrar_operaciones_sucursal(user, sucursal):
    if es_admin_sistema(user):
        return True
    return puede_administrar_negocio(user, sucursal.negocio) or _tiene_membresia_sucursal(
        user,
        sucursal,
        ("admin",),
    )

#Permisos para gestionar membresía de suscripcion a Benefy
def puede_administrar_membresia(user, membresia):
    if es_admin_sistema(user):
        return True
    if not es_usuario_benefy(user) or membresia.rol_comercio == "dueno":
        return False
    if puede_administrar_negocio(user, membresia.negocio):
        return True
    return (
        membresia.rol_comercio == "empleado"
        and membresia.sucursal_id is not None
        and _tiene_membresia_sucursal(user, membresia.sucursal, ("admin",))
    )

#Permisos para crear membresía de suscripción a Benefy
def puede_crear_membresia(user, negocio, sucursal, rol_comercio):
    if es_admin_sistema(user):
        return True
    if rol_comercio == "dueno":
        return False
    if sucursal is None or sucursal.negocio_id != negocio.pk:
        return False
    if puede_administrar_negocio(user, negocio):
        return True
    return (
        rol_comercio == "empleado"
        and _tiene_membresia_sucursal(user, sucursal, ("admin",))
    )

#Permisos para acceder a datos de un usuario
def puede_acceder_usuario(user, usuario):
    return es_admin_sistema(user) or (
        es_usuario_benefy(user) and user.pk == usuario.pk
    )

#Permisos de búsqueda de datos de usuario
def queryset_datos_usuario(user, queryset):
    if es_admin_sistema(user):
        return queryset
    if not es_usuario_benefy(user):
        return queryset.none()
    if queryset.model is models.Usuario:
        return queryset.filter(pk=user.pk)
    return queryset.filter(usuario=user)

#Negocios accesibles por rol (para operaciones que involucren negocios)
def negocios_accesibles(user):
    if es_admin_sistema(user):
        return models.Negocio.objects.all()
    if not es_usuario_benefy(user) or user.rol != "negocio":
        return models.Negocio.objects.none()

    dueno_negocio_ids = models.UsuarioNegocio.objects.filter(
        usuario=user,
        rol_comercio="dueno",
        sucursal__isnull=True,
        status=True,
    ).values("negocio_id")
    usuario_comercio_ids = models.UsuarioNegocio.objects.filter(
        usuario=user,
        rol_comercio__in=ROLES_COMERCIO_SUCURSAL,
        sucursal__isnull=False,
        sucursal__negocio_id=F("negocio_id"),
        status=True,
    ).values("negocio_id")
    return models.Negocio.objects.filter(
        Q(pk__in=dueno_negocio_ids) | Q(pk__in=usuario_comercio_ids)
    ).distinct()

#Negocios accesibles por rol (para operaciones que involucren sucursales de negocios)
def sucursales_accesibles(user):
    if es_admin_sistema(user):
        return models.Sucursal.objects.all()
    if not es_usuario_benefy(user) or user.rol != "negocio":
        return models.Sucursal.objects.none()

    dueno_negocio_ids = models.UsuarioNegocio.objects.filter(
        usuario=user,
        rol_comercio="dueno",
        sucursal__isnull=True,
        status=True,
    ).values("negocio_id")
    usuario_comercio_ids = models.UsuarioNegocio.objects.filter(
        usuario=user,
        rol_comercio__in=ROLES_COMERCIO_SUCURSAL,
        sucursal__isnull=False,
        sucursal__negocio_id=F("negocio_id"),
        status=True,
    ).values("sucursal_id")
    return models.Sucursal.objects.filter(
        Q(negocio_id__in=dueno_negocio_ids) | Q(pk__in=usuario_comercio_ids)
    ).distinct()


class EsUsuarioBenefy(BasePermission):
    def has_permission(self, request, view):
        return es_usuario_benefy(request.user)


class EsConsumidor(EsUsuarioBenefy):
    def has_permission(self, request, view):
        return es_usuario_benefy(request.user) and request.user.rol == "consumidor"


class EsAdminSistema(EsUsuarioBenefy):
    def has_permission(self, request, view):
        return es_admin_sistema(request.user)

    def has_object_permission(self, request, view, obj):
        return es_admin_sistema(request.user)


class PuedeAccederNegocio(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        return isinstance(obj, models.Negocio) and puede_acceder_negocio(request.user, obj)


class PuedeAdministrarNegocio(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        negocio = obj if isinstance(obj, models.Negocio) else getattr(obj, "negocio", None)
        return negocio is not None and puede_administrar_negocio(request.user, negocio)


class PuedeAccederSucursal(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        sucursal = obj if isinstance(obj, models.Sucursal) else getattr(obj, "sucursal", None)
        return sucursal is not None and puede_acceder_sucursal(request.user, sucursal)


class PuedeOperarSucursal(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        sucursal = obj if isinstance(obj, models.Sucursal) else getattr(obj, "sucursal", None)
        return sucursal is not None and puede_operar_sucursal(request.user, sucursal)


class PuedeAdministrarOperacionesSucursal(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        sucursal = obj if isinstance(obj, models.Sucursal) else getattr(obj, "sucursal", None)
        return sucursal is not None and puede_administrar_operaciones_sucursal(request.user, sucursal)


class PuedeAdministrarMembresia(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        return isinstance(obj, models.UsuarioNegocio) and puede_administrar_membresia(request.user, obj)


class PuedeAccederDatosPropiosUsuario(EsUsuarioBenefy):
    def has_object_permission(self, request, view, obj):
        usuario = obj if isinstance(obj, models.Usuario) else getattr(obj, "usuario", None)
        return usuario is not None and puede_acceder_usuario(request.user, usuario)
