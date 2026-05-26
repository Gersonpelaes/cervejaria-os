@echo off
cd /d "%~dp0"
title Parar PDV RESTAURANTE 2025

echo ======================================================
echo          PARANDO PDV RESTAURANTE 2025
echo ======================================================
echo.
echo Procurando processo na porta 3001...
set "found="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "LISTENING" ^| findstr ":3001"') do (
    taskkill /f /pid %%a
    set "found=1"
    echo [OK] Servidor parado com sucesso (PID: %%a).
)
if not defined found (
    echo [INFO] Nenhum servidor ativo foi encontrado rodando na porta 3001.
)
echo.
timeout /t 3
