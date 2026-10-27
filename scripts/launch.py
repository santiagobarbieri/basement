#!/usr/bin/env python3
"""Local, single-instance static launcher for Basement on macOS (stdlib only)."""
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PORT = 8000
URL = 'http://127.0.0.1:%d/' % PORT
START_URL = URL + 'hub/'
IDENTITY = hashlib.sha256(str(ROOT).encode()).hexdigest()[:16]
LOG = Path(tempfile.gettempdir()) / ('basement-%s.log' % IDENTITY)
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def running():
    try:
        with HTTP.open(URL + '_basement/health', timeout=0.5) as response:
            health = json.loads(response.read(2048))
        if health != {'app': 'basement', 'root': IDENTITY}:
            raise RuntimeError('El puerto %d está ocupado por otra app o por otra copia de Basement.' % PORT)
        return True
    except urllib.error.HTTPError:
        raise RuntimeError('El puerto %d está ocupado por otra app.' % PORT)
    except urllib.error.URLError:
        return False
    except (ValueError, json.JSONDecodeError):
        raise RuntimeError('El puerto %d está ocupado por otra app.' % PORT)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def allowed(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        target = (ROOT / 'dist' / path.lstrip('/')).resolve()
        try:
            relative = target.relative_to((ROOT / 'dist').resolve())
        except ValueError:
            return False
        return not any(part.startswith('.') for part in relative.parts)

    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path == '/_basement/health':
            payload = json.dumps({'app': 'basement', 'root': IDENTITY}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if not self.allowed():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1] if len(args) > 1 else '') != '200':
            super().log_message(fmt, *args)


def serve():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    server.daemon_threads = True
    print('Basement: %s (PID %d)' % (URL, os.getpid()), flush=True)
    server.serve_forever()


def ensure_server():
    if running():
        return
    if not (ROOT / 'dist' / 'hub' / 'index.html').is_file():
        raise RuntimeError('No se encontró index.html. Dejá el launcher dentro de la carpeta de Basement.')
    with LOG.open('ab') as log:
        subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--serve'],
                         cwd=str(ROOT), stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                         start_new_session=True, close_fds=True)
    for _ in range(60):
        if running():
            return
        time.sleep(0.1)
    raise RuntimeError('No se pudo iniciar Basement. Registro: %s' % LOG)


def open_browser():
    if sys.platform != 'darwin' or not shutil.which('open'):
        raise RuntimeError('Abrí %s en Google Chrome.' % URL)
    chrome = Path('/Applications/Google Chrome.app')
    if not chrome.is_dir():
        raise RuntimeError('Instalá Google Chrome para probar Basement con guardado en carpeta.')
    subprocess.run(['/usr/bin/open', '-a', str(chrome), START_URL], check=True)



def main():
    parser = argparse.ArgumentParser(description='Abrir Basement en este Mac.')
    parser.add_argument('--serve', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--no-open', action='store_true', help='Iniciar sin abrir el navegador.')
    parser.add_argument('--status', action='store_true', help='Comprobar el servidor local.')
    args = parser.parse_args()
    try:
        if args.serve:
            serve()
        elif args.status:
            if not running():
                print('Basement no está iniciado.')
                return 1
            print(URL)
        else:
            from importlib.util import spec_from_file_location, module_from_spec
            spec = spec_from_file_location("basement_precache", ROOT / "scripts" / "build-precache.py")
            build = module_from_spec(spec)
            spec.loader.exec_module(build)
            build.generate()
            ensure_server()
            if not args.no_open:
                open_browser()
            print('Basement está listo: ' + URL)
        return 0
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
