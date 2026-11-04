@echo off
REM Avvio scanner su Windows: doppio click su questo file.
REM Se lo scanner si chiude da solo riparte dopo un minuto. Per fermarlo chiudi questa finestra.
cd /d %~dp0
if not exist .venv (
  py -3 -m venv .venv
  .venv\Scripts\pip install -r scraper\requirements.txt
)
:riparti
.venv\Scripts\python -m scraper.main
if %errorlevel%==3 goto fine
echo.
echo Scanner terminato: riparto tra 60 secondi. Per fermarlo chiudi questa finestra.
timeout /t 60 /nobreak >nul
goto riparti
:fine
pause
