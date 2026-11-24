"""Autenticación interna HMAC entre Django y Benef AI."""

import hashlib
import hmac
import os
import time

from fastapi import HTTPException, Request

MAX_CLOCK_SKEW_SECONDS = 300
MIN_TOKEN_LENGTH = 32


def service_token():
    return os.getenv("BENEF_AI_SERVICE_TOKEN", "").strip()


def firmar(timestamp, body, secret=None):
    secret = secret or service_token()
    message = f"{timestamp}.".encode("utf-8") + body
    return hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def validar_firma(timestamp, signature, body, now=None):
    secret = service_token()
    if len(secret) < MIN_TOKEN_LENGTH:
        raise HTTPException(
            status_code=503,
            detail="La autenticación interna de Benef AI no está configurada.",
        )
    try:
        timestamp_int = int(timestamp or "")
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Solicitud interna no autorizada.",
        ) from None
    now = int(time.time()) if now is None else int(now)
    if abs(now - timestamp_int) > MAX_CLOCK_SKEW_SECONDS:
        raise HTTPException(
            status_code=401,
            detail="Solicitud interna expirada.",
        )
    if not signature or not hmac.compare_digest(
        signature,
        firmar(timestamp_int, body, secret),
    ):
        raise HTTPException(
            status_code=401,
            detail="Solicitud interna no autorizada.",
        )


async def verify_service_request(request: Request) -> None:
    body = await request.body()
    validar_firma(
        request.headers.get("X-Benef-Timestamp"),
        request.headers.get("X-Benef-Signature"),
        body,
    )
