@echo off
cd /d C:\Users\pierc\Desktop\European-Urban-Mapping-System

if not exist certs\cert.pem (
    echo No HTTPS certificate found. Run scripts\generate-ssl-cert.bat first.
    echo Starting anyway — HTTP will work but phone GPS will not.
    echo.
)

docker compose up -d
echo.
echo Urban Mapping System is starting...
echo.
echo PC:    http://localhost
echo PC:    https://localhost          ^(GPS works^)
echo Phone: https://100.117.251.64     ^(trust cert once in Safari for GPS^)
echo.
echo Tip: On iPhone, Add to Home Screen as "Urban Mapping" for the best experience.
echo.
pause
