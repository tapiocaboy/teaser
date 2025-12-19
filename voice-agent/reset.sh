#!/bin/bash

# ============================================
# Reset Script for Construction Site Voice Agent
# Removes all data and reinitializes databases
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${RED}========================================${NC}"
echo -e "${RED}  Reset Construction Site Voice Agent${NC}"
echo -e "${RED}========================================${NC}"

# Confirmation prompt
echo -e "\n${RED}WARNING: This will delete ALL data including:${NC}"
echo -e "  - All worker records"
echo -e "  - All manager records"
echo -e "  - All daily updates"
echo -e "  - All query history"
echo -e "  - All audio files"
echo -e "  - All conversation history"
echo ""

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "\n${YELLOW}Reset cancelled.${NC}"
    exit 0
fi

echo -e "\n${YELLOW}Stopping services if running...${NC}"
"$SCRIPT_DIR/stop.sh" 2>/dev/null || true

echo -e "\n${CYAN}Removing database files...${NC}"

# Remove SQLite databases
if [ -d "$BACKEND_DIR/data" ]; then
    echo -e "  Removing: $BACKEND_DIR/data/*.db"
    rm -f "$BACKEND_DIR/data"/*.db
    echo -e "  ${GREEN}Database files removed${NC}"
else
    echo -e "  ${YELLOW}No data directory found${NC}"
fi

# Remove audio files
if [ -d "$BACKEND_DIR/data/audio" ]; then
    echo -e "  Removing audio files: $BACKEND_DIR/data/audio/*"
    rm -rf "$BACKEND_DIR/data/audio"/*
    echo -e "  ${GREEN}Audio files removed${NC}"
fi

# Remove logs
if [ -d "$SCRIPT_DIR/logs" ]; then
    echo -e "  Removing log files: $SCRIPT_DIR/logs/*"
    rm -f "$SCRIPT_DIR/logs"/*.log
    echo -e "  ${GREEN}Log files removed${NC}"
fi

# Remove PID files
if [ -d "$SCRIPT_DIR/.pids" ]; then
    echo -e "  Removing PID files: $SCRIPT_DIR/.pids/*"
    rm -f "$SCRIPT_DIR/.pids"/*.pid
    echo -e "  ${GREEN}PID files removed${NC}"
fi

echo -e "\n${CYAN}Reinitializing database...${NC}"

# Ensure data directory exists
mkdir -p "$BACKEND_DIR/data"
mkdir -p "$BACKEND_DIR/data/audio"
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/.pids"

# Initialize database by running a quick Python script
cd "$BACKEND_DIR"

echo -e "  Creating fresh database tables..."

poetry run python -c "
from app.database.models import init_database
import os

# Initialize the database (creates tables)
db_path = os.path.join(os.getcwd(), 'data', 'conversations.db')
init_database(f'sqlite:///{db_path}')
print(f'  Database initialized: {db_path}')
"

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}Database reinitialized successfully${NC}"
else
    echo -e "  ${RED}Failed to reinitialize database${NC}"
    exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Reset Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nThe system has been reset to a clean state."
echo -e "Run ${YELLOW}./start.sh${NC} to start the servers."

