"""Throttles acotados para endpoints sensibles del móvil."""

from rest_framework.exceptions import Throttled
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


class BenefAIChatThrottle(UserRateThrottle):
    scope = 'benef_ai_chat'

    def allow_request(self, request, view):
        if super().allow_request(request, view):
            return True
        raise Throttled(
            wait=self.wait(),
            detail='Has alcanzado el límite de consultas a Benef AI. Intenta más tarde.',
        )
