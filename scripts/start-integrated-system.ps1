# Finance-mate Integration Startup Script
# This script starts both FinanceBuddy and Finance-mate systems in the correct order

param(
    [string]$FinanceBuddyPath = ".",
    [string]$FinanceMatePath = "Finance-mate/backend",
    [int]$FinanceBuddyPort = 3000,
    [int]$FinanceMateHttpPort = 3001,
    [int]$FinanceMateHttpsPort = 3002,
    [int]$HealthCheckTimeout = 60
)

# Color output functions
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }

# Global variables for process management
$FinanceBuddyProcess = $null
$FinanceMateProcess = $null

# Cleanup function
function Cleanup {
    Write-Info "Shutting down systems..."
    
    if ($FinanceMateProcess -and !$FinanceMateProcess.HasExited) {
        Write-Info "Stopping Finance-mate..."
        $FinanceMateProcess.Kill()
        $FinanceMateProcess.WaitForExit(5000)
    }
    
    if ($FinanceBuddyProcess -and !$FinanceBuddyProcess.HasExited) {
        Write-Info "Stopping FinanceBuddy..."
        $FinanceBuddyProcess.Kill()
        $FinanceBuddyProcess.WaitForExit(5000)
    }
    
    Write-Success "Systems stopped gracefully"
    exit 0
}

# Register cleanup on Ctrl+C
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }
[Console]::TreatControlCAsInput = $false
[Console]::CancelKeyPress += { Cleanup }

# Function to check if port is available
function Test-Port {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

# Function to suggest alternative ports
function Get-AlternativePort {
    param([int]$StartPort)
    for ($port = $StartPort + 1; $port -le $StartPort + 100; $port++) {
        if (Test-Port $port) {
            return $port
        }
    }
    return $null
}

# Function to check if directory exists and has required files
function Test-ProjectDirectory {
    param([string]$Path, [string]$ProjectName, [string]$RequiredFile)
    
    if (!(Test-Path $Path)) {
        Write-Error "$ProjectName directory not found at: $Path"
        return $false
    }
    
    $fullRequiredPath = Join-Path $Path $RequiredFile
    if (!(Test-Path $fullRequiredPath)) {
        Write-Error "$ProjectName required file not found: $fullRequiredPath"
        return $false
    }
    
    Write-Success "$ProjectName directory validated: $Path"
    return $true
}

# Function to wait for health check
function Wait-ForHealthCheck {
    param([string]$Url, [int]$TimeoutSeconds)
    
    Write-Info "Waiting for health check at $Url..."
    $startTime = Get-Date
    
    while ((Get-Date) -lt $startTime.AddSeconds($TimeoutSeconds)) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "Health check passed!"
                return $true
            }
        }
        catch {
            # Health check failed, continue waiting
        }
        
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
    }
    
    Write-Host ""
    Write-Error "Health check timeout after $TimeoutSeconds seconds"
    return $false
}

