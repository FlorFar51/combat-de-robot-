@echo off
title Robot Arena - Tunnel Cloudflare
cd /d "%~dp0"
echo ==========================================
echo       ROBOT ARENA - TUNNEL GRATUIT
echo ==========================================
echo.
set "CLOUDFLARED="
if exist "%~dp0cloudflared.exe" set "CLOUDFLARED=%~dp0cloudflared.exe"
if not defined CLOUDFLARED (
  where cloudflared >nul 2>nul
  if not errorlevel 1 set "CLOUDFLARED=cloudflared"
)
if not defined CLOUDFLARED (
  echo cloudflared.exe est introuvable.
  echo Place cloudflared.exe dans le meme dossier que ce fichier BAT.
  echo.
  pause
  exit /b 1
)
echo Le lien trycloudflare.com apparait ci-dessous.
echo Copie l'adresse HTTPS affichee et garde cette fenetre ouverte.
echo.
"%CLOUDFLARED%" tunnel --url http://localhost:3000
echo.
echo Le tunnel s'est arrete.
pause
