#!/usr/bin/env python3
"""Generate the same offline revision as gen-precache.mjs, with stdlib only."""
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import quote
ROOT = Path(__file__).resolve().parent.parent / 'dist'

def generate(root=ROOT):
    files = []
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if not path.is_file() or any(part.startswith('.') for part in relative.parts) or path.name in ('sw.js', 'precache.json') or path.suffix == '.md':
            continue
        data = path.read_bytes()
        url = '/' + '/'.join(quote(part, safe="~!*'()-._") for part in relative.parts)
        files.append({'url': url, 'hash': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    worker = (root / 'sw.js').read_text()
    normalized = re.sub(r"const BUILD = '[^']+';", "const BUILD = '__PRECACHE_REVISION__';", worker)
    packed = json.dumps(files, ensure_ascii=False, separators=(',', ':'))
    revision = hashlib.sha256((packed + normalized).encode()).hexdigest()
    manifest = {'schema': 1, 'hash': revision, 'bytes': sum(f['bytes'] for f in files), 'files': files}
    for path, content in [(root / 'precache.json', json.dumps(manifest, ensure_ascii=False, indent=2)+'\n'),
                          (root / 'sw.js', re.sub(r"const BUILD = '[^']+';", "const BUILD = '%s';" % revision, worker))]:
        if not path.exists() or path.read_text() != content:
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_text(content)
            temporary.replace(path)
    return manifest

if __name__ == '__main__':
    print(generate()['hash'])
