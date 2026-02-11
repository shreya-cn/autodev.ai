"""
GitHub Code Impact Analyzer
Analyzes GitHub repo to find recently changed files and developer expertise
"""

import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import subprocess
import re
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_REPO = os.getenv('GITHUB_REPO', 'valtech/autodev.ai')


class GitHubAnalyzer:
    """Analyzes GitHub repo for code changes and developer expertise"""

    def __init__(self, repo_path: str = "."):
        self.repo_path = repo_path
        self.commits_cache = {}

    def get_recent_changes(self, days: int = 7, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get recently changed files in the repo
        
        Args:
            days: Number of days to look back
            limit: Maximum number of commits to return
            
        Returns:
            List of changed files with metadata
        """
        
        print(f"📂 Scanning recent changes in last {days} days...")
        
        try:
            # Get commits from last N days
            since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            
            cmd = f'cd "{self.repo_path}" && git log --since="{since_date}" --name-status --format="%H|%an|%ae|%ai|%s" -n {limit}'
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"⚠️ Git command failed: {result.stderr}")
                return []
            
            commits = self._parse_git_log(result.stdout)
            return commits
            
        except Exception as e:
            print(f"⚠️ Error scanning changes: {e}")
            return []

    def _parse_git_log(self, git_output: str) -> List[Dict[str, Any]]:
        """Parse git log output"""
        commits = []
        lines = git_output.strip().split('\n')
        
        current_commit = None
        for line in lines:
            if '|' in line and line.count('|') >= 4:
                # This is a commit header
                if current_commit and current_commit.get('files'):
                    commits.append(current_commit)
                
                parts = line.split('|')
                current_commit = {
                    'hash': parts[0][:8],
                    'author': parts[1],
                    'email': parts[2],
                    'date': parts[3],
                    'message': parts[4] if len(parts) > 4 else '',
                    'files': []
                }
            elif current_commit and line.strip():
                # This is a file change (M/A/D/etc)
                if len(line) > 2:
                    status = line[0]
                    filename = line[2:].strip()
                    if filename:
                        current_commit['files'].append({
                            'status': status,
                            'name': filename
                        })
        
        if current_commit and current_commit.get('files'):
            commits.append(current_commit)
        
        return commits

    def get_developer_expertise(self, days: int = 90) -> Dict[str, Dict[str, Any]]:
        """
        Analyze developer expertise based on commit history
        
        Args:
            days: Number of days to analyze
            
        Returns:
            Dictionary of {developer: {files: [...], commits: N, specialties: [...]}}
        """
        
        print(f"👨‍💻 Analyzing developer expertise (last {days} days)...")
        
        expertise = {}
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            cmd = f'cd "{self.repo_path}" && git log --since="{since_date}" --name-status --format="%an|%ae" -n 500'
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"⚠️ Git command failed: {result.stderr}")
                return expertise
            
            lines = result.stdout.strip().split('\n')
            current_dev = None
            
            for line in lines:
                if '|' in line and not line.startswith('M') and not line.startswith('A'):
                    # Developer line
                    parts = line.split('|')
                    current_dev = parts[0].strip()
                    
                    if current_dev not in expertise:
                        expertise[current_dev] = {
                            'files': {},
                            'commits': 0,
                            'specialties': []
                        }
                    
                    expertise[current_dev]['commits'] += 1
                    
                elif current_dev and line.strip() and (line[0] in ['M', 'A', 'D']):
                    # File change
                    filename = line[2:].strip()
                    if filename:
                        if filename not in expertise[current_dev]['files']:
                            expertise[current_dev]['files'][filename] = 0
                        expertise[current_dev]['files'][filename] += 1
            
            # Calculate specialties
            for dev in expertise:
                files = expertise[dev]['files']
                if files:
                    # Get top areas
                    areas = {}
                    for filename, count in files.items():
                        # Extract directory/area
                        parts = filename.split('/')
                        if len(parts) > 1:
                            area = f"{parts[0]}/{parts[1]}" if len(parts) > 1 else parts[0]
                        else:
                            area = filename.split('.')[0]
                        
                        if area not in areas:
                            areas[area] = 0
                        areas[area] += count
                    
                    # Top specialties
                    sorted_areas = sorted(areas.items(), key=lambda x: x[1], reverse=True)
                    expertise[dev]['specialties'] = [area for area, _ in sorted_areas[:3]]
                    expertise[dev]['top_files'] = list(sorted(
                        files.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:5])
            
            print(f"✅ Found expertise for {len(expertise)} developers")
            return expertise
            
        except Exception as e:
            print(f"⚠️ Error analyzing expertise: {e}")
            return expertise

    def find_related_commits(self, keywords: List[str], days: int = 30, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Find commits related to keywords
        
        Args:
            keywords: List of keywords to search for
            days: Number of days to search
            limit: Maximum results
            
        Returns:
            List of related commits
        """
        
        related = []
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            
            for keyword in keywords:
                cmd = f'cd "{self.repo_path}" && git log --since="{since_date}" --grep="{keyword}" --format="%H|%an|%ai|%s" -n {limit}'
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                
                if result.returncode == 0 and result.stdout.strip():
                    for line in result.stdout.strip().split('\n'):
                        if '|' in line:
                            parts = line.split('|')
                            related.append({
                                'hash': parts[0][:8],
                                'author': parts[1],
                                'date': parts[2],
                                'message': parts[3] if len(parts) > 3 else '',
                                'keyword': keyword
                            })
            
            return related[:limit]
            
        except Exception as e:
            print(f"⚠️ Error finding related commits: {e}")
            return related

    def get_git_blame(self, filepath: str, lines: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Get git blame info for specific file/lines
        
        Args:
            filepath: Path to file
            lines: Optional list of line numbers to check
            
        Returns:
            List of blame entries with author, date, commit message
        """
        
        blame_info = []
        
        try:
            cmd = f'cd "{self.repo_path}" && git blame -l "{filepath}"'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"⚠️ Could not get blame for {filepath}")
                return []
            
            blame_lines = result.stdout.strip().split('\n')
            
            for line_num, line in enumerate(blame_lines, 1):
                # Skip if specific lines requested and this isn't one
                if lines and line_num not in lines:
                    continue
                
                if line.strip():
                    # Parse blame output: hash author date ... code
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        blame_info.append({
                            'line': line_num,
                            'raw': line,
                            'info': parts[0] if parts else '',
                            'code': parts[1] if len(parts) > 1 else ''
                        })
            
            return blame_info
            
        except Exception as e:
            print(f"⚠️ Error getting blame: {e}")
            return []

    def find_similar_error_fixes(self, error_message: str, days: int = 90) -> List[Dict[str, Any]]:
        """
        Search commit history for similar error fixes
        
        Args:
            error_message: Error message or keyword to search for
            days: How far back to search
            
        Returns:
            List of commits that may have fixed similar issues
        """
        
        keywords = [
            "fix", "bug", "error", "issue", "crash",
            error_message.split()[0] if error_message else ""
        ]
        
        return self.find_related_commits([k for k in keywords if k], days=days)


def format_github_analysis(
    recent_changes: List[Dict],
    developer_expertise: Dict[str, Dict],
    related_commits: List[Dict]
) -> str:
    """Format GitHub analysis for JIRA comment"""
    
    html = """
<h2>🔗 GitHub Code Analysis</h2>

<h3>📝 Recently Changed Files (Last 7 Days)</h3>
<ul>
"""
    
    # Group by file
    files_changed = {}
    for commit in recent_changes:
        for file_change in commit.get('files', []):
            filename = file_change['name']
            if filename not in files_changed:
                files_changed[filename] = []
            files_changed[filename].append({
                'author': commit['author'],
                'date': commit['date'],
                'message': commit['message']
            })
    
    for filename, changes in sorted(files_changed.items())[:10]:
        html += f"""    <li>
        <code>{filename}</code>
        <br/><small>Changed by {changes[-1]['author']} on {changes[-1]['date'][:10]}</small>
    </li>
"""
    
    html += """
</ul>

<h3>👨‍💻 Developer Expertise</h3>
<table border="1" style="border-collapse: collapse; width: 100%;">
    <tr style="background-color: #f5f5f5;">
        <th style="padding: 8px;">Developer</th>
        <th style="padding: 8px;">Specialties</th>
        <th style="padding: 8px;">Commits</th>
    </tr>
"""
    
    for dev, info in sorted(developer_expertise.items(), key=lambda x: x[1]['commits'], reverse=True)[:5]:
        specialties = ", ".join(info.get('specialties', [])[:2])
        html += f"""    <tr>
        <td style="padding: 8px;"><strong>{dev}</strong></td>
        <td style="padding: 8px;"><code>{specialties or 'General'}</code></td>
        <td style="padding: 8px;"><strong>{info.get('commits', 0)}</strong></td>
    </tr>
"""
    
    html += """
</table>

<h3>🔍 Similar Past Issues (Commits with 'fix' keyword)</h3>
<ul>
"""
    
    for commit in related_commits[:3]:
        html += f"""    <li>
        <strong>{commit['message']}</strong>
        <br/><small>by {commit['author']} on {commit['date'][:10]}</small>
    </li>
"""
    
    html += """
</ul>
"""
    
    return html


# Example usage
if __name__ == "__main__":
    analyzer = GitHubAnalyzer(repo_path="/Users/harshithar/Documents/Valtech/Global-Hackathon(P)/autodev.ai")
    
    # Get recent changes
    recent = analyzer.get_recent_changes(days=7, limit=20)
    print(f"\n📝 Recent changes: {len(recent)} commits")
    
    # Get developer expertise
    expertise = analyzer.get_developer_expertise(days=30)
    print(f"👨‍💻 Developers analyzed: {len(expertise)}")
    
    # Find similar fixes
    related = analyzer.find_related_commits(["auth", "bug"], days=30)
    print(f"🔍 Related commits: {len(related)}")
    
    # Format output
    formatted = format_github_analysis(recent, expertise, related)
    print("\n" + formatted)
