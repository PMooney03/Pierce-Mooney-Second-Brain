@echo off
setlocal enabledelayedexpansion

cd /d C:\Users\pierc\Desktop\European-Urban-Mapping-System
if not exist certs mkdir certs

set "IP=100.117.251.64"
set /p IP="Enter your PC LAN IP for phone access [%IP%]: "

echo.
echo Generating HTTPS certificate for localhost and %IP% ...
echo.

docker run --rm -v "%cd%\certs:/certs" alpine/openssl req -x509 -nodes -days 825 -newkey rsa:2048 ^
  -keyout /certs/key.pem -out /certs/cert.pem ^
  -subj "/CN=Urban Mapping/O=Local Dev" ^
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:%IP%"

if errorlevel 1 (
    echo.
    echo Failed to generate certificate. Is Docker running?
    pause
    exit /b 1
)

echo.
echo Certificate created in certs\
echo.
echo On iPhone Safari, open https://%IP% and tap "Show Details" -^> "visit this website"
echo to trust the certificate, then Use My Location will use real GPS.
echo.
pause