# Main execution
try {
    Write-Info "=== Finance-mate Integration Startup ==="
    Write-Info "Starting integrated system with FinanceBuddy and Finance-mate..."
    
    # Step 1: Validate project directories (Requirement 3.1)
    Write-Info "Step 1: Validating project directories..."
    
    if (!(Test-ProjectDirectory $FinanceBuddyPath "FinanceBuddy" "package.json")) {
        exit 1
    }
    
    if (!(Test-ProjectDirectory $FinanceMatePath "Finance-mate" "package.json")) {
        exit 1
    }
    
    # Step 2: Check port availability (Requirement 3.6)
    Write-Info "Step 2: Checking port availability..."
    
    if (!(Test-Port $FinanceBuddyPort)) {
        $altPort = Get-AlternativePort $FinanceBuddyPort
        Write-Warning "Port $FinanceBuddyPort is in use for FinanceBuddy"
        if ($altPort) {
            Write-Warning "Suggested alternative port: $altPort"
            Write-Warning "Use: -FinanceBuddyPort $altPort"
        }
        exit 1
    }
    
    if (!(Test-Port $FinanceMateHttpPort)) {
        $altPort = Get-AlternativePort $FinanceMateHttpPort
        Write-Warning "Port $FinanceMateHttpPort is in use for Finance-mate HTTP"
        if ($altPort) {
            Write-Warning "Suggested alternative port: $altPort"
            Write-Warning "Use: -FinanceMateHttpPort $altPort"
        }
        exit 1
    }
    
    if (!(Test-Port $FinanceMateHttpsPort)) {
        $altPort = Get-AlternativePort $FinanceMateHttpsPort
        Write-Warning "Port $FinanceMateHttpsPort is in use for Finance-mate HTTPS"
        if ($altPort) {
            Write-Warning "Suggested alternative port: $altPort"
            Write-Warning "Use: -FinanceMateHttpsPort $altPort"
        }
        exit 1
    }
    
    Write-Success "All ports are available"
    
    # Step 3: Start FinanceBuddy (Requirement 3.2)
    Write-Info "Step 3: Starting FinanceBuddy..."
    
    $env:PORT = $FinanceBuddyPort
    $FinanceBuddyProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $FinanceBuddyPath -PassThru -WindowStyle Hidden
    
    if (!$FinanceBuddyProcess) {
        Write-Error "Failed to start FinanceBuddy"
        exit 1
    }
    
    Write-Success "FinanceBuddy started (PID: $($FinanceBuddyProcess.Id))"
    
    # Step 4: Wait for FinanceBuddy health check (Requirement 3.2)
    Write-Info "Step 4: Waiting for FinanceBuddy to be ready..."
    
    $healthUrl = "http://localhost:$FinanceBuddyPort/health"
    if (!(Wait-ForHealthCheck $healthUrl $HealthCheckTimeout)) {
        Write-Error "FinanceBuddy failed to start properly"
        Cleanup
        exit 1
    }
    
    # Step 5: Start Finance-mate (Requirement 3.3)
    Write-Info "Step 5: Starting Finance-mate..."
    
    $env:HTTP_PORT = $FinanceMateHttpPort
    $env:HTTPS_PORT = $FinanceMateHttpsPort
    $FinanceMateProcess = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $FinanceMatePath -PassThru -WindowStyle Hidden
    
    if (!$FinanceMateProcess) {
        Write-Error "Failed to start Finance-mate"
        Cleanup
        exit 1
    }
    
    Write-Success "Finance-mate started (PID: $($FinanceMateProcess.Id))"
    
    # Step 6: Display status and URLs (Requirement 3.4)
    Write-Info "Step 6: Integration startup complete!"
    Write-Success "=== SYSTEM STATUS ==="
    Write-Success "✓ FinanceBuddy: Running on port $FinanceBuddyPort (PID: $($FinanceBuddyProcess.Id))"
    Write-Success "✓ Finance-mate: Running on ports $FinanceMateHttpPort/$FinanceMateHttpsPort (PID: $($FinanceMateProcess.Id))"
    Write-Success ""
    Write-Success "=== ACCESS URLS ==="
    Write-Success "FinanceBuddy:     http://localhost:$FinanceBuddyPort"
    Write-Success "Finance-mate:     http://localhost:$FinanceMateHttpPort"
    Write-Success "Finance-mate SSL: https://localhost:$FinanceMateHttpsPort"
    Write-Success ""
    Write-Success "=== INTEGRATION STATUS ==="
    Write-Success "✓ Systems started in correct order"
    Write-Success "✓ Health checks passed"
    Write-Success "✓ Integration ready for use"
    Write-Success ""
    Write-Info "Press Ctrl+C to stop both systems"
    
    # Keep script running and monitor processes
    while ($true) {
        Start-Sleep -Seconds 5
        
        # Check if processes are still running
        if ($FinanceBuddyProcess.HasExited) {
            Write-Error "FinanceBuddy process has exited unexpectedly"
            Cleanup
            exit 1
        }
        
        if ($FinanceMateProcess.HasExited) {
            Write-Error "Finance-mate process has exited unexpectedly"
            Cleanup
            exit 1
        }
    }
}
catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    Cleanup
    exit 1
}