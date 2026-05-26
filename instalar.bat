@echo off
cd /d "%~dp0"
title Assistente de Instalacao - PDV RESTAURANTE 2025

echo ======================================================
echo         INICIANDO INSTALADOR VISUAL...
echo ======================================================
echo.
echo Abrindo o assistente grafico de instalacao.
echo Se solicitado, autorize os privilegios de Administrador...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar_gui.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Nao foi possivel iniciar o assistente visual.
    echo Por favor, verifique se o PowerShell esta ativo nesta maquina.
    pause
)
