# Test script for the integration startup script
param([switch]$DryRun = $false)

function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }

Write-Info "=== Testing Integration Startup Script ==="

# Test 1: Check directories
Write-Info "Test 1: Validating directory structure..."
if (Test-Path "package.json") {
    Write-Success "✓ FinanceBuddy package.json found"
} else {
    Write-Error "✗ FinanceBuddy package.json not found"
}

if (Test-Path "Finance-mate/backend/package.json") {
    Write-Success "✓ Finance-mate package.json found"
} else {
    Write-Error "✗ Finance-mate package.json not found"
}

# Test 2: Check npm
Write-Info "Test 2: Checking npm availability..."
try {
    $npmVersion = npm --version
    Write-Success "✓ npm is available (version: $npmVersion)"
} catch {
    Write-Error "✗ npm is not available"
}

# Test 3: Check Node.js
Write-Info "Test 3: Checking Node.js availability..."
try {
    $nodeVersion = node --version
    Write-Success "✓ Node.js is available (version: $nodeVersion)"
} catch {
    Write-Error "✗ Node.js is not available"
}

Write-Info "=== Test Complete ==="
Write-Info "To run the startup script: .\scripts\start-integrated-system.ps1"