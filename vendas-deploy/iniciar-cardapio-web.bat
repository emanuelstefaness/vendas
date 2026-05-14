@echo off
title Cardapio Web - Iniciando
cd /d "%~dp0"

echo.
echo ========================================
echo   CARDAPIO WEB (Pedidos online)
echo ========================================
echo.

echo [1/3] Iniciando o backend (API do cardapio)...
start "Backend Cardapio Web" cmd /k "cd /d "%~dp0backend" && npm start"
timeout /t 3 /nobreak >nul

echo [2/3] Iniciando o frontend...
start "Frontend Cardapio Web" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 12 /nobreak >nul

echo [3/3] Abrindo o cardapio web no navegador...
start "" "http://localhost:5173/pedir"

echo.
echo Pronto!
echo Cardapio web: http://localhost:5173/pedir
echo.
echo Deixe as duas janelas abertas (Backend e Frontend).
echo Feche este terminal quando quiser.
pause
