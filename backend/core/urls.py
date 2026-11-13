from django.urls import path

from core import views

app_name = "core"

urlpatterns = [
    path("v1/autenticacion/perfil/", views.PerfilAPIView.as_view(), name="autenticacion-perfil"),
    path("v1/usuario/rol/<int:pk>/", views.UsuarioRolAPIView.as_view(), name="usuario-rol"),
    # Usuario URLs
    path("v1/usuario/crear/", views.UsuarioCreateAPIView.as_view(), name="usuario-crear"),
    path("v1/usuarios/listar/", views.UsuarioListAPIView.as_view(), name="usuarios-listar"),
    path("v1/usuario/detalle/<int:pk>/", views.UsuarioDetailAPIView.as_view(), name="usuario-detalle"),
    path("v1/usuario/actualizar/<int:pk>/", views.UsuarioUpdateAPIView.as_view(), name="usuario-actualizar"),
    path("v1/usuario/eliminar/<int:pk>/", views.UsuarioDeleteAPIView.as_view(), name="usuario-eliminar"),

    # CategoriaNegocio URLs
    path("v1/categoria-negocio/crear/", views.CategoriaNegocioCreateAPIView.as_view(), name="categoria-negocio-crear"),
    path("v1/categorias-negocio/listar/", views.CategoriaNegocioListAPIView.as_view(), name="categorias-negocio-listar"),
    path("v1/categoria-negocio/detalle/<int:pk>/", views.CategoriaNegocioDetailAPIView.as_view(), name="categoria-negocio-detalle"),
    path("v1/categoria-negocio/actualizar/<int:pk>/", views.CategoriaNegocioUpdateAPIView.as_view(), name="categoria-negocio-actualizar"),
    path("v1/categoria-negocio/eliminar/<int:pk>/", views.CategoriaNegocioDeleteAPIView.as_view(), name="categoria-negocio-eliminar"),

    # Negocio URLs
    path("v1/negocio/crear/", views.NegocioCreateAPIView.as_view(), name="negocio-crear"),
    path("v1/negocios/listar/", views.NegocioListAPIView.as_view(), name="negocios-listar"),
    path("v1/negocio/detalle/<int:pk>/", views.NegocioDetailAPIView.as_view(), name="negocio-detalle"),
    path("v1/negocio/actualizar/<int:pk>/", views.NegocioUpdateAPIView.as_view(), name="negocio-actualizar"),
    path("v1/negocio/eliminar/<int:pk>/", views.NegocioDeleteAPIView.as_view(), name="negocio-eliminar"),

    # Sucursal URLs
    path("v1/sucursal/crear/", views.SucursalCreateAPIView.as_view(), name="sucursal-crear"),
    path("v1/sucursales/listar/", views.SucursalListAPIView.as_view(), name="sucursales-listar"),
    path("v1/sucursal/detalle/<int:pk>/", views.SucursalDetailAPIView.as_view(), name="sucursal-detalle"),
    path("v1/sucursal/actualizar/<int:pk>/", views.SucursalUpdateAPIView.as_view(), name="sucursal-actualizar"),
    path("v1/sucursal/eliminar/<int:pk>/", views.SucursalDeleteAPIView.as_view(), name="sucursal-eliminar"),

    # UsuarioNegocio URLs
    path("v1/usuario-negocio/crear/", views.UsuarioNegocioCreateAPIView.as_view(), name="usuario-negocio-crear"),
    path("v1/usuarios-negocio/listar/", views.UsuarioNegocioListAPIView.as_view(), name="usuarios-negocio-listar"),
    path("v1/usuario-negocio/detalle/<int:pk>/", views.UsuarioNegocioDetailAPIView.as_view(), name="usuario-negocio-detalle"),
    path("v1/usuario-negocio/actualizar/<int:pk>/", views.UsuarioNegocioUpdateAPIView.as_view(), name="usuario-negocio-actualizar"),
    path("v1/usuario-negocio/eliminar/<int:pk>/", views.UsuarioNegocioDeleteAPIView.as_view(), name="usuario-negocio-eliminar"),

    # Dinamica URLs
    path("v1/dinamica/crear/", views.DinamicaCreateAPIView.as_view(), name="dinamica-crear"),
    path("v1/dinamicas/listar/", views.DinamicaListAPIView.as_view(), name="dinamicas-listar"),
    path("v1/dinamica/detalle/<int:pk>/", views.DinamicaDetailAPIView.as_view(), name="dinamica-detalle"),
    path("v1/dinamica/actualizar/<int:pk>/", views.DinamicaUpdateAPIView.as_view(), name="dinamica-actualizar"),
    path("v1/dinamica/eliminar/<int:pk>/", views.DinamicaDeleteAPIView.as_view(), name="dinamica-eliminar"),

    # Alianza URLs
    path("v1/alianza/crear/", views.AlianzaCreateAPIView.as_view(), name="alianza-crear"),
    path("v1/alianzas/listar/", views.AlianzaListAPIView.as_view(), name="alianzas-listar"),
    path("v1/alianza/detalle/<int:pk>/", views.AlianzaDetailAPIView.as_view(), name="alianza-detalle"),
    path("v1/alianza/actualizar/<int:pk>/", views.AlianzaUpdateAPIView.as_view(), name="alianza-actualizar"),
    path("v1/alianza/eliminar/<int:pk>/", views.AlianzaDeleteAPIView.as_view(), name="alianza-eliminar"),

    # Recompensa URLs
    path("v1/recompensa/crear/", views.RecompensaCreateAPIView.as_view(), name="recompensa-crear"),
    path("v1/recompensas/listar/", views.RecompensaListAPIView.as_view(), name="recompensas-listar"),
    path("v1/recompensa/detalle/<int:pk>/", views.RecompensaDetailAPIView.as_view(), name="recompensa-detalle"),
    path("v1/recompensa/actualizar/<int:pk>/", views.RecompensaUpdateAPIView.as_view(), name="recompensa-actualizar"),
    path("v1/recompensa/eliminar/<int:pk>/", views.RecompensaDeleteAPIView.as_view(), name="recompensa-eliminar"),

    # RegistroActividad URLs
    path("v1/registro-actividad/crear/", views.RegistroActividadCreateAPIView.as_view(), name="registro-actividad-crear"),
    path("v1/registros-actividad/listar/", views.RegistroActividadListAPIView.as_view(), name="registros-actividad-listar"),
    path("v1/registro-actividad/detalle/<int:pk>/", views.RegistroActividadDetailAPIView.as_view(), name="registro-actividad-detalle"),
    path("v1/registro-actividad/actualizar/<int:pk>/", views.RegistroActividadUpdateAPIView.as_view(), name="registro-actividad-actualizar"),
    path("v1/registro-actividad/eliminar/<int:pk>/", views.RegistroActividadDeleteAPIView.as_view(), name="registro-actividad-eliminar"),

    # ProgresoUsuario URLs
    path("v1/progreso-usuario/crear/", views.ProgresoUsuarioCreateAPIView.as_view(), name="progreso-usuario-crear"),
    path("v1/progresos-usuario/listar/", views.ProgresoUsuarioListAPIView.as_view(), name="progresos-usuario-listar"),
    path("v1/progreso-usuario/detalle/<int:pk>/", views.ProgresoUsuarioDetailAPIView.as_view(), name="progreso-usuario-detalle"),
    path("v1/progreso-usuario/actualizar/<int:pk>/", views.ProgresoUsuarioUpdateAPIView.as_view(), name="progreso-usuario-actualizar"),
    path("v1/progreso-usuario/eliminar/<int:pk>/", views.ProgresoUsuarioDeleteAPIView.as_view(), name="progreso-usuario-eliminar"),

    # CuponUsuario URLs
    path("v1/cupon-usuario/crear/", views.CuponUsuarioCreateAPIView.as_view(), name="cupon-usuario-crear"),
    path("v1/cupones-usuario/listar/", views.CuponUsuarioListAPIView.as_view(), name="cupones-usuario-listar"),
    path("v1/cupon-usuario/detalle/<int:pk>/", views.CuponUsuarioDetailAPIView.as_view(), name="cupon-usuario-detalle"),
    path("v1/cupon-usuario/actualizar/<int:pk>/", views.CuponUsuarioUpdateAPIView.as_view(), name="cupon-usuario-actualizar"),
    path("v1/cupon-usuario/eliminar/<int:pk>/", views.CuponUsuarioDeleteAPIView.as_view(), name="cupon-usuario-eliminar"),

    # Canje URLs
    path("v1/canje/crear/", views.CanjeCreateAPIView.as_view(), name="canje-crear"),
    path("v1/canjes/listar/", views.CanjeListAPIView.as_view(), name="canjes-listar"),
    path("v1/canje/detalle/<int:pk>/", views.CanjeDetailAPIView.as_view(), name="canje-detalle"),
    path("v1/canje/actualizar/<int:pk>/", views.CanjeUpdateAPIView.as_view(), name="canje-actualizar"),
    path("v1/canje/eliminar/<int:pk>/", views.CanjeDeleteAPIView.as_view(), name="canje-eliminar"),

    # PlanSuscripcion URLs
    path("v1/plan-suscripcion/crear/", views.PlanSuscripcionCreateAPIView.as_view(), name="plan-suscripcion-crear"),
    path("v1/planes-suscripcion/listar/", views.PlanSuscripcionListAPIView.as_view(), name="planes-suscripcion-listar"),
    path("v1/plan-suscripcion/detalle/<int:pk>/", views.PlanSuscripcionDetailAPIView.as_view(), name="plan-suscripcion-detalle"),
    path("v1/plan-suscripcion/actualizar/<int:pk>/", views.PlanSuscripcionUpdateAPIView.as_view(), name="plan-suscripcion-actualizar"),
    path("v1/plan-suscripcion/eliminar/<int:pk>/", views.PlanSuscripcionDeleteAPIView.as_view(), name="plan-suscripcion-eliminar"),

    # Suscripcion URLs
    path("v1/suscripcion/crear/", views.SuscripcionCreateAPIView.as_view(), name="suscripcion-crear"),
    path("v1/suscripciones/listar/", views.SuscripcionListAPIView.as_view(), name="suscripciones-listar"),
    path("v1/suscripcion/detalle/<int:pk>/", views.SuscripcionDetailAPIView.as_view(), name="suscripcion-detalle"),
    path("v1/suscripcion/actualizar/<int:pk>/", views.SuscripcionUpdateAPIView.as_view(), name="suscripcion-actualizar"),
    path("v1/suscripcion/eliminar/<int:pk>/", views.SuscripcionDeleteAPIView.as_view(), name="suscripcion-eliminar"),

    # Pago URLs
    path("v1/pago/crear/", views.PagoCreateAPIView.as_view(), name="pago-crear"),
    path("v1/pagos/listar/", views.PagoListAPIView.as_view(), name="pagos-listar"),
    path("v1/pago/detalle/<int:pk>/", views.PagoDetailAPIView.as_view(), name="pago-detalle"),
    path("v1/pago/actualizar/<int:pk>/", views.PagoUpdateAPIView.as_view(), name="pago-actualizar"),
    path("v1/pago/eliminar/<int:pk>/", views.PagoDeleteAPIView.as_view(), name="pago-eliminar"),

    # Notificacion URLs
    path("v1/notificacion/crear/", views.NotificacionCreateAPIView.as_view(), name="notificacion-crear"),
    path("v1/notificaciones/listar/", views.NotificacionListAPIView.as_view(), name="notificaciones-listar"),
    path("v1/notificacion/detalle/<int:pk>/", views.NotificacionDetailAPIView.as_view(), name="notificacion-detalle"),
    path("v1/notificacion/actualizar/<int:pk>/", views.NotificacionUpdateAPIView.as_view(), name="notificacion-actualizar"),
    path("v1/notificacion/eliminar/<int:pk>/", views.NotificacionDeleteAPIView.as_view(), name="notificacion-eliminar"),
]
