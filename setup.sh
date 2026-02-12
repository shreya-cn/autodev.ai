#!/bin/bash

# AutoDev AI - Complete Setup Script
# Run this before starting the backend or frontend

set -e  # Exit on any error

echo "🚀 AutoDev AI Setup Starting..."
echo "================================"

# Check if running from correct directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found. Please run this script from the repo root."
    exit 1
fi

# 1. Install Python Dependencies
echo ""
echo "📦 Installing Python dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
echo "✅ Python dependencies installed"

# 2. Set up Node dependencies (if autodev-ui exists)
if [ -d "autodev-ui" ]; then
    echo ""
    echo "📦 Installing Node dependencies..."
    cd autodev-ui
    if [ ! -d "node_modules" ]; then
        npm install
    else
        npm install --save
    fi
    cd ..
    echo "✅ Node dependencies installed"
fi

# 3. Verify .env file
echo ""
echo "🔐 Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Please create one with required credentials."
    echo "   Required variables:"
    echo "   - JIRA_URL / JIRA_BASE"
    echo "   - JIRA_USERNAME / JIRA_EMAIL"
    echo "   - JIRA_API_TOKEN"
    echo "   - CONFLUENCE_URL"
    echo "   - CONFLUENCE_USER"
    echo "   - CONFLUENCE_API_TOKEN"
    echo "   - OPENAI_API_KEY"
else
    echo "✅ .env file found"
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Backend:  python3 support_ticket_api.py"
echo "  2. Frontend: cd autodev-ui && npm run dev"
