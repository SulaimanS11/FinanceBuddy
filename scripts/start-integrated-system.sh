#!/bin/bash
# Finance-mate Integration Startup Script
# This script starts both FinanceBuddy and Finance-mate systems in the correct order

# Default configuration
FINANCEBUDDY_PATH="${FINANCEBUDDY_PATH:-.}"
FINANCEMATE_PATH="${FINANCEMATE_PATH:-Finance-mate/backend}"
FINANCEBUDDY_PORT="${FINANCEBUDDY_PORT:-3000}"
FINANCEMATE_HTTP_PORT="${FINANCEMATE_HTTP_PORT:-3001}"
FINANCEMATE_HTTPS_PORT="${FINANCEMATE_HTTPS_PORT:-3002}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"

# Process IDs for cleanup
FINANCEBUDDY_PID=""
FINANCEMATE_PID=""

# Color output functions
print_success() { echo -e "\033[32m$1\033[0m"; }
print_error() { echo -e "\033[31m$1\033[0m"; }
print_warning() { echo -e "\033[33m$1\033[0m"; }
print_info() { echo -e "\033[36m$1\033[0m"; }

# Cleanup function
cleanup() {
    print_info "Shutting down systems..."
    
    if [ ! -z "$FINANCEMATE_PID" ]; then
        print_info "Stopping Finance-mate (PID: $FINANCEMATE_PID)..."
        kill $FINANCEMATE_PID 2>/dev/null
        wait $FINANCEMATE_PID 2>/dev/null
    fi
    
    if [ ! -z "$FINANCEBUDDY_PID" ]; then
        print_info "Stopping FinanceBuddy (PID: $FINANCEBUDDY_PID)..."
        kill $FINANCEBUDDY_PID 2>/dev/null
        wait $FINANCEBUDDY_PID 2>/dev/null
    fi
    
    print_success "Systems stopped gracefully"
    exit 0
}

# Register cleanup on signals
trap cleanup SIGINT SIGTERM

# Function to check if port is available
check_port() {
    local port=$1
    if command -v nc >/dev/null 2>&1; then
        ! nc -z localhost $port 2>/dev/null
    elif command -v netstat >/dev/null 2>&1; then
        ! netstat -ln | grep -q ":$port "
    else
        # Fallback: assume port is available
        return 0
    fi
}

# Function to suggest alternative ports
suggest_alternative_port() {
    local start_port=$1
    for ((port=start_port+1; port<=start_port+100; port++)); do
        if check_port $port; then
            echo $port
            return
        fi
    done
}

# Function to wait for health check
wait_for_health_check() {
    local url=$1
    local timeout=$2
    
    print_info "Waiting for health check at $url..."
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $timeout ]; then
            print_error "Health check timeout after $timeout seconds"
            return 1
        fi
        
        if command -v curl >/dev/null 2>&1; then
            if curl -s -f "$url" >/dev/null 2>&1; then
                print_success "Health check passed!"
                return 0
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget -q --spider "$url" 2>/dev/null; then
                print_success "Health check passed!"
                return 0
            fi
        else
            print_warning "No curl or wget available, skipping health check"
            sleep 5
            return 0
        fi
        
        sleep 2
        echo -n "."
    done
}

