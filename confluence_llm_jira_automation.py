import os
import json
import base64
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Configuration - Added /wiki logic safely
ATLASSIAN_BASE = os.getenv("CONFLUENCE_URL").rstrip("/")
ATLASSIAN_USER = os.getenv("CONFLUENCE_USER")
ATLASSIAN_TOKEN = os.getenv("CONFLUENCE_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY") 
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

AUTH_HEADER = base64.b64encode(f"{ATLASSIAN_USER}:{ATLASSIAN_TOKEN}".encode()).decode()
HEADERS = {
    "Authorization": f"Basic {AUTH_HEADER}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

class LLMConfluenceJiraAutomator:
    def __init__(self):
        self.jira_base = ATLASSIAN_BASE.replace("/wiki", "")
        self.recommended_assignee_field_id = None
        self.assignee_context_cache = None  # Cache for assignee historical context
        self._fetch_recommended_assignee_field()

    def _fetch_recommended_assignee_field(self):
        """Fetch the custom field ID for Recommended Assignee"""
        try:
            url = f"{self.jira_base}/rest/api/3/field"
            resp = requests.get(url, headers=HEADERS)
            if resp.status_code == 200:
                fields = resp.json()
                for field in fields:
                    if field.get('name', '').lower() == 'recommended assignee':
                        self.recommended_assignee_field_id = field.get('id')
                        print(f"[INFO] Found Recommended Assignee field: {self.recommended_assignee_field_id}")
                        break
        except Exception as e:
            print(f"[WARN] Could not fetch Recommended Assignee field: {e}")

    def _get_assignee_context(self):
        """Fetch and cache historical assignee context"""
        if self.assignee_context_cache is not None:
            return self.assignee_context_cache
        
        try:
            # Fetch recent done issues to build assignee profiles
            jql = f"project = {JIRA_PROJECT_KEY} AND status = Done ORDER BY resolved DESC"
            search_url = f"{self.jira_base}/rest/api/3/search"
            search_resp = requests.post(
                search_url,
                headers=HEADERS,
                json={"jql": jql, "maxResults": 30, "fields": ["summary", "description", "assignee", "issuetype"]}
            )
            
            if search_resp.status_code != 200:
                return []
                
            issues = search_resp.json().get("issues", [])
            
            # Build assignee profiles
            assignee_context = []
            for issue in issues:
                assignee_name = issue.get("fields", {}).get("assignee", {}).get("displayName")
                if assignee_name:
                    issue_summary = issue.get("fields", {}).get("summary", "")
                    issue_type = issue.get("fields", {}).get("issuetype", {}).get("name", "")
                    assignee_context.append(f"{assignee_name} worked on: {issue_summary} ({issue_type})")
            
            self.assignee_context_cache = assignee_context
            return assignee_context
        except Exception as e:
            print(f"[WARN] Could not fetch assignee context: {e}")
            return []

    def _get_assignee_suggestion(self, title: str, description: str, issue_type: str = "Story") -> Optional[str]:
        """Use OpenAI to suggest an assignee based on ticket details and historical data"""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)
            
            assignee_context = self._get_assignee_context()
            
            if not assignee_context:
                return None
            
            prompt = f"""Based on historical Jira assignments, suggest the best assignee for this new ticket.

New Ticket:
Title: {title}
Description: {description}
Type: {issue_type}

Historical Assignments:
{chr(10).join(assignee_context[:15])}

Return ONLY the assignee's name (e.g., "John Doe") or "Unassigned" if no good match exists.
"""
            
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=50
            )
            
            assignee = resp.choices[0].message.content.strip()
            if assignee and assignee.lower() != "unassigned":
                print(f"[INFO] Suggested assignee: {assignee}")
                return assignee
                
        except Exception as e:
            print(f"[WARN] Could not get assignee suggestion: {e}")
        
        return None

    def get_page_details(self, page_id: str) -> Dict[str, Any]:
        url = f"{ATLASSIAN_BASE}/wiki/rest/api/content/{page_id}?expand=body.storage,version"
        resp = requests.get(url, headers=HEADERS)
        resp.raise_for_status()
        return resp.json()

    def update_confluence_page(self, page_id: str, new_html: str):
        current_data = self.get_page_details(page_id)
        current_version = current_data["version"]["number"]
        title = current_data["title"]
        
        payload = {
            "id": page_id,
            "type": "page",
            "title": title,
            "version": {"number": current_version + 1},
            "body": {"storage": {"value": new_html, "representation": "storage"}}
        }
        
        url = f"{ATLASSIAN_BASE}/wiki/rest/api/content/{page_id}"
        resp = requests.put(url, headers=HEADERS, data=json.dumps(payload))
        resp.raise_for_status()

    def llm_extract(self, document: str) -> Dict[str, Any]:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = f"""
        Extract requirements from this HTML. Treat every bullet point in 'Detailed Description' and 'Acceptance Criteria' as a unique requirement.
        For each requirement, provide a title, a detailed description, and estimate the story points (e.g., 1, 2, 3, 5, 8).

        Return JSON:
        {{
          "summary": "...",
          "requirements": [
            {{"title": "Short name", "description": "Full details", "story_points": 5}}
          ],
          "diagram_code": "..."
        }}
        Content: {document}
        """
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        return json.loads(resp.choices[0].message.content)

    def create_jira_ticket(self, title: str, description: str, page_id: str, story_points: Optional[int] = None) -> Optional[str]:
        print(f"[DEBUG] JIRA_PROJECT_KEY: '{JIRA_PROJECT_KEY}'")  # Debug print
        url = f"{self.jira_base}/rest/api/3/issue"
        
        # Get assignee suggestion
        recommended_assignee = self._get_assignee_suggestion(title, description, "Story")
        
        # API v3 requires Atlassian Document Format (ADF) for the description
        payload = {
            "fields": {
                "project": {"key": JIRA_PROJECT_KEY},
                "summary": title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [{
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}]
                    }]
                },
                "issuetype": {"name": "Story"},
                "labels": []
            }
        }

        if story_points is not None:
            payload["fields"]["labels"].append(f"SP-{story_points}")

        # Add recommended assignee to custom field
        if recommended_assignee and self.recommended_assignee_field_id:
            payload["fields"][self.recommended_assignee_field_id] = recommended_assignee
            # Also add as label
            assignee_label = f"recommended-{recommended_assignee.replace(' ', '-').lower()}"
            payload["fields"]["labels"].append(assignee_label)
            print(f"[INFO] Added recommended assignee: {recommended_assignee}")

        resp = requests.post(url, headers=HEADERS, data=json.dumps(payload))
        if resp.status_code == 201:
            return resp.json().get("key")
        print(f"Jira Failed: {resp.text}")
        return None

    def process_confluence_page(self, page_id: str):
        page_data = self.get_page_details(page_id)
        original_html = page_data["body"]["storage"]["value"]
        
        llm_result = self.llm_extract(original_html)
        
        created_keys = []
        for req in llm_result.get("requirements", []):
            if isinstance(req, dict):
                title = "AI - " + req.get("title", "Untitled")
                description = req.get("description", "")
                story_points = req.get("story_points")
                key = self.create_jira_ticket(title, description, page_id, story_points)
                if key:
                    created_keys.append(key)
            else:
                # Fallback for simple string requirements
                title = "AI - " + str(req)[:50]
                description = str(req)
                key = self.create_jira_ticket(title, description, page_id)
                if key:
                    created_keys.append(key)

        # Build update with Summary
        new_content = original_html + f"<hr/><h2>AI Jira Sync</h2><p>{llm_result.get('summary')}</p>"
    
        if created_keys:
            # Added links to make the keys clickable in Confluence
            links = "".join([f'<li><a href="{self.jira_base}/browse/{k}">{k}</a></li>' for k in created_keys])
            new_content += f"<h3>Created Tickets</h3><ul>{links}</ul>"
            
        self.update_confluence_page(page_id, new_content)
        print(f"Success. {len(created_keys)} tickets in backlog.")
        print(f"CREATED_TICKETS_JSON_START\n{{\"{page_id}\": {json.dumps(created_keys)} }}\nCREATED_TICKETS_JSON_END")
        return created_keys

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", required=True)
    args = parser.parse_args()
    LLMConfluenceJiraAutomator().process_confluence_page(args.page_id)