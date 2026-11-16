# Imagen estática de la web: build de Vite + Caddy como servidor y proxy.
# El contexto de build es la raíz del repositorio (ver compose.demo.yaml).
FROM node:22-alpine AS build

WORKDIR /app

# Dependencias fijadas por el lockfile del proyecto.
COPY frontend-web/package.json frontend-web/package-lock.json ./
RUN npm ci

COPY frontend-web/ ./

# Variables públicas de build. Vite las incrusta en el bundle.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

RUN npm run build

FROM caddy:2-alpine

COPY --from=build /app/dist /srv/web
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443 8080
