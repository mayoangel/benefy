"""Microservicio de inteligencia artificial de Benefy (Benef AI)."""

import logging
import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from chat import router as chat_router
from queries import router as queries_router

if os.getenv("BENEFY_LOAD_DOTENV", "1") != "0":
    load_dotenv(Path(__file__).resolve().parent / ".env")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "").rstrip("/")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "BENEF_AI_ALLOWED_ORIGINS", "http://localhost:5173",
    ).split(",")
    if origin.strip()
]

logger = logging.getLogger("benef-ai")


def _validar_backend_url(url):
    parsed = urlsplit(url)
    if (
        not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or not parsed.path.rstrip("/").endswith("/api/v1")
    ):
        raise RuntimeError(
            "BACKEND_API_URL debe apuntar a la API de Django y terminar en /api/v1."
        )
    privada = parsed.hostname in ("localhost", "127.0.0.1") or parsed.hostname.endswith(
        ".railway.internal",
    )
    if parsed.scheme != "https" and not (parsed.scheme == "http" and privada):
        raise RuntimeError(
            "BACKEND_API_URL debe usar HTTPS o la red privada de Railway."
        )


if ENVIRONMENT == "production":
    if not BACKEND_API_URL:
        raise RuntimeError("Producción requiere BACKEND_API_URL.")
    _validar_backend_url(BACKEND_API_URL)
    if not ALLOWED_ORIGINS:
        raise RuntimeError("Producción requiere BENEF_AI_ALLOWED_ORIGINS.")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="Benef AI",
    description="Microservicio de inteligencia artificial de Benefy.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(queries_router)
app.include_router(chat_router)


def _liveness():
    return {
        "service": "benef-ai",
        "status": "ok",
        "environment": ENVIRONMENT,
        "version": app.version,
    }


@app.get("/")
def health_check() -> dict:
    """Alias de liveness; no consulta Django ni Gemini."""
    return _liveness()


@app.get("/health/live")
@app.get("/health/live/")
def health_live() -> dict:
    """Liveness para Railway; no consulta dependencias externas."""
    return _liveness()


@app.get("/health/ready")
@app.get("/health/ready/")
def health_ready():
    """Readiness de configuración; no realiza llamadas externas."""
    backend_configurado = bool(BACKEND_API_URL)
    gemini_configurado = bool(os.getenv("GEMINI_API_KEY", "").strip())
    cuerpo = {
        "service": "benef-ai",
        "status": "ok" if backend_configurado else "error",
        "backend_configurado": backend_configurado,
        "gemini_configurado": gemini_configurado,
    }
    if not backend_configurado:
        return JSONResponse(status_code=503, content=cuerpo)
    return cuerpo
