# Imagen base del backend de Benefy (Django + Django REST Framework)
FROM python:3.11-slim

# Evitar que Python escriba archivos .pyc y forzar salida sin buffer (logs en tiempo real)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias primero para aprovechar la caché de capas de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

EXPOSE 8000

# Servidor de desarrollo de Django accesible desde fuera del contenedor
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
