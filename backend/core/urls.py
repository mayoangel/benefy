from django.urls import path

from core import views

app_name = "core"

urlpatterns = [
    # Usuario URLs
    path("v1/usuario/create/", views.UsuarioCreateAPIView.as_view(), name="usuario-create"),
    path("v1/usuarios/list/", views.UsuarioListAPIView.as_view(), name="usuarios-list"),
    path("v1/usuario/detail/<int:pk>/", views.UsuarioDetailAPIView.as_view(), name="usuario-detail"),
    path("v1/usuario/update/<int:pk>/", views.UsuarioUpdateAPIView.as_view(), name="usuario-update"),
    path("v1/usuario/delete/<int:pk>/", views.UsuarioDeleteAPIView.as_view(), name="usuario-delete"),

    # CategoriaNegocio URLs
    path("v1/categoria-negocio/create/", views.CategoriaNegocioCreateAPIView.as_view(), name="categoria-negocio-create"),
    path("v1/categorias-negocio/list/", views.CategoriaNegocioListAPIView.as_view(), name="categorias-negocio-list"),
    path("v1/categoria-negocio/detail/<int:pk>/", views.CategoriaNegocioDetailAPIView.as_view(), name="categoria-negocio-detail"),
    path("v1/categoria-negocio/update/<int:pk>/", views.CategoriaNegocioUpdateAPIView.as_view(), name="categoria-negocio-update"),
    path("v1/categoria-negocio/delete/<int:pk>/", views.CategoriaNegocioDeleteAPIView.as_view(), name="categoria-negocio-delete"),

    # Negocio URLs
    path("v1/negocio/create/", views.NegocioCreateAPIView.as_view(), name="negocio-create"),
    path("v1/negocios/list/", views.NegocioListAPIView.as_view(), name="negocios-list"),
    path("v1/negocio/detail/<int:pk>/", views.NegocioDetailAPIView.as_view(), name="negocio-detail"),
    path("v1/negocio/update/<int:pk>/", views.NegocioUpdateAPIView.as_view(), name="negocio-update"),
    path("v1/negocio/delete/<int:pk>/", views.NegocioDeleteAPIView.as_view(), name="negocio-delete"),

    # Sucursal URLs
    path("v1/sucursal/create/", views.SucursalCreateAPIView.as_view(), name="sucursal-create"),
    path("v1/sucursales/list/", views.SucursalListAPIView.as_view(), name="sucursales-list"),
    path("v1/sucursal/detail/<int:pk>/", views.SucursalDetailAPIView.as_view(), name="sucursal-detail"),
    path("v1/sucursal/update/<int:pk>/", views.SucursalUpdateAPIView.as_view(), name="sucursal-update"),
    path("v1/sucursal/delete/<int:pk>/", views.SucursalDeleteAPIView.as_view(), name="sucursal-delete"),

    # UsuarioNegocio URLs
    path("v1/usuario-negocio/create/", views.UsuarioNegocioCreateAPIView.as_view(), name="usuario-negocio-create"),
    path("v1/usuarios-negocio/list/", views.UsuarioNegocioListAPIView.as_view(), name="usuarios-negocio-list"),
    path("v1/usuario-negocio/detail/<int:pk>/", views.UsuarioNegocioDetailAPIView.as_view(), name="usuario-negocio-detail"),
    path("v1/usuario-negocio/update/<int:pk>/", views.UsuarioNegocioUpdateAPIView.as_view(), name="usuario-negocio-update"),
    path("v1/usuario-negocio/delete/<int:pk>/", views.UsuarioNegocioDeleteAPIView.as_view(), name="usuario-negocio-delete"),

    # Dinamica URLs
    path("v1/dinamica/create/", views.DinamicaCreateAPIView.as_view(), name="dinamica-create"),
    path("v1/dinamicas/list/", views.DinamicaListAPIView.as_view(), name="dinamicas-list"),
    path("v1/dinamica/detail/<int:pk>/", views.DinamicaDetailAPIView.as_view(), name="dinamica-detail"),
    path("v1/dinamica/update/<int:pk>/", views.DinamicaUpdateAPIView.as_view(), name="dinamica-update"),
    path("v1/dinamica/delete/<int:pk>/", views.DinamicaDeleteAPIView.as_view(), name="dinamica-delete"),

    # Alianza URLs
    path("v1/alianza/create/", views.AlianzaCreateAPIView.as_view(), name="alianza-create"),
    path("v1/alianzas/list/", views.AlianzaListAPIView.as_view(), name="alianzas-list"),
    path("v1/alianza/detail/<int:pk>/", views.AlianzaDetailAPIView.as_view(), name="alianza-detail"),
    path("v1/alianza/update/<int:pk>/", views.AlianzaUpdateAPIView.as_view(), name="alianza-update"),
    path("v1/alianza/delete/<int:pk>/", views.AlianzaDeleteAPIView.as_view(), name="alianza-delete"),

    # Recompensa URLs
    path("v1/recompensa/create/", views.RecompensaCreateAPIView.as_view(), name="recompensa-create"),
    path("v1/recompensas/list/", views.RecompensaListAPIView.as_view(), name="recompensas-list"),
    path("v1/recompensa/detail/<int:pk>/", views.RecompensaDetailAPIView.as_view(), name="recompensa-detail"),
    path("v1/recompensa/update/<int:pk>/", views.RecompensaUpdateAPIView.as_view(), name="recompensa-update"),
    path("v1/recompensa/delete/<int:pk>/", views.RecompensaDeleteAPIView.as_view(), name="recompensa-delete"),

    # RegistroActividad URLs
    path("v1/registro-actividad/create/", views.RegistroActividadCreateAPIView.as_view(), name="registro-actividad-create"),
    path("v1/registros-actividad/list/", views.RegistroActividadListAPIView.as_view(), name="registros-actividad-list"),
    path("v1/registro-actividad/detail/<int:pk>/", views.RegistroActividadDetailAPIView.as_view(), name="registro-actividad-detail"),
    path("v1/registro-actividad/update/<int:pk>/", views.RegistroActividadUpdateAPIView.as_view(), name="registro-actividad-update"),
    path("v1/registro-actividad/delete/<int:pk>/", views.RegistroActividadDeleteAPIView.as_view(), name="registro-actividad-delete"),

    # ProgresoUsuario URLs
    path("v1/progreso-usuario/create/", views.ProgresoUsuarioCreateAPIView.as_view(), name="progreso-usuario-create"),
    path("v1/progresos-usuario/list/", views.ProgresoUsuarioListAPIView.as_view(), name="progresos-usuario-list"),
    path("v1/progreso-usuario/detail/<int:pk>/", views.ProgresoUsuarioDetailAPIView.as_view(), name="progreso-usuario-detail"),
    path("v1/progreso-usuario/update/<int:pk>/", views.ProgresoUsuarioUpdateAPIView.as_view(), name="progreso-usuario-update"),
    path("v1/progreso-usuario/delete/<int:pk>/", views.ProgresoUsuarioDeleteAPIView.as_view(), name="progreso-usuario-delete"),

    # CuponUsuario URLs
    path("v1/cupon-usuario/create/", views.CuponUsuarioCreateAPIView.as_view(), name="cupon-usuario-create"),
    path("v1/cupones-usuario/list/", views.CuponUsuarioListAPIView.as_view(), name="cupones-usuario-list"),
    path("v1/cupon-usuario/detail/<int:pk>/", views.CuponUsuarioDetailAPIView.as_view(), name="cupon-usuario-detail"),
    path("v1/cupon-usuario/update/<int:pk>/", views.CuponUsuarioUpdateAPIView.as_view(), name="cupon-usuario-update"),
    path("v1/cupon-usuario/delete/<int:pk>/", views.CuponUsuarioDeleteAPIView.as_view(), name="cupon-usuario-delete"),

    # Canje URLs
    path("v1/canje/create/", views.CanjeCreateAPIView.as_view(), name="canje-create"),
    path("v1/canjes/list/", views.CanjeListAPIView.as_view(), name="canjes-list"),
    path("v1/canje/detail/<int:pk>/", views.CanjeDetailAPIView.as_view(), name="canje-detail"),
    path("v1/canje/update/<int:pk>/", views.CanjeUpdateAPIView.as_view(), name="canje-update"),
    path("v1/canje/delete/<int:pk>/", views.CanjeDeleteAPIView.as_view(), name="canje-delete"),

    # PlanSuscripcion URLs
    path("v1/plan-suscripcion/create/", views.PlanSuscripcionCreateAPIView.as_view(), name="plan-suscripcion-create"),
    path("v1/planes-suscripcion/list/", views.PlanSuscripcionListAPIView.as_view(), name="planes-suscripcion-list"),
    path("v1/plan-suscripcion/detail/<int:pk>/", views.PlanSuscripcionDetailAPIView.as_view(), name="plan-suscripcion-detail"),
    path("v1/plan-suscripcion/update/<int:pk>/", views.PlanSuscripcionUpdateAPIView.as_view(), name="plan-suscripcion-update"),
    path("v1/plan-suscripcion/delete/<int:pk>/", views.PlanSuscripcionDeleteAPIView.as_view(), name="plan-suscripcion-delete"),

    # Suscripcion URLs
    path("v1/suscripcion/create/", views.SuscripcionCreateAPIView.as_view(), name="suscripcion-create"),
    path("v1/suscripciones/list/", views.SuscripcionListAPIView.as_view(), name="suscripciones-list"),
    path("v1/suscripcion/detail/<int:pk>/", views.SuscripcionDetailAPIView.as_view(), name="suscripcion-detail"),
    path("v1/suscripcion/update/<int:pk>/", views.SuscripcionUpdateAPIView.as_view(), name="suscripcion-update"),
    path("v1/suscripcion/delete/<int:pk>/", views.SuscripcionDeleteAPIView.as_view(), name="suscripcion-delete"),

    # Pago URLs
    path("v1/pago/create/", views.PagoCreateAPIView.as_view(), name="pago-create"),
    path("v1/pagos/list/", views.PagoListAPIView.as_view(), name="pagos-list"),
    path("v1/pago/detail/<int:pk>/", views.PagoDetailAPIView.as_view(), name="pago-detail"),
    path("v1/pago/update/<int:pk>/", views.PagoUpdateAPIView.as_view(), name="pago-update"),
    path("v1/pago/delete/<int:pk>/", views.PagoDeleteAPIView.as_view(), name="pago-delete"),

    # Notificacion URLs
    path("v1/notificacion/create/", views.NotificacionCreateAPIView.as_view(), name="notificacion-create"),
    path("v1/notificaciones/list/", views.NotificacionListAPIView.as_view(), name="notificaciones-list"),
    path("v1/notificacion/detail/<int:pk>/", views.NotificacionDetailAPIView.as_view(), name="notificacion-detail"),
    path("v1/notificacion/update/<int:pk>/", views.NotificacionUpdateAPIView.as_view(), name="notificacion-update"),
    path("v1/notificacion/delete/<int:pk>/", views.NotificacionDeleteAPIView.as_view(), name="notificacion-delete"),
]