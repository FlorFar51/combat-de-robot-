@echo off
title Robot Arena - Tunnel Cloudflare
echo ==========================================
echo       ROBOT ARENA - TUNNEL GRATUIT
echo ==========================================
echo.
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared n'est pas installe ou absent du PATH.
  echo Telecharge cloudflared pour Windows depuis :
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  pause
  exit /b 1
)
echo Le lien trycloudflare.com apparait ci-dessous.
echo Copie l'adresse HTTPS affichee et garde cette fenetre ouverte.
echo.
cloudflared tunnel --url http://localhost:3000
pause
