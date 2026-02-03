# Jira Ticket Management

Automatically update Jira ticket status based on git workflow.

## Features

- **Automatic Status Updates**: Tickets are automatically transitioned based on branch activity
  - Working on a branch → **In Progress**
  - Branch pushed to remote → **In Review**
  - Branch merged to main → **Done**

- **Manual Updates**: Update tickets manually via command line
- **Git Hooks**: Automatically trigger updates on git operations
- **Branch Name Detection**: Extracts ticket keys from branch names (e.g., `feature/PROJ-123-description`)

## Setup

### 1. Configure Jira Credentials

Add these to your `.env` file:

```env
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

Or if using Confluence credentials (as fallback):
```env
CONFLUENCE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
```

### 2. Get Your Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "Git Ticket Manager")
4. Copy the token and add it to `.env`

### 3. Install Git Hooks (Optional but Recommended)

```bash
cd git-hooks
chmod +x install_hooks.sh
./install_hooks.sh
```

This will automatically update tickets when you:
- Switch branches
- Make commits

## Usage

### Automatic Mode

When git hooks are installed, tickets update automatically. Or run manually:

```bash
python3 jira_ticket_manager.py
```

This will:
1. Detect the current branch
2. Extract the Jira ticket key (e.g., `PROJ-123`)
3. Determine the appropriate status based on branch state
4. Update the ticket in Jira

### Manual Mode

Update a specific ticket to a specific status:

```bash
python3 jira_ticket_manager.py PROJ-123 "In Progress"
python3 jira_ticket_manager.py PROJ-456 "In Review"
python3 jira_ticket_manager.py PROJ-789 "Done"
```

## Branch Naming Convention

The ticket manager expects branch names to contain Jira ticket keys:

✅ **Supported formats:**
- `feature/PROJ-123-add-new-feature`
- `bugfix/PROJ-456-fix-bug`
- `PROJ-789`
- `hotfix/PROJ-999-critical-fix`

❌ **Not supported:**
- `feature/add-new-feature` (no ticket key)
- `my-branch` (no ticket key)

## How It Works

### Status Detection Logic

1. **In Progress**: Branch exists locally but not on remote
2. **In Review**: Branch exists on remote (assumes PR created)
3. **Done**: Working on main/master/develop branch (assumes merged)

### Workflow Example

```bash
# 1. Create feature branch
git checkout -b feature/PROJ-123-new-feature
# → Ticket automatically moves to "In Progress"

# 2. Push branch (create PR)
git push origin feature/PROJ-123-new-feature
# → Ticket automatically moves to "In Review"

# 3. After PR approval, merge to main
git checkout main
git merge feature/PROJ-123-new-feature
# → Ticket automatically moves to "Done"
```

## Troubleshooting

### Error: Missing Jira credentials

Make sure `.env` file contains:
- `JIRA_URL` (or `CONFLUENCE_URL`)
- `JIRA_USER` (or `CONFLUENCE_USER`)
- `JIRA_API_TOKEN` (or `CONFLUENCE_API_TOKEN`)

### Error: Ticket not found

- Verify the ticket key exists in Jira
- Check your branch name contains the correct ticket key format
- Ensure you have permission to view the ticket

### Error: Transition not available

- The target status might not be available from the current status
- Check your Jira workflow configuration
- Some transitions may require specific permissions

### Manual Testing

Test the connection:

```bash
python3 jira_ticket_manager.py
```

Check available transitions for a ticket (edit the script temporarily to debug).

## Files

- `jira_ticket_manager.py` - Main ticket management script
- `git-hooks/post-checkout` - Hook triggered when switching branches
- `git-hooks/post-commit` - Hook triggered after commits
- `git-hooks/install_hooks.sh` - Installation script for git hooks
- `README_TICKET_MANAGEMENT.md` - This file

## Requirements

- Python 3.6+
- `requests` library
- `python-dotenv` library

Install dependencies:
```bash
pip3 install requests python-dotenv
```

## Customization

### Modify Status Mappings

Edit `TRANSITION_MAPPING` in `jira_ticket_manager.py`:

```python
TRANSITION_MAPPING = {
    "in_progress": {"name": "In Progress", "id": None},
    "in_review": {"name": "Code Review", "id": None},  # Custom status name
    "done": {"name": "Closed", "id": None}  # Custom status name
}
```

### Modify Detection Logic

Edit the `check_branch_status()` method in `JiraTicketManager` class to customize how statuses are determined based on git state.
