# Un negocio activo por propietario

## Regla

Una cuenta puede ser propietaria de un solo negocio activo. Puede conservar
membresías de empleado o supervisor en otros negocios y un negocio puede tener
más de un propietario.

La regla se aplica en:

- alta directa de negocio (`/api/v1/negocio/crear/`);
- alta y reactivación de membresías;
- cambios de rol o de usuario en una membresía;
- invitaciones con rol de propietario y su aceptación;
- finalización del registro comercial.

La base de datos tiene una restricción parcial como última barrera:

```text
UniqueConstraint(usuario, condition=rol_comercio='dueno' AND sucursal IS NULL AND status)
```

## Auditoría de solo lectura

```bash
python manage.py auditar_propietarios --correo business@benefy.com
```

Sin `--correo` lista todas las cuentas que hoy incumplen la regla. Para cada
negocio muestra identificador, nombre, categoría, sucursales, propietarios,
conteos de historial, suscripciones, pagos y alianzas. No escribe datos.

## Respaldo antes de corregir

```bash
python dev.py backup
```

Conserva el archivo `.dump` y su recibo `.json`. Verifica que el recibo indique
`archive_verified: true` y el destino correcto. No apliques cambios remotos sin
un respaldo verificado de la misma ventana.

## Corrección reproducible

El comando no elimina ni fusiona negocios. Exige decidir qué negocio se conserva
y qué ocurre con cada negocio adicional. Primero se ejecuta en modo seguro:

```bash
python manage.py corregir_propietario_unico \
  --correo business@benefy.com \
  --conservar 7 \
  --transferir 5:123 \
  --desactivar 8
```

Y solo después de revisar el plan:

```bash
python manage.py corregir_propietario_unico \
  --correo business@benefy.com \
  --conservar 7 \
  --transferir 5:123 \
  --desactivar 8 \
  --confirmar-correo business@benefy.com \
  --apply
```

- `--conservar`: negocio que permanece con la cuenta.
- `--transferir negocio_id:usuario_id`: cambia el propietario. El destino debe
  existir, estar activo y no tener otro negocio activo.
- `--desactivar negocio_id`: desactiva el negocio y la membresía del propietario,
  conservando todo su historial.
- Cada negocio adicional debe aparecer exactamente en una de las dos opciones.
- La operación es atómica y vuelve a comprobar que quede un solo negocio activo.

## Cuentas nuevas para una transferencia

Si el destino autorizado aún no existe, crea una cuenta verificada con:

```bash
python manage.py crear_cuentas_propietarios \
  --cuenta aurora@benefy.com:Renata:Flores \
  --apply --allow-remote \
  --expected-target <huella> \
  --backup-receipt /backups/<respaldo>.json
```

Requiere `SUPABASE_SECRET_KEY`, crea el usuario confirmado en Supabase Auth y su
perfil Django, y muestra las credenciales una sola vez. No crea ni modifica
negocios; después usa `corregir_propietario_unico` para transferir la propiedad.

## Verificación

```bash
python manage.py auditar_propietarios
python manage.py showmigrations core
python manage.py migrate --plan
```

Comprueba además:

- el negocio conservado mantiene sus sucursales, clientes, visitas, cupones,
  canjes, suscripciones y pagos;
- los negocios desactivados conservan su historial y ya no aparecen como
  propiedad activa;
- una transferencia dejó al nuevo propietario con acceso al negocio y sin otro
  negocio activo;
- el arranque y los endpoints de salud responden correctamente.

## Migración

La migración `0023_propietario_unico_negocio` ejecuta una comprobación previa y
falla con el inventario de cuentas pendientes antes de crear la restricción. Si
falla, no se crea la restricción y se debe corregir la lista indicada. Después se
puede reintentar la migración.

No edites la migración ya aplicada ni borres `django_migrations`. Si la
verificación posterior falla, restaura el respaldo verificado en una ventana
controlada.
