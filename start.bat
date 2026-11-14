@echo off
title AI Lead Generation Agent - Launcher
echo ========================================================
echo   AI-Powered Company Lead Generation Agent (Phase 1)
echo ========================================================
echo.

echo [1/3] Starting Python Scraper Microservice (Port 8000)...
start "1. Python Scraper Service" cmd /k "cd /d "%~dp0scraper" && python main.py"

echo [2/3] Starting Express Backend API (Port 5003)...
start "2. Node.js Backend API" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo [3/3] Starting React Frontend Dashboard (Port 5173)...
start "3. Vite React Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo   All 3 services have been launched in separate windows!
echo ========================================================
echo   - Frontend SaaS UI:        http://localhost:5173
echo   - Backend API Health:       http://localhost:5003/api/health
echo   - Scraper Microservice:     http://localhost:8000/health
echo   - Google Maps Scraper:      http://localhost:8085 (Docker)
echo   - Cal.com Live Scheduler:   https://cal.com/abdulhannan-digitalsofts
echo ========================================================
echo.
echo You can open your browser at: http://localhost:5173
echo.
pause

