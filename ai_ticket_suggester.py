#!/usr/bin/env python3
"""
AI-Powered Ticket Suggestion System
Uses hybrid approach: Pattern matching + AI reasoning
"""

import os
import subprocess
import json
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
JIRA_URL = os.getenv("JIRA_URL", "https://autodev-ai.atlassian.net")
JIRA_USER = os.getenv("JIRA_USER", os.getenv("CONFLUENCE_USER"))
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", os.getenv("CONFLUENCE_API_TOKEN"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REPORT_DIR = Path(__file__).parent / "related-tickets-reports"


class AITicketSuggester:
    """AI-powered ticket suggestion based on code changes."""
    
    def __init__(self):
        self.jira_url = JIRA_URL
        self.jira_user = JIRA_USER
        self.jira_token = JIRA_API_TOKEN
        self.openai_key = OPENAI_API_KEY
        self.session = requests.Session()
        self.session.auth = (self.jira_user, self.jira_token)
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json"
        })
        
        # Create report directory
        REPORT_DIR.mkdir(exist_ok=True)
    
    def get_recent_commits(self, limit: int = 5) -> List[Dict]:
        """Get recent commit information."""
        try:
            result = subprocess.run(
                ["git", "log", f"-{limit}", "--pretty=format:%H|%s|%an|%ad", "--date=short"],
                capture_output=True,
                text=True,
                check=True
            )
            
            commits = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    hash_val, subject, author, date = line.split('|', 3)
                    commits.append({
                        "hash": hash_val,
                        "subject": subject,
                        "author": author,
                        "date": date
                    })
            return commits
        except Exception as e:
            print(f"Error getting commits: {e}")
            return []
    
    def get_changed_files(self, commit_hash: Optional[str] = None) -> List[str]:
        """Get list of changed files in recent commits."""
        try:
            if commit_hash:
                cmd = ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", commit_hash]
            else:
                # Try to get files changed in last 5 commits, fall back to fewer if needed
                for num_commits in [5, 3, 1]:
                    try:
                        cmd = ["git", "diff", "--name-only", f"HEAD~{num_commits}..HEAD"]
                        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                        files = [f for f in result.stdout.strip().split('\n') if f]
                        if files:
                            return files
                    except:
                        continue
                
                # If still no files, get files in current commit
                cmd = ["git", "diff", "--name-only", "HEAD^..HEAD"]
                result = subprocess.run(cmd, capture_output=True, text=True)
                files = [f for f in result.stdout.strip().split('\n') if f]
                
                # If still nothing, get all tracked files
                if not files:
                    cmd = ["git", "ls-files"]
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    files = [f for f in result.stdout.strip().split('\n') if f][:20]
                
                return files
        except Exception as e:
            print(f"Error getting changed files: {e}")
            return []
    
    def get_commit_diff(self, commit_hash: str, max_lines: int = 100) -> str:
        """Get simplified diff for a commit."""
        try:
            result = subprocess.run(
                ["git", "show", "--stat", commit_hash],
                capture_output=True,
                text=True,
                check=True
            )
            lines = result.stdout.split('\n')
            return '\n'.join(lines[:max_lines])
        except Exception as e:
            return f"Error getting diff: {e}"
    
    def search_jira_tickets(self, jql: str, max_results: int = 50) -> List[Dict]:
        """Search Jira tickets using JQL."""
        try:
            url = f"{self.jira_url}/rest/api/3/search/jql"
            
            # POST request with JQL in body
            payload = {
                "jql": jql,
                "maxResults": max_results,
                "fields": ["key", "summary", "description", "status", "assignee", "labels", "components"]
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                tickets = []
                for issue in data.get("issues", []):
                    assignee_name = "Unassigned"
                    if issue["fields"].get("assignee"):
                        assignee_name = issue["fields"]["assignee"].get("displayName", "Unassigned")
                    
                    # Extract description from ADF format
                    description = issue["fields"].get("description", "")
                    description = self.extract_text_from_adf(description)
                    
                    tickets.append({
                        "key": issue["key"],
                        "summary": issue["fields"]["summary"],
                        "description": description,
                        "status": issue["fields"]["status"]["name"],
                        "assignee": assignee_name,
                        "labels": issue["fields"].get("labels", []),
                        "components": [c["name"] for c in issue["fields"].get("components", [])]
                    })
                return tickets
            else:
                print(f"Error searching tickets: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Error in Jira search: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_all_open_tickets(self, exclude_ticket: Optional[str] = None) -> List[Dict]:
        """Get all open tickets from Jira."""
        # JQL to get open tickets (not Done)
        jql = 'status != Done AND status != Closed'
        
        if exclude_ticket:
            jql += f' AND key != {exclude_ticket}'
        
        return self.search_jira_tickets(jql)
    
    def extract_text_from_adf(self, adf_content) -> str:
        """Extract plain text from Atlassian Document Format (ADF)."""
        if isinstance(adf_content, str):
            return adf_content
        
        if not isinstance(adf_content, dict):
            return ""
        
        text_parts = []
        
        def extract_recursive(node):
            if isinstance(node, dict):
                # If it's a text node, get the text
                if node.get('type') == 'text':
                    text_parts.append(node.get('text', ''))
                
                # Recursively process content
                if 'content' in node:
                    for child in node['content']:
                        extract_recursive(child)
            elif isinstance(node, list):
                for item in node:
                    extract_recursive(item)
        
        extract_recursive(adf_content)
        return ' '.join(text_parts)
    
    def get_ticket_info(self, ticket_key: str) -> Optional[Dict]:
        """Get detailed information for a specific ticket."""
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_key}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                assignee_name = "Unassigned"
                if data["fields"].get("assignee"):
                    assignee_name = data["fields"]["assignee"].get("displayName", "Unassigned")
                
                # Extract description from ADF format
                description = data["fields"].get("description", "")
                description = self.extract_text_from_adf(description)
                
                return {
                    "key": data["key"],
                    "summary": data["fields"]["summary"],
                    "description": description,
                    "status": data["fields"]["status"]["name"],
                    "assignee": assignee_name,
                    "labels": data["fields"].get("labels", []),
                    "components": [c["name"] for c in data["fields"].get("components", [])]
                }
            return None
        except Exception as e:
            print(f"Error getting ticket {ticket_key}: {e}")
            return None
    
    def extract_description_snippet(self, description: str, keyword: str, max_length: int = 100) -> str:
        """Extract a meaningful snippet from description around the keyword."""
        if not description or not keyword:
            return ""
        
        desc_lower = description.lower()
        keyword_lower = keyword.lower()
        
        # Find keyword position
        pos = desc_lower.find(keyword_lower)
        if pos == -1:
            return ""
        
        # Get surrounding context
        start = max(0, pos - 40)
        end = min(len(description), pos + len(keyword) + 60)
        
        # Try to break at sentence or word boundaries
        snippet = description[start:end].strip()
        
        # Clean up the snippet
        if start > 0:
            # Find first space to avoid cutting words
            first_space = snippet.find(' ')
            if first_space > 0:
                snippet = snippet[first_space:].strip()
        
        # Limit length and add ellipsis
        if len(snippet) > max_length:
            snippet = snippet[:max_length].rsplit(' ', 1)[0] + "..."
        
        return snippet
    
    def pattern_match_tickets(self, changed_files: List[str], all_tickets: List[Dict], current_ticket_info: Optional[Dict] = None) -> List[Dict]:
        """Pattern matching: Find tickets that might be related based on keywords, file paths, and current ticket."""
        candidates = []
        
        # Extract keywords from file paths
        file_keywords = set()
        for file_path in changed_files:
            parts = file_path.replace('/', ' ').replace('_', ' ').replace('-', ' ').replace('.', ' ').split()
            file_keywords.update(p.lower() for p in parts if len(p) > 2)
        
        # Extract keywords from current ticket's summary and description
        ticket_keywords = set()
        if current_ticket_info:
            # From summary
            summary_parts = current_ticket_info['summary'].replace('-', ' ').replace('_', ' ').split()
            ticket_keywords.update(p.lower() for p in summary_parts if len(p) > 3)
            
            # From description
            desc = current_ticket_info.get('description', '')
            if isinstance(desc, str) and desc:
                desc_parts = desc.replace('-', ' ').replace('_', ' ').split()
                ticket_keywords.update(p.lower() for p in desc_parts if len(p) > 3)
        
        # Combine all keywords
        all_keywords = file_keywords | ticket_keywords
        
        # Score each ticket
        for ticket in all_tickets:
            score = 0
            reasons = []
            description_snippets = []
            
            # Check description first (highest priority)
            desc = ticket.get('description', '')
            if isinstance(desc, str) and desc:
                desc_lower = desc.lower()
                for keyword in all_keywords:
                    if keyword in desc_lower:
                        score += 5 if keyword in ticket_keywords else 3
                        # Extract contextual snippet instead of just keyword
                        snippet = self.extract_description_snippet(desc, keyword)
                        if snippet and snippet not in description_snippets:
                            description_snippets.append(snippet)
            
            # Use first meaningful description snippet as reason
            if description_snippets:
                reasons.append(description_snippets[0])
            
            # Check summary for keywords (lower priority)
            summary_lower = ticket['summary'].lower()
            for keyword in all_keywords:
                if keyword in summary_lower:
                    score += 2 if keyword in ticket_keywords else 1
                    if not reasons:  # Only use summary if no description snippet
                        reasons.append(f"Related to: {ticket['summary']}")
            
            # Check labels and components
            for label in ticket.get('labels', []):
                if label.lower() in all_keywords:
                    score += 4
                    reasons.append(f"matching label '{label}'")
            
            for component in ticket.get('components', []):
                if component.lower() in all_keywords:
                    score += 4
                    reasons.append(f"matching component '{component}'")
            
            if score > 0:
                ticket['match_score'] = score
                ticket['match_reasons'] = reasons[:3]  # Top 3 reasons
                candidates.append(ticket)
        
        # Sort by score and return top candidates
        candidates.sort(key=lambda x: x['match_score'], reverse=True)
        return candidates[:10]  # Top 10 candidates for AI analysis
    
    def ai_analyze_relevance(self, current_ticket: str, changed_files: List[str], 
                            commit_summary: str, candidate_tickets: List[Dict]) -> List[Dict]:
        """Use AI to analyze and rank candidate tickets."""
        if not self.openai_key:
            print("Warning: OpenAI API key not found, skipping AI analysis")
            return candidate_tickets[:5]
        
        if not candidate_tickets:
            return []
        
        try:
            import openai
            openai.api_key = self.openai_key
            
            # Prepare context
            files_str = '\n'.join(f"  - {f}" for f in changed_files[:20])
            candidates_str = '\n'.join(
                f"  {i+1}. {t['key']}: {t['description']} (Status: {t['status']})"
                for i, t in enumerate(candidate_tickets[:10])
            )
            
            prompt = f"""You are analyzing Jira tickets to find related work.

Current Ticket: {current_ticket}

Recent Code Changes:
{files_str}

Recent Commit Summary:
{commit_summary}

Candidate Related Tickets:
{candidates_str}

Task: Analyze which tickets are most related to the current work. For each relevant ticket:
1. Assign a relevance score (0-100)
2. Provide a complete sentence explaining why it's related, rephrasing key information from the ticket description. The reason should clearly explain what the ticket is about and how it relates to the current work.

Return ONLY a JSON array of the top 5 most relevant tickets in this exact format:
[
  {{"ticket": "KEY-123", "score": 85, "reason": "This ticket addresses authentication improvements which relates to the current login flow changes"}},
  {{"ticket": "KEY-456", "score": 72, "reason": "This ticket implements user profile updates that share similar database schema modifications"}}
]

Return empty array [] if no tickets are related."""

            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that analyzes software development tasks and identifies related work."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            ai_response = response.choices[0].message.content.strip()
            
            # Parse JSON response
            # Remove markdown code blocks if present
            if "```json" in ai_response:
                ai_response = ai_response.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_response:
                ai_response = ai_response.split("```")[1].split("```")[0].strip()
            
            ai_suggestions = json.loads(ai_response)
            
            # Merge AI scores with ticket data and filter by relevance threshold
            results = []
            for suggestion in ai_suggestions:
                # Skip tickets with less than 60% relevance
                if suggestion['score'] < 60:
                    continue
                    
                ticket_key = suggestion['ticket']
                # Find the full ticket data
                for ticket in candidate_tickets:
                    if ticket['key'] == ticket_key:
                        results.append({
                            'key': ticket['key'],
                            'summary': ticket['summary'],
                            'status': ticket['status'],
                            'score': suggestion['score'],
                            'ai_reason': suggestion['reason']
                        })
                        break
            
            return results
            
        except Exception as e:
            print(f"Error in AI analysis: {e}")
            # Fallback to pattern matching results, filter by 60% threshold
            return [{
                'key': t['key'],
                'summary': t['summary'],
                'status': t['status'],
                'score': min(t['match_score'] * 10, 100),
                'ai_reason': ', '.join(t['match_reasons'][:2])
            } for t in candidate_tickets[:5] if min(t['match_score'] * 10, 100) >= 60]
    
    def generate_daily_report(self, current_ticket: str, suggestions: List[Dict]) -> str:
        """Generate a markdown report with ticket suggestions."""
        today = datetime.now().strftime("%Y-%m-%d")
        report_file = REPORT_DIR / f"related-tickets-{today}.md"
        
        # Read existing report if it exists
        existing_content = ""
        if report_file.exists():
            with open(report_file, 'r') as f:
                existing_content = f.read()
        
        # Prepare new entry
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        new_entry = f"\n## 🎫 {current_ticket} - {timestamp}\n\n"
        
        if suggestions:
            new_entry += "### 🔍 AI-Suggested Related Tickets:\n\n"
            for i, suggestion in enumerate(suggestions, 1):
                score = suggestion.get('score', 0)
                new_entry += f"{i}. **[{suggestion['key']}]({self.jira_url}/browse/{suggestion['key']})** "
                new_entry += f"- {suggestion['summary']}\n"
                new_entry += f"   - 📊 Relevance: {score}%\n"
                new_entry += f"   - 📋 Status: {suggestion['status']}\n"
                new_entry += f"   - 💡 Reason: {suggestion['ai_reason']}\n\n"
        else:
            new_entry += "*No related tickets found.*\n\n"
        
        new_entry += "---\n"
        
        # Create or update report
        if not existing_content:
            # New report
            content = f"# 📊 Related Tickets Report - {today}\n\n"
            content += f"*Generated by AI Ticket Suggester*\n\n"
            content += new_entry
        else:
            # Append to existing
            content = existing_content + new_entry
        
        # Write report
        with open(report_file, 'w') as f:
            f.write(content)
        
        return str(report_file)
    
    def suggest_related_tickets(self, current_ticket: str) -> List[Dict]:
        """Main function: Suggest related tickets using hybrid approach."""
        print(f"\n🔍 Analyzing related tickets for {current_ticket}...")
        
        # Step 1: Get current ticket info
        current_ticket_info = self.get_ticket_info(current_ticket)
        if current_ticket_info:
            print(f"📋 Current: {current_ticket_info['summary']}")
        
        # Step 2: Get code changes
        changed_files = self.get_changed_files()
        commits = self.get_recent_commits(limit=3)
        
        if not changed_files:
            print("ℹ️  No recent code changes found (this is normal for new branches)")
            # Even without code changes, we can find similar tickets based on description
            changed_files = []
        
        if changed_files:
            print(f"📁 Analyzing {len(changed_files)} changed files...")
        
        # Step 3: Get all open tickets
        all_tickets = self.get_all_open_tickets(exclude_ticket=current_ticket)
        print(f"🎫 Found {len(all_tickets)} open tickets in Jira")
        
        if not all_tickets:
            print("ℹ️  No other open tickets found")
            return []
        
        # Step 4: Pattern matching to narrow down candidates (now includes current ticket description)
        candidates = self.pattern_match_tickets(changed_files, all_tickets, current_ticket_info)
        
        if not candidates:
            print("ℹ️  No matching tickets found (your work appears independent)")
            return []
        
        print(f"🔍 Pattern matching found {len(candidates)} candidate tickets")
        
        # Step 5: AI analysis for final ranking
        commit_summary = '\n'.join(f"- {c['subject']}" for c in commits)
        suggestions = self.ai_analyze_relevance(
            current_ticket, 
            changed_files, 
            commit_summary, 
            candidates
        )
        
        if suggestions:
            print(f"✅ AI analysis completed: {len(suggestions)} related tickets identified")
        else:
            print("ℹ️  AI found no strongly related tickets")
        
        # Step 6: Generate daily report
        report_path = self.generate_daily_report(current_ticket, suggestions)
        
        return suggestions


def main():
    """Main entry point."""
    import sys
    
    suggester = AITicketSuggester()
    
    if len(sys.argv) > 1:
        ticket_key = sys.argv[1]
    else:
        # Try to extract from current branch
        from jira_ticket_manager import JiraTicketManager
        manager = JiraTicketManager()
        branch = manager.get_current_branch()
        ticket_key = manager.extract_ticket_key(branch) if branch else None
        
        if not ticket_key:
            print("Error: No ticket key provided and couldn't extract from branch")
            print("Usage: python3 ai_ticket_suggester.py TICKET-KEY")
            sys.exit(1)
    
    suggestions = suggester.suggest_related_tickets(ticket_key)
    
    if suggestions:
        print(f"\n📋 Top {len(suggestions)} Related Tickets:")
        for i, s in enumerate(suggestions, 1):
            print(f"{i}. {s['key']} - {s['summary']} ({s['score']}% match)")
            print(f"   Reason: {s['ai_reason']}")


if __name__ == "__main__":
    main()