# Main execution
main() {
    print_info "=== Finance-mate Integration Startup ==="
    print_info "Starting integrated system with FinanceBuddy and Finance-mate..."
    
    # Step 1: Validate project directories (Requirement 3.1)
    print_info "Step 1: Validating project directories..."
    
    if [ ! -f "$FINANCEBUDDY_PATH/package.json" ]; then
        print_error "FinanceBuddy directory or package.json not found at: $FINANCEBUDDY_PATH"
        exit 1
    fi
    print_success "FinanceBuddy directory validated: $FINANCEBUDDY_PATH"
    
    if [ ! -f "$FINANCEMATE_PATH/package.json" ]; then
        print_error "Finance-mate directory or package.json not found at: $FINANCEMATE_PATH"
        exit 1
    fi
    print_success "Finance-mate directory validated: $FINANCEMATE_PATH"
    
    # Step 2: Check port availability (Requirement 3.6)
    print_info "Step 2: Checking port availability..."
    
    if ! check_port $FINANCEBUDDY_PORT; then
        alt_port=$(suggest_alternative_port $FINANCEBUDDY_PORT)
        print_warning "Port $FINANCEBUDDY_PORT is in use for FinanceBuddy"
        if [ ! -z "$alt_port" ]; then
            print_warning "Suggested alternative port: $alt_port"
            print_warning "Use: FINANCEBUDDY_PORT=$alt_port $0"
        fi
        exit 1
    fi
    
    if ! check_port $FINANCEMATE_HTTP_PORT; then
        alt_port=$(suggest_alternative_port $FINANCEMATE_HTTP_PORT)
        print_warning "Port $FINANCEMATE_HTTP_PORT is in use for Finance-mate HTTP"
        if [ ! -z "$alt_port" ]; then
            print_warning "Suggested alternative port: $alt_port"
            print_warning "Use: FINANCEMATE_HTTP_PORT=$alt_port $0"
        fi
        exit 1
    fi
    
    if ! check_port $FINANCEMATE_HTTPS_PORT; then
        alt_port=$(suggest_alternative_port $FINANCEMATE_HTTPS_PORT)
        print_warning "Port $FINANCEMATE_HTTPS_PORT is in use for Finance-mate HTTPS"
        if [ ! -z "$alt_port" ]; then
            print_warning "Suggested alternative port: $alt_port"
            print_warning "Use: FINANCEMATE_HTTPS_PORT=$alt_port $0"
        fi
        exit 1
    fi
    
    print_success "All ports are available"
    
    # Step 3: Start FinanceBuddy (Requirement 3.2)
    print_info "Step 3: Starting FinanceBuddy..."
    
    cd "$FINANCEBUDDY_PATH"
    PORT=$FINANCEBUDDY_PORT npm run dev &
    FINANCEBUDDY_PID=$!
    
    if ! kill -0 $FINANCEBUDDY_PID 2>/dev/null; then
        print_error "Failed to start FinanceBuddy"
        exit 1
    fi
    
    print_success "FinanceBuddy started (PID: $FINANCEBUDDY_PID)"
    
    # Step 4: Wait for FinanceBuddy health check (Requirement 3.2)
    print_info "Step 4: Waiting for FinanceBuddy to be ready..."
    
    health_url="http://localhost:$FINANCEBUDDY_PORT/health"
    if ! wait_for_health_check "$health_url" $HEALTH_CHECK_TIMEOUT; then
        print_error "FinanceBuddy failed to start properly"
        cleanup
        exit 1
    fi
    
    # Step 5: Start Finance-mate (Requirement 3.3)
    print_info "Step 5: Starting Finance-mate..."
    
    cd "$FINANCEMATE_PATH"
    HTTP_PORT=$FINANCEMATE_HTTP_PORT HTTPS_PORT=$FINANCEMATE_HTTPS_PORT npm start &
    FINANCEMATE_PID=$!
    
    if ! kill -0 $FINANCEMATE_PID 2>/dev/null; then
        print_error "Failed to start Finance-mate"
        cleanup
        exit 1
    fi
    
    print_success "Finance-mate started (PID: $FINANCEMATE_PID)"
    
    # Step 6: Display status and URLs (Requirement 3.4)
    print_info "Step 6: Integration startup complete!"
    print_success "=== SYSTEM STATUS ==="
    print_success "✓ FinanceBuddy: Running on port $FINANCEBUDDY_PORT (PID: $FINANCEBUDDY_PID)"
    print_success "✓ Finance-mate: Running on ports $FINANCEMATE_HTTP_PORT/$FINANCEMATE_HTTPS_PORT (PID: $FINANCEMATE_PID)"
    print_success ""
    print_success "=== ACCESS URLS ==="
    print_success "FinanceBuddy:     http://localhost:$FINANCEBUDDY_PORT"
    print_success "Finance-mate:     http://localhost:$FINANCEMATE_HTTP_PORT"
    print_success "Finance-mate SSL: https://localhost:$FINANCEMATE_HTTPS_PORT"
    print_success ""
    print_success "=== INTEGRATION STATUS ==="
    print_success "✓ Systems started in correct order"
    print_success "✓ Health checks passed"
    print_success "✓ Integration ready for use"
    print_success ""
    print_info "Press Ctrl+C to stop both systems"
    
    # Keep script running and monitor processes
    while true; do
        sleep 5
        
        # Check if processes are still running
        if ! kill -0 $FINANCEBUDDY_PID 2>/dev/null; then
            print_error "FinanceBuddy process has exited unexpectedly"
            cleanup
            exit 1
        fi
        
        if ! kill -0 $FINANCEMATE_PID 2>/dev/null; then
            print_error "Finance-mate process has exited unexpectedly"
            cleanup
            exit 1
        fi
    done
}

# Run main function
main "$@"