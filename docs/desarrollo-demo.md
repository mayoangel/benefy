# Desarrollo y demostración

La única configuración de servicios es `compose.yaml`. Docker agrupa los
contenedores bajo `benefy` (`benefy-backend-1`, `benefy-web-1` y
`benefy-benef-ai-1`). Las credenciales se configuran en `.env` en la raíz.

## Arranque

Requiere Docker Desktop con Compose v2. El launcher requiere Python 3.11 o
posterior; Node y las dependencias de los servicios se instalan en Docker.

```powershell
python dev.py up
# Alternativa sin launcher:
docker compose up -d --build --wait
```

Web: http://localhost:5173. API: http://localhost:8001. IA:
http://localhost:5001. Los puertos solo se publican en loopback. El código se
monta en solo lectura, Vite usa HMR y los servicios Python recarga automática.
No se ejecutan migraciones ni seeds al arrancar.

```powershell
python dev.py check
docker compose logs --tail 50 backend
python dev.py down
# Alternativa: docker compose down
```

Detener conserva volúmenes. No uses `down -v` para una parada normal.

## Configuración

Para una instalación nueva, copia `.env.example` a `.env` y configura sus
valores. No sobrescribas un archivo existente. `dev.py init --from RUTA` permite
importar explícitamente otro archivo y nunca sobrescribe `.env`.

Usa comillas simples para valores con `$` o `#`: Compose los interpreta
literalmente. No incluyas secretos en Git ni imprimas `docker compose config`
sin `--quiet`. El launcher valida la clave publicable y que Auth y PostgreSQL
correspondan al mismo proyecto; da prioridad al archivo sobre variables antiguas
de la terminal. Para evitar diferencias al ejecutar Compose directamente, no
mantengas variables `DB_*` o `SUPABASE_*` antiguas exportadas en la terminal.

El frontend solo recibe variables públicas seleccionadas. Las claves
administrativas y contraseñas del seed se pasan exclusivamente a su contenedor
temporal. No se cargan archivos `.env` secundarios dentro de los servicios.
Después de cambiar variables ejecuta `up`; `restart` no actualiza el entorno.

## Dataset

```powershell
python dev.py demo-init
python dev.py demo-reset
```

`demo-init` completa el dataset sin duplicados. `demo-reset` reemplaza los datos
ficticios exclusivamente del proyecto autorizado. Ambos verifican el destino y
crean/decodifican un respaldo previo. Consulta [el dataset](./demo-dataset.md).
No se ejecuta ninguno de estos comandos durante el arranque habitual.

## Pruebas

```powershell
python -m unittest discover -s tests -v
python dev.py test-backend --local
node frontend-web/tests/smoke.mjs
python tools/verify_python_reload.py
python tools/verify_showcase.py
```

El perfil `local` del mismo Compose contiene un PostgreSQL aislado sin puerto
publicado. `test-backend` crea y destruye exclusivamente su base `test_*`.
No ejecutes pruebas de Django en el backend conectado al Supabase remoto.
Para probar el seed sin Auth remoto:

```powershell
python dev.py seed --local --offline-profiles
```

Las comprobaciones de recarga añaden un comentario temporal y lo restauran.
Las pruebas reales de roles requieren la configuración local de contraseñas y
deben ejecutarse secuencialmente. Las pruebas frontend ordinarias usan HTTP
simulado y conservan las regresiones de login, permisos y responsive.
