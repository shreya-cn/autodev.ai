#!/bin/bash
# Install Git Hooks for Jira Ticket Management
# This script installs the git hooks into your .git/hooks directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$SCRIPT_DIR/../.git/hooks"

# Check if we're in a git repository
if [ ! -d "$SCRIPT_DIR/../.git" ]; then
    echo "Error: Not a git repository"
    exit 1
fi

echo "Installing Jira ticket management git hooks..."

# Make hook scripts executable
chmod +x "$SCRIPT_DIR/post-checkout"
chmod +x "$SCRIPT_DIR/post-commit"

# Create symlinks in .git/hooks
ln -sf "../../git-hooks/post-checkout" "$GIT_HOOKS_DIR/post-checkout"
ln -sf "../../git-hooks/post-commit" "$GIT_HOOKS_DIR/post-commit"

echo "✓ Installed post-checkout hook"
echo "✓ Installed post-commit hook"
echo ""
echo "Hooks installed successfully!"
echo "Jira tickets will now be automatically updated when you:"
echo "  - Switch branches (post-checkout)"
echo "  - Make commits (post-commit)"
echo ""
echo "Make sure to configure Jira credentials in .env file:"
echo "  JIRA_URL=https://your-domain.atlassian.net"
echo "  JIRA_USER=your-email@example.com"
echo "  JIRA_API_TOKEN=your-api-token"
