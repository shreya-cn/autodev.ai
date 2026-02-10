# AutoDoc.AI Automation Setup Guide

Automatically regenerate documentation when Java code changes.

---

## 🎯 Three Automation Options

### Option 1: File Watcher (Recommended for Development) ⭐

**Best for:** Active development, real-time updates

#### Setup:

```bash
# 1. Install file watching dependency
cd autodoc-ai-mcp-server
npm install chokidar --save

# 2. Start the watcher
node watch-and-regenerate.js all

# Or watch a specific microservice:
node watch-and-regenerate.js identityprovider
```

#### How it works:
- ✅ Watches all `.java` files in microservices
- ✅ Auto-regenerates documentation 5 seconds after changes stop
- ✅ Debounces multiple rapid changes
- ✅ Shows real-time progress
- ✅ Updates Knowledge Base Q&A immediately

#### Usage:

```bash
# Terminal 1: Run the watcher
cd autodoc-ai-mcp-server
node watch-and-regenerate.js all

# Terminal 2: Run your Next.js app
cd autodev-ui
npm run dev

# Terminal 3: Make code changes
vim identityprovider/src/main/java/com/vm/identityprovider/controller/UserController.java

# Automatically:
# - Watcher detects change
# - Waits 5 seconds for more changes
# - Regenerates documentation
# - Updates .adoc files
# - Knowledge Base Q&A uses new docs!
```

---

### Option 2: Git Pre-Commit Hook (Recommended for Team)

**Best for:** Ensuring documentation is always in sync with code

#### Setup:

```bash
# 1. Install the hook
cd /path/to/autodev.ai
chmod +x git-hooks/pre-commit
ln -sf "$(pwd)/git-hooks/pre-commit" .git/hooks/pre-commit

# Test the hook
echo "Test hook installed successfully"
```

#### How it works:
- ✅ Runs automatically on `git commit`
- ✅ Detects which microservices changed
- ✅ Regenerates only affected service docs
- ✅ Auto-stages updated .adoc files
- ✅ Includes docs in the same commit

#### Usage:

```bash
# Edit Java code
vim identityprovider/src/main/java/.../UserController.java

# Commit your changes
git add identityprovider/src/main/java/.../UserController.java
git commit -m "feat: Add user registration endpoint"

# Hook automatically:
# 1. Detects Java changes in identityprovider
# 2. Regenerates documentation
# 3. Stages .adoc files
# 4. Includes docs in commit

# Skip hook if needed:
git commit --no-verify -m "WIP: Incomplete changes"
```

---

### Option 3: Manual Regeneration (Current)

**Best for:** One-off updates, troubleshooting

#### Usage:

```bash
cd autodoc-ai-mcp-server

# Regenerate specific service
node mcp-launcher.js identityprovider

# Regenerate all services
node mcp-launcher.js all
```

---

## 🚀 Recommended Setup for Development

### Step 1: Install Dependencies

```bash
cd autodoc-ai-mcp-server
npm install chokidar --save
```

### Step 2: Start Services

```bash
# Terminal 1: Documentation Watcher
cd autodoc-ai-mcp-server
node watch-and-regenerate.js all

# Terminal 2: Next.js Development Server
cd autodev-ui
npm run dev
```

### Step 3: Develop Normally

- Edit Java code → Documentation auto-updates
- Ask questions in Knowledge Base → Gets latest docs
- No manual regeneration needed!

---

## 📊 Automation Comparison

| Feature | File Watcher | Git Hook | Manual |
|---------|-------------|----------|--------|
| **Real-time updates** | ✅ Yes (5s delay) | ❌ On commit | ❌ On demand |
| **Automatic** | ✅ Fully automatic | ⚡ Semi-automatic | ❌ Manual |
| **Team sync** | ❌ Local only | ✅ Enforced | ⚠️ Manual |
| **Overhead** | Low (runs in background) | None (only on commit) | None |
| **Best for** | Active development | Production releases | Troubleshooting |

---

## 🔧 Configuration

### File Watcher Settings

Edit `watch-and-regenerate.js`:

```javascript
// Adjust debounce delay (default: 5000ms)
const DEBOUNCE_DELAY = 5000; // 5 seconds

// Add/remove microservices
const MICROSERVICES = [
  'identityprovider', 
  'enrollment', 
  'usermanagement', 
  'vehiclemanagement'
];
```

### Git Hook Settings

Edit `git-hooks/pre-commit`:

```bash
# Skip documentation for certain branches
CURRENT_BRANCH=$(git branch --show-current)
if [[ $CURRENT_BRANCH == "experimental" ]]; then
  echo "⏭️  Skipping documentation on experimental branch"
  exit 0
fi
```

---

## 🎯 Complete Workflow with Automation

### Scenario: Adding a new API endpoint

```bash
# 1. Start file watcher (one time)
cd autodoc-ai-mcp-server
node watch-and-regenerate.js all

# 2. Edit UserController.java
vim identityprovider/src/main/java/.../UserController.java

# Add new endpoint:
@PostMapping("/register")
public User registerUser(@RequestBody User user) {
    return userService.register(user);
}

# 3. Save file
# Watcher automatically:
# - Detects change after 5 seconds
# - Analyzes Java files → Updates classes-summary.json
# - Generates .adoc files with OpenAI
# - Logs success

# 4. Ask in Knowledge Base
# Go to: http://localhost:3000/knowledge-base
# Ask: "How does user registration work?"
# Response includes your NEW endpoint! ✅

# 5. Commit changes
git add identityprovider/src/main/java/.../UserController.java
git commit -m "feat: Add user registration endpoint"

# Git hook automatically:
# - Regenerates docs (if not using watcher)
# - Stages updated .adoc files
# - Includes in commit
```

---

## 🛠️ Troubleshooting

### Watcher not detecting changes

```bash
# Check if watcher is running
ps aux | grep "watch-and-regenerate"

# Restart watcher
# Press Ctrl+C to stop
node watch-and-regenerate.js all
```

### Git hook not running

```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit

# Should show: -rwxr-xr-x

# If not, make executable:
chmod +x .git/hooks/pre-commit
```

### Documentation not updating

```bash
# Check OpenAI API key
echo $OPENAI_API_KEY

# Test manual regeneration
cd autodoc-ai-mcp-server
node mcp-launcher.js identityprovider

# Check logs for errors
```

---

## 💡 Tips & Best Practices

### 1. Use File Watcher During Development
- Provides instant feedback
- See documentation evolve as you code
- Test Knowledge Base Q&A in real-time

### 2. Use Git Hook for Team Projects
- Ensures docs never get out of sync
- Automatic documentation in every commit
- Reviewers see updated docs in PRs

### 3. Combine Both!
- File watcher for local development
- Git hook as safety net for commits
- Best of both worlds

### 4. Monitor Resource Usage
```bash
# File watcher is lightweight but check if needed:
top -pid $(pgrep -f "watch-and-regenerate")
```

### 5. Customize for Your Workflow
- Adjust debounce delay for your coding speed
- Filter specific file types
- Skip documentation for test files

---

## 🎉 You're All Set!

Your documentation will now stay in sync with your code automatically.

**Next Steps:**
1. Start the file watcher
2. Make code changes
3. Ask questions in Knowledge Base
4. See real-time documentation updates!

**Questions?** Check the main README.md or KNOWLEDGE_BASE_SETUP.md
