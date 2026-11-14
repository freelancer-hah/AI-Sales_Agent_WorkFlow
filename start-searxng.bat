@echo off
title Start SearXNG Docker Service
echo ========================================================
echo   Starting SearXNG Container for Sales Agent (Port 8088)
echo ========================================================
echo.

set DOCKER_PATH=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe

echo Checking Docker engine status...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Docker engine is not running.
    if exist "%DOCKER_PATH%" (
        echo [INFO] Launching Docker Desktop from:
        echo   "%DOCKER_PATH%"
        start "" "%DOCKER_PATH%"
        echo.
        echo Please wait while Docker Desktop initializes (takes 20-40 seconds)...
        
        :wait_loop
        timeout /t 4 /nobreak >nul
        docker ps >nul 2>&1
        if %errorlevel% neq 0 (
            echo   Waiting for Docker engine to become ready...
            goto wait_loop
        )
        echo [SUCCESS] Docker engine is ready!
    ) else (
        echo [WARNING] Please launch Docker Desktop from your Windows Start Menu,
        echo wait until the Docker icon turns green, and then re-run this script.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Starting SearXNG container via Docker Compose...
docker compose up -d

echo.
echo ========================================================
echo   SearXNG is running at: http://localhost:8088
echo ========================================================
echo You can test it by opening: http://localhost:8088 in your browser.
echo.
pause
