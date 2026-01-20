#!/usr/bin/env python3
"""
Jira Ticket Manager
Automatically updates Jira ticket status based on git branch activity.
"""

import os
import subprocess
import re
import requests
from typing import Optional, Dict, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Jira Configuration
JIRA_URL = os.getenv("JIRA_URL", "https://autodev-ai.atlassian.net")
JIRA_USER = os.getenv("JIRA_USER", os.getenv("CONFLUENCE_USER"))
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", os.getenv("CONFLUENCE_API_TOKEN"))

# Jira transition mappings (these IDs may vary per project)
TRANSITION_MAPPING = {
    "in_progress": {"name": "In Progress", "id": None},
    "in_review": {"name": "Review", "id": None},
    "done": {"name": "Done", "id": None}
}


class JiraTicketManager:
    """Manages Jira ticket status updates based on git workflow."""
    
    def __init__(self):
        self.jira_url = JIRA_URL
        self.jira_user = JIRA_USER
        self.jira_token = JIRA_API_TOKEN
        self.session = requests.Session()
        self.session.auth = (self.jira_user, self.jira_token)
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json"
        })
    
    def validate_credentials(self) -> bool:
        """Validate Jira credentials."""
        if not all([self.jira_url, self.jira_user, self.jira_token]):
            print("Error: Missing Jira credentials in .env file")
            print("Required: JIRA_URL, JIRA_USER, JIRA_API_TOKEN")
            return False
        
        try:
            response = self.session.get(f"{self.jira_url}/rest/api/3/myself")
            if response.status_code == 200:
                print(f"✓ Connected to Jira as {response.json().get('displayName')}")
                return True
            else:
                print(f"Error: Failed to authenticate with Jira (Status: {response.status_code})")
                return False
        except Exception as e:
            print(f"Error connecting to Jira: {e}")
            return False
    
    def get_current_branch(self) -> Optional[str]:
        """Get the current git branch name."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            print("Error: Not a git repository or git not available")
            return None
    
    def extract_ticket_key(self, branch_name: str) -> Optional[str]:
        """
        Extract Jira ticket key from branch name.
        Supports patterns like: feature/PROJ-123-description, PROJ-456, bugfix/PROJ-789
        """
        # Common Jira ticket pattern: PROJECT-NUMBER
        pattern = r'([A-Z]{2,10}-\d+)'
        match = re.search(pattern, branch_name, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return None
    
    def get_ticket_info(self, ticket_key: str) -> Optional[Dict]:
        """Get ticket information from Jira."""
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_key}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                assignee = "Unassigned"
                if data.get("fields") and data["fields"].get("assignee"):
                    assignee = data["fields"]["assignee"].get("displayName", "Unassigned")
                
                return {
                    "key": data["key"],
                    "summary": data["fields"]["summary"],
                    "status": data["fields"]["status"]["name"],
                    "assignee": assignee
                }
            elif response.status_code == 404:
                print(f"Error: Ticket {ticket_key} not found")
                return None
            else:
                print(f"Error: Failed to fetch ticket {ticket_key} (Status: {response.status_code})")
                print(f"Response: {response.text}")
                return None
        except Exception as e:
            print(f"Error fetching ticket info: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_available_transitions(self, ticket_key: str) -> List[Dict]:
        """Get available transitions for a ticket."""
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_key}/transitions"
            response = self.session.get(url)
            
            if response.status_code == 200:
                return response.json().get("transitions", [])
            else:
                print(f"Error: Failed to fetch transitions (Status: {response.status_code})")
                return []
        except Exception as e:
            print(f"Error fetching transitions: {e}")
            return []
    
    def transition_ticket(self, ticket_key: str, transition_name: str) -> bool:
        """Transition a ticket to a new status."""
        # Get available transitions
        transitions = self.get_available_transitions(ticket_key)
        
        if not transitions:
            print(f"Error: No transitions available for {ticket_key}")
            return False
        
        # Find the matching transition
        transition_id = None
        for trans in transitions:
            if trans["name"].lower() == transition_name.lower() or \
               trans["to"]["name"].lower() == transition_name.lower():
                transition_id = trans["id"]
                break
        
        if not transition_id:
            available = [f"{t['name']} -> {t['to']['name']}" for t in transitions]
            print(f"Error: Transition '{transition_name}' not available for {ticket_key}")
            print(f"Available transitions: {', '.join(available)}")
            return False
        
        # Execute transition
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_key}/transitions"
            payload = {"transition": {"id": transition_id}}
            response = self.session.post(url, json=payload)
            
            if response.status_code == 204:
                print(f"✓ Ticket {ticket_key} transitioned to '{transition_name}'")
                return True
            else:
                print(f"Error: Failed to transition ticket (Status: {response.status_code})")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"Error transitioning ticket: {e}")
            return False
    
    def check_branch_status(self) -> str:
        """
        Determine the status based on git branch and PR state.
        Returns: 'in_progress', 'in_review', or 'done'
        """
        branch = self.get_current_branch()
        
        if not branch:
            return None
        
        # Check if branch is merged (exists in main/master but not locally)
        try:
            # Check if current branch is main/master
            if branch in ['main', 'master', 'develop']:
                return 'done'
            
            # Check if there are any commits ahead/behind
            subprocess.run(["git", "fetch", "origin"], capture_output=True)
            
            # Check if branch exists on remote (indicating a PR might exist)
            result = subprocess.run(
                ["git", "ls-remote", "--heads", "origin", branch],
                capture_output=True,
                text=True
            )
            
            if result.stdout.strip():
                # Branch exists remotely - likely in review
                return 'in_review'
            else:
                # Branch only local - in progress
                return 'in_progress'
                
        except Exception:
            # Default to in_progress if we can't determine
            return 'in_progress'
    
    def auto_update_ticket(self) -> bool:
        """Automatically update ticket based on current git state."""
        branch = self.get_current_branch()
        
        if not branch:
            return False
        
        print(f"Current branch: {branch}")
        
        # Extract ticket key
        ticket_key = self.extract_ticket_key(branch)
        
        if not ticket_key:
            print("No Jira ticket found in branch name")
            print("Expected format: feature/PROJ-123-description or PROJ-123")
            return False
        
        print(f"Found ticket: {ticket_key}")
        
        # Get ticket info
        ticket_info = self.get_ticket_info(ticket_key)
        
        if not ticket_info:
            return False
        
        print(f"Ticket: {ticket_info['key']} - {ticket_info['summary']}")
        print(f"Current status: {ticket_info['status']}")
        print(f"Assignee: {ticket_info['assignee']}")
        
        # Determine desired status
        desired_status = self.check_branch_status()
        
        if not desired_status:
            return False
        
        status_names = {
            'in_progress': 'In Progress',
            'in_review': 'Review',
            'done': 'Done'
        }
        
        target_status = status_names.get(desired_status)
        print(f"Target status: {target_status}")
        
        # Check if already in desired status
        if ticket_info['status'].lower() == target_status.lower():
            print(f"✓ Ticket already in '{target_status}' status")
            return True
        
        # Transition ticket
        return self.transition_ticket(ticket_key, target_status)
    
    def manual_update_ticket(self, ticket_key: str, status: str) -> bool:
        """Manually update a ticket to a specific status."""
        print(f"Manually updating ticket {ticket_key} to '{status}'")
        
        # Get ticket info
        ticket_info = self.get_ticket_info(ticket_key)
        
        if not ticket_info:
            return False
        
        print(f"Current status: {ticket_info['status']}")
        
        # Transition ticket
        return self.transition_ticket(ticket_key, status)
    
    def get_all_open_tickets(self, project_key: str = 'KAN') -> List[Dict]:
        """Get all open tickets from a specific project (default: KAN)."""
        try:
            # JQL query to get open tickets from specific project
            jql = f'project = {project_key} AND status != Done AND status != Closed ORDER BY updated DESC'
            
            # Use the new API endpoint
            url = f"{self.jira_url}/rest/api/3/search/jql"
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            payload = {
                'jql': jql,
                'maxResults': 100,
                'fields': ['summary', 'status', 'assignee', 'priority', 'issuetype', 'updated', 'created']
            }
            
            response = self.session.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                tickets = []
                
                for issue in data.get('issues', []):
                    fields = issue.get('fields', {})
                    assignee_name = "Unassigned"
                    
                    if fields.get('assignee'):
                        assignee_name = fields['assignee'].get('displayName', 'Unassigned')
                    
                    priority_name = "Medium"
                    if fields.get('priority'):
                        priority_name = fields['priority'].get('name', 'Medium')
                    
                    tickets.append({
                        'id': issue['id'],
                        'key': issue['key'],
                        'summary': fields.get('summary', 'No summary'),
                        'status': fields.get('status', {}).get('name', 'Unknown'),
                        'assignee': assignee_name,
                        'priority': priority_name,
                        'type': fields.get('issuetype', {}).get('name', 'Task'),
                        'updated': fields.get('updated', ''),
                        'created': fields.get('created', '')
                    })
                
                # Only print to stderr to avoid polluting JSON output
                import sys
                print(f"✓ Fetched {len(tickets)} open tickets from project {project_key}", file=sys.stderr)
                return tickets
            else:
                print(f"Error: Failed to fetch tickets (Status: {response.status_code})")
                print(f"Response: {response.text}")
                return []
                
        except Exception as e:
            print(f"Error fetching all tickets: {e}")
            import traceback
            traceback.print_exc()
            return []


def main():
    """Main entry point for the script."""
    import sys
    
    manager = JiraTicketManager()
    
    # Validate credentials
    if not manager.validate_credentials():
        sys.exit(1)
    
    # Check if manual mode
    if len(sys.argv) > 1:
        if len(sys.argv) < 3:
            print("Usage: python3 jira_ticket_manager.py <TICKET-KEY> <STATUS>")
            print("Example: python3 jira_ticket_manager.py PROJ-123 'In Progress'")
            sys.exit(1)
        
        ticket_key = sys.argv[1]
        status = sys.argv[2]
        success = manager.manual_update_ticket(ticket_key, status)
    else:
        # Auto mode - update based on current branch
        print("\n=== Auto-updating ticket based on git branch ===\n")
        success = manager.auto_update_ticket()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
