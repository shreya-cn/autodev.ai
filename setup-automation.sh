#!/bin/bash

# Quick Setup Script for AutoDoc.AI Automation
# Run this to install the git hook

echo "🚀 AutoDoc.AI Automation Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -d "git-hooks" ]; then
  echo "❌ Error: Run this script from the project root directory"
  exit 1
fi

# Install git hook
echo "📦 Installing Git pre-commit hook..."

if [ -d ".git" ]; then
  ln -sf "$(pwd)/git-hooks/pre-commit" .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ Git hook installed successfully"
else
  echo "⚠️  No .git directory found - Git hook not installed"
fi

echo ""

# Install npm dependencies
echo "📦 Installing file watcher dependencies..."
cd autodoc-ai-mcp-server
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "Option 1: Start File Watcher (Recommended for Development)"
echo "  cd autodoc-ai-mcp-server"
echo "  npm run watch"
echo ""
echo "Option 2: Git Hook is Active (Runs on every commit)"
echo "  Just commit normally - docs will auto-update!"
echo ""
echo "Option 3: Manual Regeneration"
echo "  cd autodoc-ai-mcp-server"
echo "  node mcp-launcher.js identityprovider"
echo ""
echo "📖 Full documentation:"
echo "  cat AUTOMATION_SETUP.md"
echo ""
