@echo off
title Deploy Railway - Agency Manager

echo ================================================
echo   Deploy Railway - Agency Manager
echo ================================================
echo.
echo PASSO 1: Login no Railway
echo.
call railway login
echo.

echo PASSO 2: Criando projeto no Railway...
call railway init --name agency-manager
echo.

echo PASSO 3: Adicionando PostgreSQL...
call railway add --plugin postgresql
echo.
echo Aguardando banco inicializar...
timeout /t 10 /nobreak > nul

echo PASSO 4: Deploy do Backend...
cd /d "%~dp0backend"
call railway up --service backend --detach
echo.

echo PASSO 5: Deploy do Frontend...
cd /d "%~dp0frontend"
call railway up --service frontend --detach
echo.

echo ================================================
echo   Deploy concluido!
echo   Acesse: railway open
echo ================================================
pause
