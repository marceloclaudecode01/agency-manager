@echo off
title Agency - Sistema de Gestao

echo ================================================
echo   Agency - Sistema de Gestao para Marketing
echo ================================================
echo.

:: 1. Verificar e aguardar Docker
echo [1/3] Verificando Docker...
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo Docker nao esta pronto. Aguardando iniciar...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    :waitdocker
    timeout /t 5 /nobreak > nul
    docker info > nul 2>&1
    if %errorlevel% neq 0 goto waitdocker
)
echo Docker OK!

:: 2. Subir banco de dados
echo [2/4] Iniciando banco de dados...
cd /d "%~dp0"
docker compose up -d
echo Banco de dados OK!
echo.

:: 3. Subir backend
echo [3/4] Iniciando backend (porta 3333)...
start "Agency Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 8 /nobreak > nul
echo.

:: 4. Subir frontend
echo [4/4] Iniciando frontend (porta 3000)...
start "Agency Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 10 /nobreak > nul
echo.

:: 5. Abrir no navegador
echo Abrindo sistema no navegador...
start http://localhost:3000
echo.

echo ================================================
echo   Sistema rodando!
echo   Acesse: http://localhost:3000
echo   Login:  admin@agency.com / admin123
echo ================================================
echo.
echo Para encerrar, feche as janelas "Agency Backend"
echo e "Agency Frontend" que foram abertas.
echo.
pause
