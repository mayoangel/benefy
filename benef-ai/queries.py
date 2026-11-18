import os
from collections import Counter
from datetime import date
from typing import Any, Literal

import requests
from fastapi import APIRouter, HTTPException, Security
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, PositiveInt

BACKEND_TIMEOUT_SECONDS = 10 #Tiempo de espera
bearer_scheme = HTTPBearer(auto_error=False) #Para autenticación
router = APIRouter(prefix="/consultas", tags=["Consultas de negocio"])


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
    allowed_roles: tuple[str, ...] | None = None,
) -> Any:
    context_status, context = _backend_request(
        "/mi/contexto/", access_token,
    )
    if context_status >= 400:
        return JSONResponse(status_code=context_status, content=context)
    if not isinstance(context, dict):
        raise HTTPException(status_code=502, detail="El backend devolvió un contexto inválido.")
    if context.get("es_admin_sistema") is True:
        raise HTTPException(
            status_code=403,
            detail="Benef-AI está disponible únicamente para usuarios de negocio.",
        )

    roles = {
        membresia.get("rol_comercio")
        for membresia in context.get("membresias", [])
        if isinstance(membresia, dict)
        and membresia.get("status") is True
        and isinstance(membresia.get("negocio"), dict)
        and membresia["negocio"].get("id") == negocio_id
    }
    if not roles:
        raise HTTPException(
            status_code=403,
            detail="No tienes una membresía activa en este negocio.",
        )
    if allowed_roles and not roles.intersection(allowed_roles):
        raise HTTPException(
            status_code=403,
            detail="Tu rol no puede consultar esta información.",
        )

    status_code, payload = _backend_request(path, access_token, params)
    if status_code >= 400:
        return JSONResponse(status_code=status_code, content=payload)
    return payload

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
        "/dinamicas/listar/", access_token, negocio_id=consulta.negocio_id,
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
        "/recompensas/listar/", access_token, negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="El backend devolvió recompensas inválidas.")
    campos = (
        "id", "titulo", "descripcion", "tipo", "descuento", "costo_desbloqueo",
        "terminos_condiciones", "status", "es_meta", "fecha_expiracion",
        "vigencia_dias", "cantidad_disponible", "dinamica", "alianza",
    )
    return [
        {campo: fila.get(campo) for campo in campos}
        for fila in payload
        if isinstance(fila, dict)
        and fila.get("negocio") == consulta.negocio_id
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
        allowed_roles=("dueno", "supervisor"),
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
        "total": len(miembros),
        "por_rol": dict(Counter(fila.get("rol_comercio", "desconocido") for fila in miembros)),
        "activas": sum(fila.get("status") is True for fila in miembros),
        "inactivas": sum(fila.get("status") is False for fila in miembros),
        "por_sucursal": dict(Counter(
            fila.get("sucursal_nombre") or "Todas las sucursales"
            for fila in miembros if fila.get("status") is True
        )),
    }

#Consulta de conteo de clientes
@router.post("/clientes")
def consultar_clientes(
    consulta: NegocioConsulta,
    access_token: str = Security(get_bearer_token),
) -> Any:
    payload = _backend_get(
        f"/negocios/{consulta.negocio_id}/clientes/",
        access_token,
        {"page": 1, "page_size": 1},
        negocio_id=consulta.negocio_id,
    )
    if isinstance(payload, JSONResponse):
        return payload
    if not isinstance(payload, dict) or not isinstance(payload.get("count"), int):
        raise HTTPException(status_code=502, detail="El backend devolvió un conteo inválido.")
    return {"clientes_unicos": payload["count"]}

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