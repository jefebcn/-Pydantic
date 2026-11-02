#!/usr/bin/env bash
# Avvio scanner su Mac/Linux: ./avvia-scanner.sh
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r scraper/requirements.txt
fi
exec .venv/bin/python -m scraper.main "$@"
