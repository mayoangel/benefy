"""Prueba recarga real modificando solo un comentario y restaurando cada archivo."""
import json
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
PID_SCRIPT = '''import json,os
from pathlib import Path
result=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit() or int(p.name)==os.getpid(): continue
 try: cmd=(p/'cmdline').read_bytes()
 except OSError: continue
 if (b'manage.py' in cmd and b'runserver' in cmd) or b'spawn_main' in cmd: result.append(int(p.name))
print(json.dumps(sorted(result)))'''


def pids(container):
    result = subprocess.run(['docker', 'exec', container, 'python', '-c', PID_SCRIPT],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def wait_for_reload(container, previous, health):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        if pids(container) != previous:
            try:
                with urlopen(health, timeout=2) as response:
                    if response.status == 200:
                        return
            except OSError:
                pass
        time.sleep(0.25)
    raise RuntimeError('No se verificó la recarga del proceso: ' + container)


for relative, container, health in [
    ('backend/config/devdemo.py', 'benefy-backend-1', 'http://127.0.0.1:8001/'),
    ('benef-ai/main.py', 'benefy-benef-ai-1', 'http://127.0.0.1:5001/'),
]:
    path = ROOT / relative
    original = path.read_bytes()
    before = pids(container)
    try:
        path.write_bytes(original + b'\n# Probe temporal de recarga.\n')
        wait_for_reload(container, before, health)
    finally:
        before_restore = pids(container)
        path.write_bytes(original)
        wait_for_reload(container, before_restore, health)
    print(container + ': recarga y restauracion verificadas')
