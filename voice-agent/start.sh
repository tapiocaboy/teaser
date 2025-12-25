#!/bin/bash

# ============================================
# Start Script for SpyCho Security Operations
# Starts both backend and frontend servers
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/.pids"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}========================================${NC}"
echo -e "${RED}  SPYCHO - Security Operations Platform${NC}"
echo -e "${RED}========================================${NC}"
echo -e "${BLUE}  Initializing Systems...${NC}"

# Create PID directory if it doesn't exist
mkdir -p "$PID_DIR"

# Check if already running
if [ -f "$PID_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$PID_DIR/backend.pid")
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${YELLOW}Backend already operational (PID: $BACKEND_PID)${NC}"
    else
        rm "$PID_DIR/backend.pid"
    fi
fi

if [ -f "$PID_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${YELLOW}Frontend already operational (PID: $FRONTEND_PID)${NC}"
    else
        rm "$PID_DIR/frontend.pid"
    fi
fi

# Start Backend
if [ ! -f "$PID_DIR/backend.pid" ]; then
    echo -e "\n${GREEN}Initializing Backend Services...${NC}"
    cd "$BACKEND_DIR"
    
    # Check if poetry is available
    if ! command -v poetry &> /dev/null; then
        echo -e "${RED}Error: poetry is not installed${NC}"
        exit 1
    fi
    
    # Start backend with poetry
    nohup poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$PID_DIR/backend.pid"
    echo -e "${GREEN}Backend services online (PID: $BACKEND_PID)${NC}"
    echo -e "  → API Endpoint: http://localhost:8000"
    echo -e "  → Documentation: http://localhost:8000/docs"
    echo -e "  → Logs: $SCRIPT_DIR/logs/backend.log"
fi

# Wait for backend to be ready
echo -e "\n${YELLOW}Establishing secure connection...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}Backend connection established!${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start Frontend
if [ ! -f "$PID_DIR/frontend.pid" ]; then
    echo -e "\n${GREEN}Initializing Frontend Interface...${NC}"
    cd "$FRONTEND_DIR"
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed${NC}"
        exit 1
    fi
    
    # Start frontend
    nohup npm start > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PID_DIR/frontend.pid"
    echo -e "${GREEN}Frontend interface online (PID: $FRONTEND_PID)${NC}"
    echo -e "  → Operations Console: http://localhost:3000"
    echo -e "  → Logs: $SCRIPT_DIR/logs/frontend.log"
fi

echo -e "\n${RED}========================================${NC}"
echo -e "${RED}  All Systems Operational${NC}"
echo -e "${RED}========================================${NC}"
echo -e "\nAccess SpyCho at: ${GREEN}http://localhost:3000${NC}"
echo -e "To shutdown systems, run: ${YELLOW}./stop.sh${NC}"
