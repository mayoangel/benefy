"""Throttles acotados para endpoints sensibles del móvil."""

from rest_framework.throttling import UserRateThrottle


class PerfilThrottle(UserRateThrottle):
    scope = 'perfil'


class VisitaResolverThrottle(UserRateThrottle):
    scope = 'visita_resolver'


class VisitaRegistrarThrottle(UserRateThrottle):
    scope = 'visita_registrar'


class DirectorioThrottle(UserRateThrottle):
    scope = 'directorio'


class CuponAdquirirThrottle(UserRateThrottle):
    scope = 'cupon_adquirir'


class CuponCanjearThrottle(UserRateThrottle):
    scope = 'cupon_canjear'


class EliminacionCuentaThrottle(UserRateThrottle):
    scope = 'cuenta_eliminar'
