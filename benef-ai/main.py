"""Microservicio de inteligencia artificial de Benefy (Benef AI)."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chat import router as chat_router
from queries import router as queries_router

# Cargar variables de entorno desde benef-ai/.env (si existe).
if os.getenv("BENEFY_LOAD_DOTENV", "1") != "0":
    load_dotenv(Path(__file__).resolve().parent / ".env")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "BENEF_AI_ALLOWED_ORIGINS", "http://localhost:5173",
    ).split(",")
    if origin.strip()
]

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


@app.get("/")
def health_check() -> dict:
    """Endpoint de verificación de estado del servicio."""
    return {
        "service": "benef-ai",
        "status": "ok",
        "environment": ENVIRONMENT,
        "version": app.version,
    }
