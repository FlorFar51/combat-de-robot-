@echo off
title Robot Arena - Serveur multijoueur
cd /d "%~dp0"
echo ==========================================
echo       ROBOT ARENA - SERVEUR PRIVE
echo ==========================================
echo.
if not exist node_modules\ (
  echo Installation des dependances au premier lancement...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERREUR : installation impossible.
    pause
    exit /b 1
  )
)
echo.
echo Serveur en cours de demarrage...
echo Laisse cette fenetre ouverte pendant le jeu.
echo.
call npm start
pause
