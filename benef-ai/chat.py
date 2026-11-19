import json
import os
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Security
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, PositiveInt, ValidationError, field_validator

from google import genai

from queries import ( #Consultas para hacer
    CanjesConsulta,
    ClientesConsulta,
    CuponesConsulta,
    FiltrosOperacion,
    NegocioConsulta,
    ProgramasConsulta,
    RecompensasConsulta,
    VisitasConsulta,
    consultar_alianzas,
    consultar_canjes,
    consultar_clientes,
    consultar_cupones,
    consultar_equipo,
    consultar_invitaciones,
    consultar_metricas,
    consultar_negocio,
    consultar_plan,
    consultar_programas,
    consultar_recompensas,
    consultar_sucursales,
    consultar_visitas,
    establecer_acceso_chat_validado,
    get_bearer_token,
    restaurar_acceso_chat,
    validar_acceso_chat,
)

router = APIRouter(tags=["Chat"])
MAX_TOOL_ROUNDS = 4
MAX_TOOL_CALLS = 4
MAX_HISTORY_TURNS = 12

#Identidad de Benef-AI
SYSTEM_INSTRUCTION = """ 
Eres Benef-AI, asistente en español para dueños, supervisores y empleados de
negocios Benefy. Responde con claridad y concisión. No inventes cifras ni digas
que consultaste datos si no ejecutaste la consulta correspondiente. Usa las
tools para preguntas sobre la operación y limita toda respuesta al negocio
actual. No reveles información personal de clientes ni de otros negocios.
Pregunta si falta un periodo, sucursal u otro dato necesario; si la consulta de
métricas usa el periodo predeterminado, aclara que corresponde a los últimos
30 días. El conteo de clientes es único para el periodo consultado; el resumen
de equipo puede estar limitado al alcance visible para el usuario. Si una tool
reporta un error o no hay datos, explícalo sin convertir
errores en ceros. Solo tienes tools de lectura; no afirmes haber cambiado datos.
""".strip()

#Filtros de consulta
TOOL_DECLARATION = {
    "type": "function",
    "name": "consultar_datos_negocio",
    "description": (
        "Consulta información autorizada y de solo lectura del negocio actual. "
        "Elige el tipo de consulta y proporciona únicamente los filtros necesarios."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "consulta": {
                "type": "string",
                "enum": [
                    "metricas", "visitas", "canjes", "cupones", "programas",
                    "recompensas", "plan", "negocio", "equipo", "clientes",
                    "sucursales", "invitaciones", "alianzas",
                ],
            },
            "desde": {"type": "string", "description": "Fecha ISO YYYY-MM-DD."},
            "hasta": {"type": "string", "description": "Fecha ISO YYYY-MM-DD."},
            "sucursal_id": {"type": "integer", "description": "ID positivo de sucursal."},
            "page": {"type": "integer", "description": "Página positiva."},
            "page_size": {"type": "integer", "description": "Tamaño entre 1 y 100."},
            "estado": {
                "type": "string",
                "enum": ["validas", "anuladas", "disponible", "canjeado", "vencido", "anulado"],
            },
            "anulado": {"type": "boolean"},
            "dinamica_id": {"type": "integer", "minimum": 1},
            "solo_activas": {"type": "boolean"},
        },
        "required": ["consulta"],
    },
}

TOOL_HANDLERS = {
    "metricas": (FiltrosOperacion, consultar_metricas),
    "visitas": (VisitasConsulta, consultar_visitas),
    "canjes": (CanjesConsulta, consultar_canjes),
    "cupones": (CuponesConsulta, consultar_cupones),
    "programas": (ProgramasConsulta, consultar_programas),
    "recompensas": (RecompensasConsulta, consultar_recompensas),
    "plan": (NegocioConsulta, consultar_plan),
    "negocio": (NegocioConsulta, consultar_negocio),
    "equipo": (NegocioConsulta, consultar_equipo),
    "clientes": (ClientesConsulta, consultar_clientes),
    "sucursales": (NegocioConsulta, consultar_sucursales),
    "invitaciones": (NegocioConsulta, consultar_invitaciones),
    "alianzas": (NegocioConsulta, consultar_alianzas),
}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    negocio_id: PositiveInt
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El mensaje no puede estar vacío.")
        return value.strip()


