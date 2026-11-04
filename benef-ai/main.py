"""Microservicio de inteligencia artificial de Benefy (Benef AI)."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Cargar variables de entorno desde benef-ai/.env (si existe).
load_dotenv(Path(__file__).resolve().parent / ".env")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

app = FastAPI(
    title="Benef AI",
    description="Microservicio de inteligencia artificial de Benefy.",
    version="0.1.0",
)


@app.get("/")
def health_check() -> dict:
    """Endpoint de verificación de estado del servicio."""
    return {
        "service": "benef-ai",
        "status": "ok",
        "environment": ENVIRONMENT,
        "version": app.version,
    }
