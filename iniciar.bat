@echo off
cd /d "%~dp0"
title PDV RESTAURANTE 2025 - Inicializador

echo ======================================================
echo          INICIANDO PDV RESTAURANTE 2025
echo ======================================================
echo.

echo Aguardando inicializacao do servidor para abrir o navegador...
start /b cmd /c "timeout /t 3 >nul && start http://localhost:3001"

echo Iniciando o servidor backend...
cd backend

set "NODE_CMD=node"
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=\"C:\Program Files\nodejs\node.exe\""
) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_CMD=\"C:\Program Files (x86)\nodejs\node.exe\""
)

%NODE_CMD% server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Ocorreu um problema ao iniciar o servidor.
    echo Verifique se o Node.js esta instalado e se a porta 3001 nao esta em uso.
    pause
)
