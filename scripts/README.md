# Integration Startup Scripts

This directory contains scripts to start both FinanceBuddy and Finance-mate systems in the correct order for seamless integration.

## Available Scripts

### Windows PowerShell (Recommended)
- **File**: `start-integrated-system.ps1`
- **Usage**: 
  ```powershell
  .\scripts\start-integrated-system.ps1
  ```
- **Features**: 
  - Full port conflict detection
  - Health check monitoring
  - Graceful shutdown handling
  - Colored output
  - Process monitoring

### Windows Batch
- **File**: `start-integrated-system.bat`
- **Usage**: 
  ```cmd
  scripts\start-integrated-system.bat
  ```
- **Features**: 
  - Basic port checking
  - Health check monitoring
  - Simple process management

### Unix/Linux/WSL
- **File**: `start-integrated-system.sh`
- **Usage**: 
  ```bash
  chmod +x scripts/start-integrated-system.sh
  ./scripts/start-integrated-system.sh
  ```
- **Features**: 
  - Port availability checking
  - Health check monitoring
  - Signal handling for cleanup

## Configuration

All scripts support environment variables for customization:

### PowerShell Parameters
```powershell
.\scripts\start-integrated-system.ps1 `
  -FinanceBuddyPath "." `
  -FinanceMatePath "Finance-mate/backend" `
  -FinanceBuddyPort 3000 `
  -FinanceMateHttpPort 3001 `
  -FinanceMateHttpsPort 3002 `
  -HealthCheckTimeout 60
```

### Environment Variables (All Scripts)
```bash
# Paths
FINANCEBUDDY_PATH=.
FINANCEMATE_PATH=Finance-mate/backend

# Ports
FINANCEBUDDY_PORT=3000
FINANCEMATE_HTTP_PORT=3001
FINANCEMATE_HTTPS_PORT=3002

# Timeouts
HEALTH_CHECK_TIMEOUT=60
```

## What the Scripts Do

1. **Validate Directories** (Requirement 3.1)
   - Check if FinanceBuddy directory exists with package.json
   - Check if Finance-mate directory exists with package.json

2. **Check Port Availability** (Requirement 3.6)
   - Verify ports 3000, 3001, 3002 are available
   - Suggest alternative ports if conflicts detected

3. **Start FinanceBuddy** (Requirement 3.2)
   - Start FinanceBuddy with `npm run dev`
   - Wait for health check at http://localhost:3000/health

4. **Start Finance-mate** (Requirement 3.3)
   - Start Finance-mate with `npm start` after FinanceBuddy is ready
   - Configure HTTP (3001) and HTTPS (3002) ports

5. **Display Status** (Requirement 3.4)
   - Show system status and access URLs
   - Display integration readiness

6. **Monitor and Cleanup** (Requirement 3.5)
   - Monitor both processes
   - Gracefully shutdown on Ctrl+C
   - Handle unexpected process exits

## Expected Output

```
=== Finance-mate Integration Startup ===
Starting integrated system with FinanceBuddy and Finance-mate...

Step 1: Validating project directories...
✓ FinanceBuddy directory validated: .
✓ Finance-mate directory validated: Finance-mate/backend

Step 2: Checking port availability...
✓ All ports are available

Step 3: Starting FinanceBuddy...
✓ FinanceBuddy started (PID: 12345)

Step 4: Waiting for FinanceBuddy to be ready...
✓ Health check passed!

Step 5: Starting Finance-mate...
✓ Finance-mate started (PID: 12346)

Step 6: Integration startup complete!

=== SYSTEM STATUS ===
✓ FinanceBuddy: Running on port 3000 (PID: 12345)
✓ Finance-mate: Running on ports 3001/3002 (PID: 12346)

=== ACCESS URLS ===
FinanceBuddy:     http://localhost:3000
Finance-mate:     http://localhost:3001
Finance-mate SSL: https://localhost:3002

=== INTEGRATION STATUS ===
✓ Systems started in correct order
✓ Health checks passed
✓ Integration ready for use

Press Ctrl+C to stop both systems
```

## Troubleshooting

### Port Conflicts
If you see port conflict warnings:
```
Port 3000 is in use for FinanceBuddy
Suggested alternative port: 3010
Use: -FinanceBuddyPort 3010
```

### Directory Not Found
Ensure you're running the script from the correct directory:
```
cd /path/to/FinanceBuddy
.\scripts\start-integrated-system.ps1
```

### Health Check Timeout
If FinanceBuddy takes longer to start:
```powershell
.\scripts\start-integrated-system.ps1 -HealthCheckTimeout 120
```

### Permission Issues (Unix/Linux)
Make the script executable:
```bash
chmod +x scripts/start-integrated-system.sh
```

## Requirements Fulfilled

- ✅ **3.1**: Check if both project directories exist at specified paths
- ✅ **3.2**: Start FinanceBuddy and wait for health check at http://localhost:3000/health
- ✅ **3.3**: Start Finance-mate on ports 3001 (HTTP) and 3002 (HTTPS) after FinanceBuddy is ready
- ✅ **3.4**: Display access URLs and integration status
- ✅ **3.5**: Gracefully terminate both systems on Ctrl+C
- ✅ **3.6**: Suggest alternative ports if port conflicts are detected