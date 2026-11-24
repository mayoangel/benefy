import os
from collections import Counter
from contextvars import ContextVar, Token
from datetime import date
from typing import Any, Literal

import requests
from fastapi import APIRouter, HTTPException, Security
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, PositiveInt


def _timeout_backend():
    try:
        valor = float(os.getenv("BACKEND_TIMEOUT_SECONDS", "10"))
    except (TypeError, ValueError):
        return 10.0
    return valor if 0 < valor <= 60 else 10.0


BACKEND_TIMEOUT_SECONDS = _timeout_backend()
bearer_scheme = HTTPBearer(auto_error=False) #Para autenticación
router = APIRouter(prefix="/consultas", tags=["Consultas de negocio"])
_chat_business_context: ContextVar[int | None] = ContextVar(
    "benef_ai_chat_business_context",
    default=None,
)


class NegocioConsulta(BaseModel):
    negocio_id: PositiveInt


class FiltrosOperacion(NegocioConsulta):
    desde: date | None = None
    hasta: date | None = None
    sucursal_id: PositiveInt | None = None
    page: PositiveInt = 1
    page_size: int = Field(default=20, ge=1, le=100)


class VisitasConsulta(FiltrosOperacion):
    estado: Literal["validas", "anuladas"] | None = None


class CanjesConsulta(FiltrosOperacion):
    anulado: bool | None = None


class CuponesConsulta(NegocioConsulta):
    desde: date | None = None
    hasta: date | None = None
    page: PositiveInt = 1
    page_size: int = Field(default=20, ge=1, le=100)
    estado: Literal["disponible", "canjeado", "vencido", "anulado"] | None = None


class ProgramasConsulta(NegocioConsulta):
    dinamica_id: PositiveInt | None = None
    solo_activas: bool = True


class RecompensasConsulta(NegocioConsulta):
    solo_activas: bool = True

#Obtener token de autenticación
def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Se requiere una sesión autenticada.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials

