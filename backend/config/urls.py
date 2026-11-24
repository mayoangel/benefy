"""Rutas principales del backend de Benefy."""

from django.conf import settings
from django.contrib import admin
from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.urls import include, path


def health_check(request):
    """Liveness: Django responde sin consultar PostgreSQL."""
    return JsonResponse({"service": "backend", "status": "ok"})


def health_check_db(request):
    """Readiness: verifica que Django responde y PostgreSQL acepta una consulta."""
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
    path("health/live/", health_check, name="health-live"),
    path("health/db/", health_check_db, name="health-check-db"),
    path("health/ready/", health_check_db, name="health-ready"),
    path("api/", include("core.urls")),
]
if settings.ADMIN_ENABLED:
    urlpatterns.append(path("admin/", admin.site.urls))
