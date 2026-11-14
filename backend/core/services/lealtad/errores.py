"""Errores de negocio del motor de lealtad con códigos estables."""


class ErrorLealtad(Exception):
    """Error de negocio que la API traduce a un código y estado HTTP."""

    codigo = "error_lealtad"
    http_status = 400

    def __init__(self, detalle: str | None = None):
        self.detalle = detalle or self.__class__.__doc__ or "Operación no válida."
        super().__init__(self.detalle)


class QRInvalido(ErrorLealtad):
    """El código QR no corresponde a ningún negocio o sucursal."""

    codigo = "qr_invalido"
    http_status = 404


class NegocioInactivo(ErrorLealtad):
    """El negocio o la sucursal están inactivos."""

    codigo = "negocio_inactivo"
    http_status = 403


class SoloConsumidores(ErrorLealtad):
    """Solo los usuarios consumidores pueden realizar esta operación."""

    codigo = "solo_consumidores"
    http_status = 403


class PuntosInsuficientes(ErrorLealtad):
    """El saldo disponible es menor al costo de la recompensa."""

    codigo = "puntos_insuficientes"
    http_status = 409


class SinStock(ErrorLealtad):
    """La recompensa no tiene existencias disponibles."""

    codigo = "sin_stock"
    http_status = 409


class RecompensaInactiva(ErrorLealtad):
    """La recompensa no está disponible en el catálogo."""

    codigo = "recompensa_inactiva"
    http_status = 409


class RecompensaVencida(ErrorLealtad):
    """La vigencia de la recompensa no permite emitir el cupón."""

    codigo = "recompensa_vencida"
    http_status = 409


class CuponNoEncontrado(ErrorLealtad):
    """El cupón no existe."""

    codigo = "cupon_no_encontrado"
    http_status = 404


class CuponNoDisponible(ErrorLealtad):
    """El cupón ya fue canjeado, anulado o está vencido."""

    codigo = "cupon_no_disponible"
    http_status = 409


class CuponAjeno(ErrorLealtad):
    """El cupón pertenece a otro usuario."""

    codigo = "cupon_ajeno"
    http_status = 403


class AlianzaVencida(ErrorLealtad):
    """La alianza asociada a la recompensa no está vigente."""

    codigo = "alianza_vencida"
    http_status = 409


class SaldoNegativo(ErrorLealtad):
    """La operación dejaría un saldo de puntos negativo."""

    codigo = "saldo_negativo"
    http_status = 409


class IdempotenciaInvalida(ErrorLealtad):
    """La clave de idempotencia falta o está mal formada."""

    codigo = "idempotencia_invalida"
    http_status = 400


class ConflictoIdempotencia(ErrorLealtad):
    """La clave de idempotencia ya se usó para otra operación o recompensa."""

    codigo = "conflicto_idempotencia"
    http_status = 409


class ConfiguracionInvalida(ErrorLealtad):
    """La configuración de la dinámica o recompensa impide la operación."""

    codigo = "configuracion_invalida"
    http_status = 409
