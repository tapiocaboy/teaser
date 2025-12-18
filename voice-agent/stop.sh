#!/bin/bash

# ============================================
# Stop Script for Construction Site Voice Agent
# Stops both backend and frontend servers
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Stopping Construction Site Voice Agent${NC}"
echo -e "${YELLOW}========================================${NC}"

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="$PID_DIR/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "\n${YELLOW}Stopping $service_name (PID: $PID)...${NC}"
            
            # Try graceful shutdown first
            kill -TERM "$PID" 2>/dev/null
            
            # Wait up to 10 seconds for graceful shutdown
            for i in {1..10}; do
                if ! kill -0 "$PID" 2>/dev/null; then
                    break
                fi
                sleep 1
                echo -n "."
            done
            echo ""
            
            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                echo -e "${YELLOW}Force stopping $service_name...${NC}"
                kill -9 "$PID" 2>/dev/null
                sleep 1
            fi
            
            if ! kill -0 "$PID" 2>/dev/null; then
                echo -e "${GREEN}$service_name stopped successfully${NC}"
            else
                echo -e "${RED}Failed to stop $service_name${NC}"
            fi
        else
            echo -e "${YELLOW}$service_name is not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}$service_name PID file not found${NC}"
    fi
}

# Stop Frontend first
stop_service "frontend"

# Stop Backend
stop_service "backend"

# Also kill any remaining processes on the ports
echo -e "\n${YELLOW}Cleaning up any remaining processes...${NC}"

# Kill processes on port 8000 (backend)
BACKEND_PORT_PID=$(lsof -ti:8000 2>/dev/null)
if [ -n "$BACKEND_PORT_PID" ]; then
    echo -e "Killing process on port 8000: $BACKEND_PORT_PID"
    kill -9 $BACKEND_PORT_PID 2>/dev/null
fi

# Kill processes on port 3000 (frontend)
FRONTEND_PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ -n "$FRONTEND_PORT_PID" ]; then
    echo -e "Killing process on port 3000: $FRONTEND_PORT_PID"
    kill -9 $FRONTEND_PORT_PID 2>/dev/null
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  All services stopped${NC}"
echo -e "${GREEN}========================================${NC}"

