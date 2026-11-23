from django.contrib import admin

from core import models


# El registro explícito permite inspeccionar los datos del MVP sin alterar
# el comportamiento de la API.
admin.site.register(
    [
        models.Usuario,
        models.CategoriaNegocio,
        models.Negocio,
        models.Sucursal,
        models.UsuarioNegocio,
        models.AuditoriaMembresia,
        models.RegistroComercial,
        models.InvitacionMembresia,
        models.Dinamica,
        models.Alianza,
        models.EventoAlianza,
        models.Recompensa,
        models.RegistroActividad,
        models.ProgresoUsuario,
        models.CuponUsuario,
        models.Canje,
        models.SaldoPuntos,
        models.LotePuntos,
        models.MovimientoPuntos,
        models.CicloTarjeta,
        models.PlanSuscripcion,
        models.PlanPrecio,
        models.Suscripcion,
        models.PlanCambioAuditoria,
        models.Pago,
        models.Notificacion,
    ]
)
