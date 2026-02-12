#!/bin/bash

# AutoDev AI - Full Stack Startup Script
# Ensures all dependencies are installed and starts backend + frontend

set -e

echo "🚀 AutoDev AI - Full Stack Startup"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ Error: requirements.txt not found${NC}"
    echo "Please run this script from the repo root directory"
    exit 1
fi

# 1. Check Python
echo "🔍 Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo -e "${GREEN}✅ Python ${PYTHON_VERSION} found${NC}"

# 2. Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet -r requirements.txt 2>/dev/null || {
    echo -e "${RED}❌ Failed to install Python dependencies${NC}"
    exit 1
}
echo -e "${GREEN}✅ Python dependencies installed${NC}"

# 3. Check .env
echo ""
echo "🔐 Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "   Create .env with required credentials before continuing"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ .env file found${NC}"

# 4. Check Node (optional)
if [ -d "autodev-ui" ]; then
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js not found. Frontend will not start.${NC}"
        SKIP_FRONTEND=true
    else
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✅ Node ${NODE_VERSION} found${NC}"
    fi
fi

echo ""
echo "===================================="
echo "✅ All checks passed! Starting services..."
echo ""

# 5. Start Backend
echo -e "${YELLOW}▶️  Starting Backend (port 5000)...${NC}"
cd "$(dirname "$0")"
python3 support_ticket_api.py &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
sleep 3

# 6. Start Frontend (if Node is available)
if [ "$SKIP_FRONTEND" != "true" ] && [ -d "autodev-ui" ]; then
    echo ""
    echo -e "${YELLOW}▶️  Starting Frontend (port 3000)...${NC}"
    cd autodev-ui
    npm install --quiet 2>/dev/null
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
fi

echo ""
echo "===================================="
echo -e "${GREEN}🎉 Services Started!${NC}"
echo ""
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait indefinitely
wait
