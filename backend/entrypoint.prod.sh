#!/bin/sh
set -eu

# Los estáticos se generan en el arranque con las variables del entorno de
# producción. Las migraciones se ejecutan en un paso de release controlado,
# nunca automáticamente en cada réplica.
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-60}" \
  --access-logfile - \
  --error-logfile -
