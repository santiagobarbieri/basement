#!/bin/zsh
set -eu
cd "${0:A:h:h}"
if curl --silent --fail --output /dev/null http://127.0.0.1:9340/index.html; then
  open http://127.0.0.1:9340/index.html
else
  python3 studios/endo/basement_server.py --open
fi
