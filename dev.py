"""Launcher local de Benefy. No imprime valores de configuración ni borra volúmenes."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / '.env'
CONFIG_KEYS = ('SECRET_KEY', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
               'DB_SSLMODE', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
               'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET_AVATARS',
               'SUPABASE_STORAGE_MAX_BYTES', 'SUPABASE_STORAGE_ALLOWED_TYPES',
               'CANJE_VALIDACION_SEGUNDOS', 'BENEFY_DB_MODE', 'LOCAL_DB_PASSWORD',
               'SUPABASE_SEED_ADMIN_KEY', 'BENEFY_SHOWCASE_PASSWORDS',
               'STRIPE_ENABLED', 'STRIPE_MODE', 'STRIPE_SECRET_KEY',
               'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
               'STRIPE_PREMIUM_PRODUCT_ID', 'STRIPE_PREMIUM_PRICE_ID',
               'STRIPE_PREMIUM_ANNUAL_PRICE_ID', 'STRIPE_PORTAL_CONFIGURATION_ID',
               'STRIPE_GRACE_DAYS', 'STRIPE_CHECKOUT_TTL_MINUTES', 'FRONTEND_URL')


def read_env(path):
    result = {}
    for number, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            raise ValueError(f'Línea de entorno no válida: {number}')
        name, value = match.groups()
        value = value.strip()
        if value.startswith('"'):
            try:
                value, end = json.JSONDecoder().raw_decode(value)
            except ValueError:
                raise ValueError(f'Comillas no válidas en {name}') from None
        elif value.startswith("'"):
            end = value.find("'", 1)
            if end < 0:
                raise ValueError(f'Comillas no válidas en {name}')
            value = value[1:end]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].strip()
        if not isinstance(value, str) or '\n' in value or '\r' in value:
            raise ValueError(f'Valor no válido en {name}')
        result[name] = value
    return result


def write_new_env(path, values):
    for name, value in values.items():
        if "'" in value or '\n' in value or '\r' in value:
            raise ValueError(f'Usa un valor de una línea sin comillas simples en {name}.')
    # O_EXCL: ni init ni up pueden sustituir un archivo existente.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
        stream.write('# Configuración local de Benefy; no subir a Git.\n')
        for name, value in values.items():
            stream.write(f"{name}='{value}'\n")


def initialize(source=None):
    if CONFIG.exists():
        return
    source = Path(source) if source else None
    if source is None or not source.is_file():
        raise ValueError('Falta configuración. Crea .env a partir de .env.example o usa init --from ARCHIVO.')
    values = {key: value for key, value in read_env(source).items() if key in CONFIG_KEYS}
    values.setdefault('DB_SSLMODE', 'require')
    values.setdefault('BENEFY_DB_MODE', 'remote')
    values.setdefault('LOCAL_DB_PASSWORD', hashlib.sha256((values.get('SECRET_KEY', '') + ':benefy-local').encode()).hexdigest())
    write_new_env(CONFIG, values)
    print('Creado .env sin modificar el archivo de origen.')


def compose_environment(local=False):
    values = read_env(CONFIG)
    required = ('SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY')
    if not local:
        required += ('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise ValueError('Faltan variables: ' + ', '.join(missing))
    public = values['SUPABASE_PUBLISHABLE_KEY']
    auth_url = urlsplit(values['SUPABASE_URL'])
    if (auth_url.scheme != 'https' or not auth_url.hostname or auth_url.username or auth_url.password
            or auth_url.path not in ('', '/') or auth_url.query or auth_url.fragment):
        raise ValueError('SUPABASE_URL debe ser el origen HTTPS del proyecto, sin credenciales ni parámetros.')
    if not local and values.get('DB_SSLMODE', 'require') not in ('require', 'verify-ca', 'verify-full'):
        raise ValueError('La conexión remota requiere SSL.')
    host = values.get('DB_HOST', '')
    db_project = host.split('.')[1] if host.startswith('db.') and host.endswith('.supabase.co') else (
        values.get('DB_USER', '').split('.', 1)[1] if 'pooler.supabase.com' in host and '.' in values.get('DB_USER', '') else None)
    if not local and db_project and db_project != auth_url.hostname.split('.')[0]:
        raise ValueError('PostgreSQL y Supabase Auth apuntan a proyectos diferentes. No se arranca el entorno.')
    if public.startswith('sb_secret_'):
        raise ValueError('La clave del navegador debe ser publicable, nunca secreta.')
    # También rechazar el formato JWT service_role usado por proyectos antiguos.
    if public.count('.') == 2:
        import base64
        try:
            payload = json.loads(base64.urlsafe_b64decode(public.split('.')[1] + '==='))
        except (ValueError, UnicodeError):
            raise ValueError('Clave pública JWT no válida.') from None
        if not isinstance(payload, dict) or payload.get('role') != 'anon':
            raise ValueError('La clave JWT del navegador debe tener rol anon.')
    result = dict(os.environ)
    # El archivo es autoritativo, sin overrides DB_* accidentales de la terminal.
    for key in CONFIG_KEYS:
        result.pop(key, None)
    result.update({key: value for key, value in values.items() if key in CONFIG_KEYS})
    result.setdefault('LOCAL_DB_PASSWORD', hashlib.sha256((values['SECRET_KEY'] + ':benefy-local').encode()).hexdigest())
    if local:
        result.update(BENEFY_DB_MODE='local', DB_HOST='postgres', DB_PORT='5432',
                      DB_NAME='benefy_devdemo', DB_USER='benefy_local',
                      DB_PASSWORD=result['LOCAL_DB_PASSWORD'], DB_SSLMODE='disable')
    return result


def compose(arguments, env, local=False, capture=False):
    cmd = ['docker', 'compose', '--project-name', 'benefy', '--env-file', os.devnull, '-f', str(ROOT / 'compose.yaml')]
    if local:
        cmd += ['--profile', 'local']
    return subprocess.run(cmd + arguments, cwd=ROOT, env=env, check=True,
                          capture_output=capture, text=True)


def validated_showcase_project(env):
    approved = 'rmwwrgahhuztylqkduya'
    auth = (urlsplit(env.get('SUPABASE_URL', '')).hostname or '').split('.')[0]
    host = env.get('DB_HOST', '')
    user = env.get('DB_USER', '')
    database = host.split('.')[1] if host.startswith('db.') and host.endswith('.supabase.co') else (
        user.split('.', 1)[1] if host.endswith('.pooler.supabase.com') and '.' in user else None)
    if auth != approved or database != approved:
        raise ValueError('El comando de demostración no está autorizado para este proyecto.')
    return approved


def create_backup(run, local=False):
    # pg_dump no modifica datos; el recibo liga contenido y destino al seed.
    target = run(['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'seed_demo', '--target-only'], capture=True).stdout.strip().splitlines()[-1]
    filename = datetime.now(timezone.utc).strftime('benefy-%Y%m%d-%H%M%S-%f.dump')
    run(['run', '--rm', '--no-deps', 'backup', '--format=custom', '--no-owner', '--no-acl',
         '--schema=public'] + ([] if local else ['--schema=auth']) + ['--file=/backups/' + filename])
    path = ROOT / 'backups' / filename
    path.chmod(0o600)
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    archive = '/backups/' + filename
    listing = run(['run', '--rm', '--no-deps', '--entrypoint', 'pg_restore', 'backup', '--list', archive], capture=True).stdout
    required = ['TABLE DATA public core_usuario', 'TABLE DATA public core_negocio'] + ([] if local else ['TABLE DATA auth users'])
    if not all(name in listing for name in required):
        raise ValueError('El respaldo no contiene todas las tablas necesarias.')
    run(['run', '--rm', '--no-deps', '--entrypoint', 'pg_restore', 'backup', '--exit-on-error', '--file=/dev/null', archive], capture=True)
    receipt = {'archive_verified': True, 'target': target, 'sha256': digest, 'file': filename,
               'created_at': datetime.now(timezone.utc).isoformat()}
    receipt_path = path.with_suffix('.json')
    with receipt_path.open('x', encoding='utf-8') as stream:
        json.dump(receipt, stream)
    receipt_path.chmod(0o600)
    print('Respaldo creado en backups; conserva el archivo .dump y su recibo .json.')
    return receipt_path, target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'up', 'down', 'status', 'check', 'seed', 'seed-plan', 'migrate-plan', 'migrate-local', 'test-backend', 'backup', 'demo-init', 'demo-reset'])
    parser.add_argument('--from', dest='source')
    parser.add_argument('--local', action='store_true', help='PostgreSQL aislado, no Supabase DB')
    parser.add_argument('--offline-profiles', action='store_true')
    parser.add_argument('--allow-remote', action='store_true')
    parser.add_argument('--expected-target')
    parser.add_argument('--backup-receipt')
    parser.add_argument('--reset', action='store_true', help='Reemplaza solo el dataset del proyecto demo verificado; requiere respaldo.')
    parser.add_argument('--expected-project')
    args = parser.parse_args()
    initialize(args.source)
    if args.action == 'init':
        return
    configured_mode = read_env(CONFIG).get('BENEFY_DB_MODE', 'remote')
    if configured_mode not in ('local', 'remote'):
        raise ValueError('BENEFY_DB_MODE debe ser local o remote.')
    args.local = args.local or configured_mode == 'local'
    env = compose_environment(args.local)
    (ROOT / 'backups').mkdir(exist_ok=True)
    run = lambda command, **kwargs: compose(command, env, args.local, **kwargs)
    if args.action == 'up':
        if args.local:
            run(['up', '-d', '--wait', 'postgres'])
        run(['up', '-d', '--build', '--wait', 'backend', 'web', 'benef-ai'])
        print('Benefy: http://localhost:5173 | API: http://localhost:8001 | IA: http://localhost:5001')
    elif args.action == 'down':
        # Incluir el perfil local aunque se haya usado solo para tests.
        compose(['down'], env, local=True)  # Sin -v: conservar datos y dependencias.
    elif args.action == 'status':
        run(['ps'])
    elif args.action == 'check':
        run(['config', '--quiet'])
        run(['exec', '-T', 'backend', 'python', 'manage.py', 'check'])
    elif args.action in ('migrate-plan', 'migrate-local'):
        if args.action == 'migrate-local' and not args.local:
            raise ValueError('Solo se permiten migraciones automáticas con --local.')
        if args.local:
            run(['up', '-d', '--wait', 'postgres'])
        command = ['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'migrate']
        run(command + (['--plan'] if args.action == 'migrate-plan' else ['--noinput']))
    elif args.action == 'test-backend':
        if not args.local:
            raise ValueError('Las pruebas de base de datos requieren --local.')
        run(['up', '-d', '--wait', 'postgres'])
        run(['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'test', 'core.tests', '--noinput'])
    elif args.action in ('seed', 'seed-plan'):
        if args.action == 'seed' and args.local:
            run(['up', '-d', '--wait', 'postgres'])
            run(['run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'migrate', '--noinput'])
        command = ['run', '--rm', '--no-deps', '-e', 'SUPABASE_SEED_ADMIN_KEY', '-e', 'BENEFY_SHOWCASE_PASSWORDS',
                   'backend', 'python', 'manage.py', 'seed_demo']
        if args.reset:
            command += ['--reset']
        if args.expected_project:
            command += ['--expected-project', args.expected_project]
        if args.action == 'seed':
            command += ['--apply']
        if args.offline_profiles:
            command += ['--offline-profiles']
        if args.allow_remote:
            command += ['--allow-remote']
        if args.expected_target:
            command += ['--expected-target', args.expected_target]
        if args.backup_receipt:
            command += ['--backup-receipt', '/backups/' + Path(args.backup_receipt).name]
        run(command)
    elif args.action in ('demo-init', 'demo-reset'):
        if args.local:
            raise ValueError('Los comandos demo actúan solo sobre el Supabase autorizado.')
        project = validated_showcase_project(env)
        receipt, target = create_backup(run)
        command = ['run', '--rm', '--no-deps', '-e', 'SUPABASE_SEED_ADMIN_KEY', '-e', 'BENEFY_SHOWCASE_PASSWORDS',
                   'backend', 'python', 'manage.py', 'seed_demo', '--apply',
                   '--allow-remote', '--expected-project', project, '--expected-target', target,
                   '--backup-receipt', '/backups/' + receipt.name]
        if args.action == 'demo-reset':
            command.append('--reset')
        run(command)
    elif args.action == 'backup':
        create_backup(run, args.local)


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError:
        print('La operación Docker falló. No se ha cambiado de destino ni eliminado ningún volumen.', file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError) as error:
        # Los mensajes propios contienen nombres de variables, nunca valores.
        print(str(error), file=sys.stderr)
        sys.exit(1)
