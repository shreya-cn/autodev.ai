# 🤖 AI-Powered Related Ticket Suggester

Automatically finds related Jira tickets using **Hybrid AI Approach**: Pattern Matching + GPT-4 Analysis

## ✨ Features

- **Smart Pattern Matching**: Analyzes your code changes and finds tickets with matching keywords
- **AI Reasoning**: Uses GPT-4 to intelligently rank and explain ticket relationships
- **Daily Reports**: Generates markdown reports in `related-tickets-reports/` folder
- **Auto-Integration**: Runs automatically after git commits via hooks

## 🚀 How It Works

### Hybrid 3-Step Process:

1. **📁 Code Analysis**
   - Extracts changed files from recent commits
   - Identifies keywords from file paths and names

2. **🔍 Pattern Matching**  
   - Searches all open Jira tickets
   - Matches based on:
     - Keywords in ticket summary
     - Keywords in ticket description
     - Matching labels/components
   - Narrows down to top 10 candidates

3. **🧠 AI Analysis**
   - GPT-4 analyzes the top candidates
   - Provides relevance scores (0-100%)
   - Explains WHY each ticket is related
   - Returns top 5 most relevant tickets

## 📊 Output Format

### Daily Report Example
Located in: `related-tickets-reports/related-tickets-YYYY-MM-DD.md`

```markdown
# 📊 Related Tickets Report - 2025-12-30

## 🎫 KAN-4 - 14:30:00

### 🔍 AI-Suggested Related Tickets:

1. **[KAN-2](https://autodev-ai.atlassian.net/browse/KAN-2)** - User authentication refactor
   - 📊 Relevance: 85%
   - 📋 Status: In Progress
   - 💡 Reason: Both modify authentication logic in auth/login.py

2. **[KAN-7](https://autodev-ai.atlassian.net/browse/KAN-7)** - SSO integration
   - 📊 Relevance: 72%
   - 📋 Status: To Do
   - 💡 Reason: Related authentication changes, may have dependencies
```

## 💻 Usage

### Automatic (via Git Hooks)

Already installed! After any commit:

```bash
git commit -m "implement feature X"

✓ Ticket KAN-4 updated to 'In Progress'
🤖 Analyzing related tickets...
✅ Report generated: related-tickets-reports/related-tickets-2025-12-30.md
```

### Manual Run

```bash
# For current branch
python3 ai_ticket_suggester.py

# For specific ticket
python3 ai_ticket_suggester.py KAN-123
```

## 🎯 Example Workflow

```bash
# 1. Working on KAN-4: task management feature
git checkout -b feature/KAN-4

# 2. Make changes to task-related files
# Files: task_manager.py, task_service.py, etc.

# 3. Commit changes
git commit -m "add task assignment logic"

# 4. AI automatically:
#    - Updates KAN-4 status
#    - Analyzes code changes
#    - Finds KAN-2 (task filters) is related (similar files)
#    - Finds KAN-5 (task UI) is related (same feature area)
#    - Generates report with 85% and 68% match scores
```

## 📁 File Structure

```
autodev.ai/
├── ai_ticket_suggester.py       # Main AI suggester
├── jira_ticket_manager.py       # Ticket status updater
├── git-hooks/
│   ├── post-commit              # Auto-runs after commits
│   └── post-checkout            # Auto-runs when switching branches
└── related-tickets-reports/     # Generated reports
    └── related-tickets-2025-12-30.md
```

## 🔧 Configuration

All settings are in `.env`:

```env
# Required
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
OPENAI_API_KEY=your-openai-api-key

# Optional (for Confluence integration)
CONFLUENCE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
```

## 🎓 How AI Makes Suggestions

### Example AI Prompt:
```
Current Ticket: KAN-4 (task management)
Changed Files: task_manager.py, task_service.py
Commits: "add task assignment logic"

Candidates:
1. KAN-2: User management refactor
2. KAN-5: Task UI improvements
3. KAN-7: Database optimization

AI Analysis:
- KAN-5 (85%): Both work on task features, likely overlapping code
- KAN-2 (45%): Different area, but task assignment needs user data
- KAN-7 (20%): Unrelated, different component
```

## 🛠️ Troubleshooting

### No related tickets found

**Reasons:**
- No code changes detected (branch just created)
- File names don't match ticket keywords
- All other tickets are closed/done

**Solution:**
Make some commits first, then run manually:
```bash
python3 ai_ticket_suggester.py KAN-4
```

### AI analysis skipped

**Reason:** OpenAI API key not configured

**Solution:**
Add to `.env`:
```env
OPENAI_API_KEY=sk-...
```

### Pattern matching found 0 candidates

**Reason:** Your file changes don't match any ticket keywords

**This is normal!** It means your work is independent. The report will show:
```
*No related tickets found.*
```

## 📈 Benefits

1. **Avoid Duplicate Work**: See if someone else is working on related code
2. **Identify Dependencies**: Find tickets that might affect your work
3. **Better Collaboration**: Team sees related work through reports
4. **Knowledge Discovery**: Learn about related features you didn't know about

## 🚦 Status Indicators

- 🟢 **80-100%**: Highly related, definitely check it out
- 🟡 **60-79%**: Possibly related, worth reviewing
- 🟠 **40-59%**: Loosely related, optional
- ⚪ **< 40%**: Filtered out (not shown)

## 🔄 How Often Reports Are Generated

- **After every commit** (via post-commit hook)
- **Manual runs** anytime
- **One report per day** (appends to same file)
- Each ticket analysis gets a timestamped entry

## 📝 Tips

1. **Use descriptive file names** - Better keyword matching
2. **Add labels to tickets** - Improves matching accuracy  
3. **Review reports daily** - Check `related-tickets-reports/`
4. **Share with team** - Commit reports to git or post to Slack

## 🎯 Advanced: Customize AI Prompt

Edit `ai_analyze_relevance()` in `ai_ticket_suggester.py` to adjust:
- Relevance threshold
- Number of suggestions
- AI model (gpt-4o-mini, gpt-4, etc.)
- Temperature (creativity level)

## 🤝 Integration with Existing Workflow

Works seamlessly with:
- ✅ Automatic ticket status updates
- ✅ Git hooks
- ✅ Confluence documentation
- ✅ Your existing branching strategy

No changes needed to your current process!

---

**Created by:** Sharan R  
**Last Updated:** Dec 30, 2025
