@echo off
title Encerrando Agency...

echo Encerrando o sistema...

:: Matar processos nas portas 3000 e 3333
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3333" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F > nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F > nul 2>&1
)

echo Backend e Frontend encerrados.
echo.
echo (O banco de dados Docker continua rodando em background)
echo Para parar o banco tambem, rode: docker compose down
echo.
pause
