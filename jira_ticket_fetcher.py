"""
JIRA Ticket Fetcher
Fetches ticket details from JIRA including description, attachments, and comments
"""

import os
import requests
from requests.auth import HTTPBasicAuth
import json
from typing import Dict, List, Optional
from datetime import datetime
import base64

class JiraTicketFetcher:
    def __init__(self):
        self.jira_url = os.getenv('JIRA_URL', 'https://auto-dev.atlassian.net')
        self.jira_username = os.getenv('JIRA_USERNAME', '')
        self.jira_api_token = os.getenv('JIRA_API_TOKEN', '')
        self.auth = HTTPBasicAuth(self.jira_username, self.jira_api_token)
        
    def fetch_ticket(self, ticket_id: str) -> Dict:
        """
        Fetch a JIRA ticket with all details
        
        Args:
            ticket_id: JIRA ticket ID (e.g., "SUPPORT-123" or "AUT-45")
            
        Returns:
            Dict with ticket details including:
            - summary
            - description
            - attachments (with content if text files)
            - comments
            - reporter
            - priority
            - status
        """
        try:
            # Fetch ticket details
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_id}"
            headers = {
                'Accept': 'application/json'
            }
            
            response = requests.get(url, headers=headers, auth=self.auth)
            
            if response.status_code == 404:
                return {
                    'success': False,
                    'error': f'Ticket {ticket_id} not found'
                }
            elif response.status_code == 401:
                return {
                    'success': False,
                    'error': 'Authentication failed. Check JIRA credentials.'
                }
            elif response.status_code != 200:
                return {
                    'success': False,
                    'error': f'Failed to fetch ticket: {response.status_code}'
                }
            
            issue = response.json()
            fields = issue.get('fields', {})
            
            # Extract ticket details
            ticket_data = {
                'success': True,
                'ticket_id': ticket_id,
                'key': issue.get('key'),
                'summary': fields.get('summary', ''),
                'description': self._extract_description(fields.get('description')),
                'reporter': self._extract_user(fields.get('reporter')),
                'assignee': self._extract_user(fields.get('assignee')),
                'priority': self._extract_priority(fields.get('priority')),
                'status': fields.get('status', {}).get('name', 'Unknown'),
                'created': fields.get('created', ''),
                'updated': fields.get('updated', ''),
                'issue_type': fields.get('issuetype', {}).get('name', 'Unknown'),
                'labels': fields.get('labels', []),
                'attachments': [],
                'comments': [],
                'error_log': ''
            }
            
            # Fetch attachments
            attachments = fields.get('attachment', [])
            ticket_data['attachments'] = self._process_attachments(attachments)
            
            # Extract error logs from attachments
            ticket_data['error_log'] = self._extract_error_logs(ticket_data['attachments'])
            
            # Fetch comments
            comments = fields.get('comment', {}).get('comments', [])
            ticket_data['comments'] = self._process_comments(comments)
            
            return ticket_data
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching ticket: {str(e)}'
            }
    
    def _extract_description(self, description_obj) -> str:
        """Extract plain text from JIRA's ADF (Atlassian Document Format)"""
        if not description_obj:
            return ''
        
        if isinstance(description_obj, str):
            return description_obj
        
        # Handle ADF format
        if isinstance(description_obj, dict):
            return self._parse_adf(description_obj)
        
        return str(description_obj)
    
    def _parse_adf(self, adf_content: Dict) -> str:
        """Parse Atlassian Document Format to plain text"""
        text_parts = []
        
        def extract_text(node):
            if isinstance(node, dict):
                # Handle text nodes
                if node.get('type') == 'text':
                    text_parts.append(node.get('text', ''))
                
                # Handle paragraph, heading, etc.
                if 'content' in node:
                    for child in node['content']:
                        extract_text(child)
                
                # Handle code blocks
                if node.get('type') == 'codeBlock':
                    if 'content' in node:
                        code = ' '.join([c.get('text', '') for c in node['content'] if c.get('type') == 'text'])
                        text_parts.append(f"\n```\n{code}\n```\n")
            
            elif isinstance(node, list):
                for item in node:
                    extract_text(item)
        
        extract_text(adf_content)
        return '\n'.join(text_parts).strip()
    
    def _extract_user(self, user_obj) -> Dict:
        """Extract user information"""
        if not user_obj:
            return {'name': 'Unassigned', 'email': ''}
        
        return {
            'name': user_obj.get('displayName', 'Unknown'),
            'email': user_obj.get('emailAddress', ''),
            'account_id': user_obj.get('accountId', '')
        }
    
    def _extract_priority(self, priority_obj) -> str:
        """Extract priority"""
        if not priority_obj:
            return 'Medium'
        return priority_obj.get('name', 'Medium')
    
    def _process_attachments(self, attachments: List[Dict]) -> List[Dict]:
        """Process attachments and download text files"""
        processed = []
        
        for attachment in attachments:
            att_data = {
                'filename': attachment.get('filename', 'unknown'),
                'size': attachment.get('size', 0),
                'mime_type': attachment.get('mimeType', ''),
                'created': attachment.get('created', ''),
                'author': attachment.get('author', {}).get('displayName', 'Unknown'),
                'content': None,
                'url': attachment.get('content', '')
            }
            
            # Download text-based attachments (logs, text files)
            if self._is_text_file(att_data['filename'], att_data['mime_type']):
                content = self._download_attachment(att_data['url'])
                if content:
                    att_data['content'] = content
            
            processed.append(att_data)
        
        return processed
    
    def _is_text_file(self, filename: str, mime_type: str) -> bool:
        """Check if file is text-based"""
        text_extensions = ['.txt', '.log', '.json', '.xml', '.csv', '.md', '.yaml', '.yml']
        text_mimes = ['text/', 'application/json', 'application/xml']
        
        # Check extension
        if any(filename.lower().endswith(ext) for ext in text_extensions):
            return True
        
        # Check MIME type
        if any(mime_type.startswith(mime) for mime in text_mimes):
            return True
        
        return False
    
    def _download_attachment(self, url: str) -> Optional[str]:
        """Download attachment content"""
        try:
            response = requests.get(url, auth=self.auth, timeout=10)
            if response.status_code == 200:
                # Try to decode as UTF-8
                try:
                    return response.content.decode('utf-8')
                except UnicodeDecodeError:
                    # If not UTF-8, try latin-1
                    try:
                        return response.content.decode('latin-1')
                    except:
                        return None
            return None
        except Exception as e:
            print(f"Error downloading attachment: {e}")
            return None
    
    def _extract_error_logs(self, attachments: List[Dict]) -> str:
        """Extract error logs from attachments"""
        error_logs = []
        
        for att in attachments:
            filename = att['filename'].lower()
            content = att.get('content')
            
            # Check if it's a log file with content
            if content and ('log' in filename or 'error' in filename or 'stack' in filename):
                error_logs.append(f"=== {att['filename']} ===\n{content}\n")
        
        return '\n'.join(error_logs)
    
    def _process_comments(self, comments: List[Dict]) -> List[Dict]:
        """Process comments"""
        processed = []
        
        for comment in comments:
            processed.append({
                'author': comment.get('author', {}).get('displayName', 'Unknown'),
                'created': comment.get('created', ''),
                'body': self._parse_adf(comment.get('body', {}))
            })
        
        return processed
    
    def add_analysis_comment(self, ticket_id: str, analysis: Dict) -> bool:
        """
        Add analysis results as a comment to the JIRA ticket
        
        Args:
            ticket_id: JIRA ticket ID
            analysis: Analysis results dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_id}/comment"
            
            # Format analysis as ADF
            comment_body = self._format_analysis_as_adf(analysis)
            
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'body': comment_body
            }
            
            response = requests.post(
                url,
                headers=headers,
                auth=self.auth,
                json=payload
            )
            
            return response.status_code in [200, 201]
            
        except Exception as e:
            print(f"Error adding comment: {e}")
            return False
    
    def _format_analysis_as_adf(self, analysis: Dict) -> Dict:
        """Format analysis results as Atlassian Document Format"""
        support_analysis = analysis.get('support_analysis', {})
        dev_suggestion = analysis.get('developer_suggestion', {})
        
        # Build ADF structure
        content = {
            "version": 1,
            "type": "doc",
            "content": [
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "🤖 AI Analysis Results"}]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Category: ", "marks": [{"type": "strong"}]},
                        {"type": "text", "text": support_analysis.get('category', 'Unknown')}
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Severity: ", "marks": [{"type": "strong"}]},
                        {"type": "text", "text": support_analysis.get('severity', 'Unknown')}
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Confidence: ", "marks": [{"type": "strong"}]},
                        {"type": "text", "text": f"{support_analysis.get('confidence', 0)}%"}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 3},
                    "content": [{"type": "text", "text": "👨‍💻 Suggested Developer"}]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": f"{dev_suggestion.get('suggested_developer', 'Unassigned')} ({dev_suggestion.get('confidence', 0)}% match)"}
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": dev_suggestion.get('reason', 'No reason provided')}
                    ]
                }
            ]
        }
        
        # Add code areas
        code_areas = support_analysis.get('suggested_code_areas', [])
        if code_areas:
            content['content'].append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": "📍 Code Areas to Check"}]
            })
            for area in code_areas:
                content['content'].append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": f"• {area}"}]
                })
        
        # Add root causes
        root_causes = support_analysis.get('suspected_root_causes', [])
        if root_causes:
            content['content'].append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": "🔍 Suspected Root Causes"}]
            })
            for i, cause in enumerate(root_causes, 1):
                content['content'].append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": f"{i}. {cause}"}]
                })
        
        return content
    
    def update_assignee(self, ticket_id: str, assignee_account_id: str) -> bool:
        """
        Update ticket assignee
        
        Args:
            ticket_id: JIRA ticket ID
            assignee_account_id: Atlassian account ID of the assignee
            
        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"{self.jira_url}/rest/api/3/issue/{ticket_id}/assignee"
            
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'accountId': assignee_account_id
            }
            
            response = requests.put(
                url,
                headers=headers,
                auth=self.auth,
                json=payload
            )
            
            return response.status_code == 204
            
        except Exception as e:
            print(f"Error updating assignee: {e}")
            return False


# Example usage
if __name__ == "__main__":
    fetcher = JiraTicketFetcher()
    
    # Test fetching a ticket
    print("Testing JIRA Ticket Fetcher")
    print("=" * 60)
    
    ticket_id = input("Enter JIRA ticket ID (e.g., AUT-1): ").strip()
    
    if ticket_id:
        print(f"\nFetching ticket {ticket_id}...")
        result = fetcher.fetch_ticket(ticket_id)
        
        if result.get('success'):
            print("\n✅ Ticket fetched successfully!")
            print(f"\nSummary: {result['summary']}")
            print(f"Status: {result['status']}")
            print(f"Priority: {result['priority']}")
            print(f"Reporter: {result['reporter']['name']}")
            print(f"\nDescription:\n{result['description'][:200]}...")
            print(f"\nAttachments: {len(result['attachments'])} files")
            for att in result['attachments']:
                print(f"  - {att['filename']} ({att['size']} bytes)")
            print(f"\nComments: {len(result['comments'])}")
            
            if result['error_log']:
                print(f"\n📋 Error Logs Found ({len(result['error_log'])} chars)")
        else:
            print(f"\n❌ Error: {result.get('error')}")
