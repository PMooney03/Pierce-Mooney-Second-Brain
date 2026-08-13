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

echo Enabling Tailscale Serve ^(HTTPS on your tailnet^)...
tailscale serve reset 2>nul
tailscale serve --bg 80
if errorlevel 1 (
    echo Failed to run tailscale serve. Is Tailscale connected?
    pause
    exit /b 1
)

for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "$s=(tailscale status --json|ConvertFrom-Json).Self; $s.DNSName -replace '/$',''"`) do set "DNS=%%u"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(tailscale status --json|ConvertFrom-Json).Self.TailscaleIPs[0]"`) do set "TSIP=%%i"

echo.
echo ========================================
echo   Urban Mapping via Tailscale
echo ========================================
echo.
echo Open on your phone ^(Tailscale app must be ON, same account^):
echo.
if defined DNS (
    echo   https://%DNS%
) else (
    tailscale serve status
)
echo.
echo Tailscale IP ^(alternative^):
if defined TSIP (echo   http://%TSIP%) else (echo   see: tailscale status)
echo.
echo - Real HTTPS — no certificate install on iPhone
echo - Works on mobile data, not just home Wi-Fi
echo - Add to Home Screen from Safari
echo.
echo Share with friends: they need Tailscale on your account/network.
echo For anyone without Tailscale: scripts\start-tailscale-public.bat
echo.
echo Stop: scripts\stop-urban-map.bat
echo.
pause
