"""Rutas principales del backend de Benefy."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def health_check(request):
    """Endpoint de verificación de estado del backend."""
    return JsonResponse({"service": "backend", "status": "ok"})


urlpatterns = [
    path("", health_check, name="health-check"),
    path("admin/", admin.site.urls),
]
