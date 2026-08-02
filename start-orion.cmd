@echo off
cd /d "%~dp0"
start "Orion" /min npm.cmd run start
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:8787
