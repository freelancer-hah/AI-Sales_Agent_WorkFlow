Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  AI-Powered Company Lead Generation Agent (Phase 1)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

Write-Host "[1/3] Starting Python Scraper Microservice (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\scraper'; python main.py"

Write-Host "[2/3] Starting Express Backend API (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run build; npm start"

Write-Host "[3/3] Starting React Frontend Dashboard (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  All 3 services have been launched in separate windows!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  - Frontend SaaS UI:    http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend API Health:  http://localhost:5000/api/health" -ForegroundColor White
Write-Host "  - Scraper Health:      http://localhost:8000/health" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Opening browser at http://localhost:5173..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

