@echo off
cd /d C:\Users\pierc\Desktop\European-Urban-Mapping-System-ReactV2

tailscale serve reset 2>nul
tailscale funnel reset 2>nul

docker compose down
echo.
echo Urban Mapping stopped. Tailscale Serve/Funnel disabled.
echo.
pause
