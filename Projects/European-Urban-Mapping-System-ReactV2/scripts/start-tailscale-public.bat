@echo off
setlocal enabledelayedexpansion
cd /d C:\Users\pierc\Desktop\European-Urban-Mapping-System-ReactV2

where tailscale >nul 2>&1
if errorlevel 1 (
    echo Tailscale is not installed. Download from https://tailscale.com/download
    pause
    exit /b 1
)

echo Building React app...
cd frontend
call npm run build
if errorlevel 1 (
    echo Frontend build failed.
    pause
    exit /b 1
)
cd ..

echo Starting Urban Mapping...
docker compose up -d --build

echo Enabling Tailscale Funnel ^(public HTTPS — anyone on the internet^)...
tailscale funnel reset 2>nul
tailscale funnel --bg 80
if errorlevel 1 (
    echo.
    echo Funnel failed. Enable it in Tailscale admin:
    echo   https://login.tailscale.com/admin/dns
    echo   ^(Allow Funnel for your tailnet^)
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Urban Mapping — PUBLIC link
echo ========================================
echo.
tailscale funnel status
echo.
echo Share the https URL above with anyone.
echo No Tailscale app required on their phone.
echo.
echo Your PC must stay on. Stop: scripts\stop-urban-map.bat
echo.
pause
