#!/bin/sh
# Prepara archivos estáticos (Admin incluido) y arranca el proceso recibido.
# Es idempotente y no toca la base de datos: las migraciones son un paso aparte.
set -eu

python manage.py collectstatic --noinput

exec "$@"
