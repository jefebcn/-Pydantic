@echo off
REM Avvio scanner su Windows: doppio click su questo file.
cd /d %~dp0
if not exist .venv (
  py -3 -m venv .venv
  .venv\Scripts\pip install -r scraper\requirements.txt
)
.venv\Scripts\python -m scraper.main
pause
