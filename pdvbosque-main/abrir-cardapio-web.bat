@echo off
title Cardapio Web - Pedir Online
cd /d "%~dp0"

echo Abrindo o cardapio web em http://localhost:5173/pedir
echo (Backend e frontend precisam estar rodando.)
echo.
start "" "http://localhost:5173/pedir"
