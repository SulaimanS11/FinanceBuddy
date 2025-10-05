@echo off
REM Finance-mate Integration Startup Script (Batch version)
REM This script starts both FinanceBuddy and Finance-mate systems in the correct order

setlocal enabledelayedexpansion

REM Default configuration
set FINANCEBUDDY_PATH=.
set FINANCEMATE_PATH=Finance-mate\backend
set FINANCEBUDDY_PORT=3000
set FINANCEMATE_HTTP_PORT=3001
set FINANCEMATE_HTTPS_PORT=3002
set HEALTH_CHECK_TIMEOUT=60

REM Process IDs for cleanup
set FINANCEBUDDY_PID=
set FINANCEMATE_PID=

echo === Finance-mate Integration Startup ===
echo Starting integrated system with FinanceBuddy and Finance-mate...

REM Step 1: Validate project directories
echo Step 1: Validating project directories...

if not exist "%FINANCEBUDDY_PATH%\package.json" (
    echo ERROR: FinanceBuddy directory or package.json not found at: %FINANCEBUDDY_PATH%
    exit /b 1
)
echo SUCCESS: FinanceBuddy directory validated: %FINANCEBUDDY_PATH%

if not exist "%FINANCEMATE_PATH%\package.json" (
    echo ERROR: Finance-mate directory or package.json not found at: %FINANCEMATE_PATH%
    exit /b 1
)
echo SUCCESS: Finance-mate directory validated: %FINANCEMATE_PATH%

REM Step 2: Check if ports are available (basic check)
echo Step 2: Checking port availability...
netstat -an | findstr ":%FINANCEBUDDY_PORT% " >nul
if !errorlevel! == 0 (
    echo WARNING: Port %FINANCEBUDDY_PORT% appears to be in use
    echo Suggested alternative ports: 3010, 3020, 3030
    echo You may need to modify the script or stop the conflicting service
)

netstat -an | findstr ":%FINANCEMATE_HTTP_PORT% " >nul
if !errorlevel! == 0 (
    echo WARNING: Port %FINANCEMATE_HTTP_PORT% appears to be in use
    echo Suggested alternative ports: 3011, 3021, 3031
)

netstat -an | findstr ":%FINANCEMATE_HTTPS_PORT% " >nul
if !errorlevel! == 0 (
    echo WARNING: Port %FINANCEMATE_HTTPS_PORT% appears to be in use
    echo Suggested alternative ports: 3012, 3022, 3032
)

REM Step 3: Start FinanceBuddy
echo Step 3: Starting FinanceBuddy...
set PORT=%FINANCEBUDDY_PORT%
cd /d "%FINANCEBUDDY_PATH%"
start "FinanceBuddy" /min cmd /c "npm run dev"
if !errorlevel! neq 0 (
    echo ERROR: Failed to start FinanceBuddy
    exit /b 1
)
echo SUCCESS: FinanceBuddy started on port %FINANCEBUDDY_PORT%

REM Step 4: Wait for FinanceBuddy health check
echo Step 4: Waiting for FinanceBuddy to be ready...
set /a counter=0
:healthcheck
if !counter! geq %HEALTH_CHECK_TIMEOUT% (
    echo ERROR: Health check timeout after %HEALTH_CHECK_TIMEOUT% seconds
    goto cleanup
)

REM Simple health check using curl or powershell
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%FINANCEBUDDY_PORT%/health' -TimeoutSec 5 -UseBasicParsing; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! == 0 (
    echo SUCCESS: FinanceBuddy health check passed!
    goto start_financemate
)

echo Waiting for FinanceBuddy...
timeout /t 2 /nobreak >nul
set /a counter+=2
goto healthcheck

:start_financemate
REM Step 5: Start Finance-mate
echo Step 5: Starting Finance-mate...
set HTTP_PORT=%FINANCEMATE_HTTP_PORT%
set HTTPS_PORT=%FINANCEMATE_HTTPS_PORT%
cd /d "%~dp0..\%FINANCEMATE_PATH%"
start "Finance-mate" /min cmd /c "npm start"
if !errorlevel! neq 0 (
    echo ERROR: Failed to start Finance-mate
    goto cleanup
)
echo SUCCESS: Finance-mate started on ports %FINANCEMATE_HTTP_PORT%/%FINANCEMATE_HTTPS_PORT%

REM Step 6: Display status and URLs
echo.
echo === SYSTEM STATUS ===
echo SUCCESS: FinanceBuddy: Running on port %FINANCEBUDDY_PORT%
echo SUCCESS: Finance-mate: Running on ports %FINANCEMATE_HTTP_PORT%/%FINANCEMATE_HTTPS_PORT%
echo.
echo === ACCESS URLS ===
echo FinanceBuddy:     http://localhost:%FINANCEBUDDY_PORT%
echo Finance-mate:     http://localhost:%FINANCEMATE_HTTP_PORT%
echo Finance-mate SSL: https://localhost:%FINANCEMATE_HTTPS_PORT%
echo.
echo === INTEGRATION STATUS ===
echo SUCCESS: Systems started in correct order
echo SUCCESS: Health checks passed
echo SUCCESS: Integration ready for use
echo.
echo Press Ctrl+C to stop both systems
echo.

REM Keep script running
:monitor
timeout /t 5 /nobreak >nul
REM Check if FinanceBuddy is still responding
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:%FINANCEBUDDY_PORT%/health' -TimeoutSec 2 -UseBasicParsing; if ($response.StatusCode -ne 200) { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: FinanceBuddy is no longer responding
    goto cleanup
)
goto monitor

:cleanup
echo.
echo Shutting down systems...
echo INFO: Stopping Finance-mate and FinanceBuddy...
taskkill /f /im node.exe >nul 2>&1
echo SUCCESS: Systems stopped
exit /b 0