@echo off
title Atualizador - PDV RESTAURANTE 2025
chcp 65001 > nul
echo ======================================================
echo         ATUALIZADOR - PDV RESTAURANTE 2025
echo ======================================================
echo.

:: Detecta se existe pasta .git local
if exist .git (
    echo [INFO] Repositório Git detectado localmente.
    echo Atualizando código-fonte via Git...
    git pull
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao atualizar via git pull.
        pause
        exit /b %errorlevel%
    )
) else (
    echo [INFO] Repositório Git não configurado.
    echo Baixando atualização do GitHub (.zip)...
    
    :: Baixa a atualização usando PowerShell
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/Gersonpelaes/cervejaria-os/archive/refs/heads/main.zip' -OutFile 'update.zip'"
    if %errorlevel% neq 0 (
        echo [ERRO] Não foi possível baixar a atualização.
        pause
        exit /b %errorlevel%
    )
    
    echo Extraindo arquivos...
    if exist update_temp rmdir /s /q update_temp
    powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'update_temp' -Force"
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao extrair a atualização.
        del update.zip
        pause
        exit /b %errorlevel%
    )
    
    echo Atualizando arquivos do sistema (preservando banco de dados e configurações)...
    :: Robocopy copia tudo exceto banco de dados, arquivos de configuração e node_modules
    robocopy "update_temp\cervejaria-os-main" "." /E /XF "dev.db" "printer_config.json" "restaurant_config.json" /XD "node_modules" ".git" > nul
    if %errorlevel% geq 8 (
        echo [ERRO] Ocorreu uma falha ao copiar os arquivos atualizados. Código de erro: %errorlevel%
        del update.zip
        rmdir /s /q update_temp
        pause
        exit /b %errorlevel%
    )
    
    :: Limpeza
    del update.zip
    rmdir /s /q update_temp
    echo [OK] Arquivos atualizados com sucesso!
)

echo.
echo ======================================================
echo REINSTALANDO DEPENDÊNCIAS E RECONSTRUINDO O FRONTEND...
echo ======================================================
echo Instalando dependências do Frontend...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependências do Frontend.
    pause
    exit /b %errorlevel%
)

echo Instalando dependências do Backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependências do Backend.
    pause
    exit /b %errorlevel%
)

echo Gerando schema do banco de dados (Prisma)...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao gerar o Prisma Client.
    pause
    exit /b %errorlevel%
)
cd ..

echo Compilando o Frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao compilar o Frontend.
    pause
    exit /b %errorlevel%
)

echo.
echo ======================================================
echo          ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!
echo ======================================================
echo.
pause
