"""Settings del entorno unificado, restringido al equipo local."""
from .settings import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'backend', 'testserver']
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
USE_X_FORWARDED_HOST = False
SECURE_PROXY_SSL_HEADER = None
