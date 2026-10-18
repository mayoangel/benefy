# Benef AI

Esta carpeta contiene los componentes de inteligencia artificial de Benefy,
incluidos los asistentes y servicios de apoyo al producto.

## Responsabilidades previstas

- Definir los servicios de IA y sus límites de integración.
- Proveer capacidades para asistentes asociados a Benefy.
- Mantener separadas las credenciales, configuraciones y modelos del resto de
  los servicios.

## Estado actual

El microservicio está inicializado con FastAPI: `main.py` expone `GET /` con
un JSON de verificación de estado. Las dependencias base (FastAPI, Uvicorn,
python-dotenv y requests) están declaradas en `requirements.txt`.

## Cómo ejecutar

Con Docker (recomendado, desde la raíz del repositorio):

```bash
docker compose up --build benef-ai
```

En local:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

## Configuración

`main.py` carga `benef-ai/.env` (generado a partir de `.env.example`) con
python-dotenv. Las claves de los proveedores de LLM y la URL interna del
backend se configuran allí sin incluir secretos reales en el repositorio.
