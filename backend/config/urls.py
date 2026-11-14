"""Rutas principales del backend de Benefy."""

from django.contrib import admin
from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    """Endpoint de verificación de estado del backend."""
    return JsonResponse({"service": "backend", "status": "ok"})


def health_check_db(request):
    """Verifica que Django responde y que PostgreSQL acepta una consulta."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse(
            {"service": "backend", "status": "error", "database": "unavailable"},
            status=503,
        )

    return JsonResponse(
        {"service": "backend", "status": "ok", "database": "ok"},
    )


urlpatterns = [
    path("", health_check, name="health-check"),
    path("health/db/", health_check_db, name="health-check-db"),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