class ChatResponse(BaseModel):
    answer: str
    tools_used: list[str]

#Ejecución de tools para consultas
def _run_tool(name: str, arguments: dict[str, Any], negocio_id: int, token: str) -> dict[str, Any]:
    consulta = arguments.get("consulta")
    handler = TOOL_HANDLERS.get(consulta)
    if handler is None:
        return {"error": "Tipo de consulta no permitido."}

    model, function = handler
    try:
        request = model.model_validate({**arguments, "negocio_id": negocio_id})
        access_token = establecer_acceso_chat_validado(negocio_id)
        try:
            result = function(request, token)
        finally:
            restaurar_acceso_chat(access_token)
    except ValidationError:
        return {"error": "Los filtros de la consulta no son válidos."}
    except HTTPException as exc:
        return {"error": exc.detail, "status": exc.status_code}

    if isinstance(result, JSONResponse):
        try:
            detail = json.loads(result.body)
        except (TypeError, ValueError):
            detail = "La consulta no se pudo completar."
        return {"error": detail, "status": result.status_code}
    return {"data": result}

#Historial de interacciones
def _interaction_history(request: ChatRequest) -> list[dict[str, Any]]:
    turns = request.history[-MAX_HISTORY_TURNS:]
    transcript = "\n".join(
        f"{turn.role}: {turn.content}" for turn in turns
    )
    transcript = f"{transcript}\n" if transcript else ""
    transcript += f"user: {request.message}"
    return [{
        "type": "user_input",
        "content": [{"type": "text", "text": transcript}],
    }]

#Ruta de chat con el agente
@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    access_token: str = Security(get_bearer_token),
) -> ChatResponse | JSONResponse:
    access_result = validar_acceso_chat(access_token, request.negocio_id)
    if isinstance(access_result, JSONResponse):
        return access_result
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="El proveedor Gemini no está configurado.")

    model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    client = genai.Client(api_key=api_key)
    interaction_history = _interaction_history(request)
    tools_used: list[str] = []

    for tool_round in range(MAX_TOOL_ROUNDS + 1):
        try:
            interaction = client.interactions.create(
                model=model_name,
                input=interaction_history,
                tools=[TOOL_DECLARATION],
                system_instruction=SYSTEM_INSTRUCTION,
                store=False,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="No fue posible obtener una respuesta de Gemini.",
            ) from exc

        steps = interaction.steps or []
        function_calls = [step for step in steps if step.type == "function_call"]
        if not function_calls:
            answer = (interaction.output_text or "").strip()
            if not answer:
                raise HTTPException(status_code=502, detail="Gemini devolvió una respuesta vacía.")
            return ChatResponse(answer=answer, tools_used=tools_used)
        if (
            tool_round == MAX_TOOL_ROUNDS
            or len(tools_used) + len(function_calls) > MAX_TOOL_CALLS
        ):
            raise HTTPException(
                status_code=502,
                detail="Se alcanzó el límite de consultas en una sola respuesta.",
            )

        interaction_history.extend(
            step.model_dump(exclude_none=True) for step in steps
        )
        for call in function_calls:
            if call.name != "consultar_datos_negocio":
                raise HTTPException(status_code=502, detail="Gemini solicitó una tool no permitida.")
            arguments = call.arguments if isinstance(call.arguments, dict) else {}
            result = _run_tool(
                call.name, arguments, request.negocio_id, access_token,
            )
            consulta = arguments.get("consulta")
            if consulta in TOOL_HANDLERS:
                tools_used.append(consulta)
            interaction_history.append({
                "type": "function_result",
                "name": call.name,
                "call_id": call.id,
                "result": [{
                    "type": "text",
                    "text": json.dumps(result, ensure_ascii=False, default=str),
                }],
            })

    raise HTTPException(
        status_code=502,
        detail="Se alcanzó el límite de consultas en una sola respuesta.",
    )