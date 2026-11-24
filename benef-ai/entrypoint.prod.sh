#!/bin/sh
set -eu

exec uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-5000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout-keep-alive "${KEEPALIVE_TIMEOUT:-5}" \
  --proxy-headers \
  --forwarded-allow-ips "*"