#Configuracion de solicitud a backend
def _backend_request(
    path: str,
    access_token: str,
    params: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    backend_api_url = os.getenv("BACKEND_API_URL", "").rstrip("/")
    if not backend_api_url:
        raise HTTPException(
            status_code=503,
            detail="La conexión con el backend no está configurada.",
        )
    try:
        response = requests.get(
            f"{backend_api_url}{path}",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            params=params,
            timeout=BACKEND_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except requests.exceptions.Timeout as exc:
        raise HTTPException(status_code=504, detail="El backend no respondió a tiempo.") from exc
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="No fue posible comunicarse con el backend.",
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="El backend devolvió una respuesta inválida.",
        ) from exc
    if not isinstance(payload, (dict, list)):
        raise HTTPException(
            status_code=502,
            detail="El backend devolvió una respuesta inesperada.",
        )
    return response.status_code, payload

#Configuracion de acceso a consultas al backend por rol
def _backend_get(
    path: str,
    access_token: str,
    params: dict[str, Any] | None = None,
    *,
    negocio_id: int,
) -> Any:
    if _chat_business_context.get() != negocio_id:
        access_error = validar_acceso_negocio(access_token, negocio_id)
        if access_error is not None:
            return access_error
    status_code, payload = _backend_request(path, access_token, params)
    if status_code >= 400:
        return JSONResponse(status_code=status_code, content=payload)
    return payload


def establecer_acceso_chat_validado(negocio_id: int) -> Token[int | None]:
    return _chat_business_context.set(negocio_id)


def restaurar_acceso_chat(context_token: Token[int | None]) -> None:
    _chat_business_context.reset(context_token)


def validar_acceso_negocio(access_token: str, negocio_id: int) -> JSONResponse | None:
    status_code, context = _backend_request("/mi/contexto/", access_token)
    if status_code >= 400:
        return JSONResponse(status_code=status_code, content=context)
    if not isinstance(context, dict) or not isinstance(context.get("negocios"), list):
        raise HTTPException(status_code=502, detail="El backend devolvió un contexto inválido.")
    if context.get("es_admin_sistema") is True:
        raise HTTPException(
            status_code=403,
            detail="Benef-AI está disponible únicamente para usuarios de negocio.",
        )
    if not any(
        isinstance(negocio, dict) and negocio.get("id") == negocio_id
        for negocio in context["negocios"]
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a este negocio.",
        )
    return None


def validar_acceso_chat(access_token: str, negocio_id: int) -> JSONResponse | None:
    return validar_acceso_negocio(access_token, negocio_id)


#Consultas por rango de fecha
def _validar_fechas(desde: date | None, hasta: date | None) -> None:
    if desde and hasta and desde > hasta:
        raise HTTPException(
            status_code=422,
            detail="La fecha inicial no puede ser posterior a la fecha final.",
        )

#Consultas con filtros aplicados
def _filtros_paginados(consulta: FiltrosOperacion) -> dict[str, Any]:
    _validar_fechas(consulta.desde, consulta.hasta)
    return {
        key: value
        for key, value in {
            "desde": consulta.desde.isoformat() if consulta.desde else None,
            "hasta": consulta.hasta.isoformat() if consulta.hasta else None,
            "sucursal": consulta.sucursal_id,
            "page": consulta.page,
            "page_size": consulta.page_size,
        }.items()
        if value is not None
    }

#Carga de página con respuesta
def _pagina_sanitizada(payload: Any, campos: tuple[str, ...]) -> Any:
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise HTTPException(status_code=502, detail="El backend devolvió una página inválida.")
    return {
        "count": payload.get("count", 0),
        "results": [
            {campo: fila.get(campo) for campo in campos if campo in fila}
            for fila in payload["results"]
            if isinstance(fila, dict)
        ],
    }

#Consulta de métricas principales
@router.post("/metricas")
def consultar_metricas(
    consulta: FiltrosOperacion,
    access_token: str = Security(get_bearer_token),
) -> Any:
    params = _filtros_paginados(consulta)
    params.pop("page")
    params.pop("page_size")
    return _backend_get(
        f"/negocios/{consulta.negocio_id}/metricas/", access_token, params,
        negocio_id=consulta.negocio_id,
    )

#Consulta de visitas a negocio/sucursales
@router.post("/visitas")
def consultar_visitas(
    consulta: VisitasConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    params = _filtros_paginados(consulta)
    if consulta.estado:
        params["estado"] = consulta.estado
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/visitas/", access_token, params,
        negocio_id=consulta.negocio_id,
    )
    return _pagina_sanitizada(
        payload,
        ("sucursal_nombre", "metodo_validacion", "tipo", "monto_transaccion",
         "fecha", "fecha_negocio", "es_valida"),
    )

#Consulta de datos de canjes
@router.post("/canjes")
def consultar_canjes(
    consulta: CanjesConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    params = _filtros_paginados(consulta)
    if consulta.anulado is not None:
        params["anulado"] = str(consulta.anulado).lower()
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/canjes/", access_token, params,
        negocio_id=consulta.negocio_id,
    )
    return _pagina_sanitizada(
        payload,
        ("titulo_beneficio", "sucursal_nombre", "origen", "metodo", "fecha", "anulado"),
    )

#Consulta de info de cupones
@router.post("/cupones")
def consultar_cupones(
    consulta: CuponesConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    _validar_fechas(consulta.desde, consulta.hasta)
    params = {
        key: value
        for key, value in {
            "desde": consulta.desde.isoformat() if consulta.desde else None,
            "hasta": consulta.hasta.isoformat() if consulta.hasta else None,
            "page": consulta.page,
            "page_size": consulta.page_size,
            "estado": consulta.estado,
        }.items()
        if value is not None
    }
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/cupones/", access_token, params,
        negocio_id=consulta.negocio_id,
    )
    return _pagina_sanitizada(
        payload,
        ("origen", "status", "titulo_beneficio", "costo_pagado", "fecha_expiracion"),
    )

#Consulta de programas de lealtad
@router.post("/programas")
def consultar_programas(
    consulta: ProgramasConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    if consulta.dinamica_id:
        payload = _backend_get(
            f"/dinamica/detalle/{consulta.dinamica_id}/", access_token,
            negocio_id=consulta.negocio_id,
        )
        if isinstance(payload, JSONResponse):
            return payload
        if not isinstance(payload, dict) or payload.get("negocio") != consulta.negocio_id:
            raise HTTPException(status_code=404, detail="El programa no existe en este negocio.")
        return {
            campo: payload.get(campo)
            for campo in (
                "id", "nombre", "descripcion", "tipo", "meta", "regla_conversion",
                "es_repetible", "dias_expiracion_puntos", "fecha_inicio", "fecha_fin",
                "status", "negocio",
            )
        }

    payload = _backend_get(
        "/dinamicas/listar/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió programas inválidos.")
    return [
        fila for fila in payload
        if isinstance(fila, dict)
        and fila.get("negocio") == consulta.negocio_id
        and (not consulta.solo_activas or fila.get("status") is True)
    ]

#Consulta de recompensas ofrecidas
@router.post("/recompensas")
def consultar_recompensas(
    consulta: RecompensasConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        "/recompensas/listar/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió recompensas inválidas.")
    alianzas_del_negocio = {
        fila.get("alianza")
        for fila in payload
        if isinstance(fila, dict) and fila.get("alianza") is not None
    }
    if alianzas_del_negocio:
        payload_alianzas = _backend_get(
            "/alianzas/listar/", access_token,
            negocio_id=consulta.negocio_id,
        )
        if isinstance(payload_alianzas, JSONResponse):
            return payload_alianzas
        if not isinstance(payload_alianzas, list):
            raise HTTPException(status_code=502, detail="El backend devolvió alianzas inválidas.")
        alianzas_del_negocio = {
            alianza.get("id")
            for alianza in payload_alianzas
            if isinstance(alianza, dict)
            and alianza.get("id") in alianzas_del_negocio
            and consulta.negocio_id in (alianza.get("negocio1"), alianza.get("negocio2"))
        }
    campos = (
        "id", "titulo", "descripcion", "tipo", "descuento", "costo_desbloqueo",
        "terminos_condiciones", "status", "es_meta", "fecha_expiracion",
        "vigencia_dias", "cantidad_disponible", "dinamica", "alianza",
    )
    return [
        {campo: fila.get(campo) for campo in campos}
        for fila in payload
        if isinstance(fila, dict)
        and (
            fila.get("negocio") == consulta.negocio_id
            or fila.get("alianza") in alianzas_del_negocio
        )
        and (not consulta.solo_activas or fila.get("status") is True)
    ]

#Consulta de plan de suscripción
@router.post("/plan")
def consultar_plan(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    return _backend_get(
        f"/negocios/{consulta.negocio_id}/plan/", access_token,
        negocio_id=consulta.negocio_id,
    )

#Consulta de datos de negocio
@router.post("/negocio")
def consultar_negocio(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        f"/negocio/detalle/{consulta.negocio_id}/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="El backend devolvió datos inválidos.")
    campos = ("id", "nombre", "descripcion", "direccion", "zona_horaria", "status")
    return {campo: payload.get(campo) for campo in campos}

#Consulta de equipo de trabajo de negocio
@router.post("/equipo")
def consultar_equipo(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        "/usuarios-negocio/listar/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió membresías inválidas.")
    miembros = [
        fila for fila in payload
        if isinstance(fila, dict) and fila.get("negocio") == consulta.negocio_id
    ]
    return {
        "miembros_visibles": len(miembros),
        "alcance": "Membresías visibles según el sistema; no necesariamente el equipo completo.",
        "por_rol": dict(Counter(fila.get("rol_comercio", "desconocido") for fila in miembros)),
        "activas": sum(fila.get("status") is True for fila in miembros),
        "inactivas": sum(fila.get("status") is False for fila in miembros),
        "por_sucursal": dict(Counter(
            fila.get("sucursal_nombre") or "Todas las sucursales"
            for fila in miembros if fila.get("status") is True
        )),
    }

#Consulta de clientes únicos por periodo
class ClientesConsulta(FiltrosOperacion):
    pass


@router.post("/clientes")
def consultar_clientes(
    consulta: ClientesConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    params = _filtros_paginados(consulta)
    params.pop("page")
    params.pop("page_size")
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/metricas/", access_token, params,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, dict) or not isinstance(payload.get("clientes_unicos"), int):
        raise HTTPException(status_code=502, detail="El backend devolvió métricas inválidas.")
    return {
        "clientes_unicos": payload["clientes_unicos"],
        "desde": payload.get("desde"),
        "hasta": payload.get("hasta"),
        "alcance": payload.get("alcance"),
    }

#Consulta de sucursales
@router.post("/sucursales")
def consultar_sucursales(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        "/sucursales/listar/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió sucursales inválidas.")
    campos = ("id", "nombre", "ciudad", "status", "negocio")
    return [
        {campo: fila.get(campo) for campo in campos}
        for fila in payload
        if isinstance(fila, dict) and fila.get("negocio") == consulta.negocio_id
    ]

#Consulta de invitaciones
@router.post("/invitaciones")
def consultar_invitaciones(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/invitaciones/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió invitaciones inválidas.")
    invitaciones = [
        fila for fila in payload
        if isinstance(fila, dict)
        and isinstance(fila.get("negocio"), dict)
        and fila["negocio"].get("id") == consulta.negocio_id
    ]
    return {
        "total": len(invitaciones),
        "por_estado": dict(Counter(fila.get("estado", "desconocido") for fila in invitaciones)),
        "por_rol": dict(Counter(fila.get("rol_comercio", "desconocido") for fila in invitaciones)),
        "por_sucursal": dict(Counter(
            (fila.get("sucursal") or {}).get("nombre", "Todas las sucursales")
            for fila in invitaciones
        )),
    }

#Consulta de alianzas con otros negocios
@router.post("/alianzas")
def consultar_alianzas(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        "/alianzas/listar/", access_token,
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió alianzas inválidas.")
    alianzas = [
        fila for fila in payload
        if isinstance(fila, dict)
        and consulta.negocio_id in (fila.get("negocio1"), fila.get("negocio2"))
    ]
    return {
        "total": len(alianzas),
        "por_estado": dict(Counter(fila.get("status", "desconocido") for fila in alianzas)),
        "alianzas": [
            {
                "id": fila.get("id"),
                "estado": fila.get("status"),
                "fecha_inicio": fila.get("fecha_inicio"),
                "fecha_fin": fila.get("fecha_fin"),
            }
            for fila in alianzas
        ],
    }