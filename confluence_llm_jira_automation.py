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
        
        Return JSON:
        {{
          "summary": "...",
          "requirements": [
            {{"title": "Short name", "description": "Full details"}}
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

    def create_jira_ticket(self, title: str, description: str, page_id: str) -> Optional[str]:
        print(f"[DEBUG] JIRA_PROJECT_KEY: '{JIRA_PROJECT_KEY}'")  # Debug print
        url = f"{self.jira_base}/rest/api/3/issue"
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
                "issuetype": {"name": "Story"}
            }
        }
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
            t = req.get("title") if isinstance(req, dict) else str(req)[:50]
            d = req.get("description") if isinstance(req, dict) else str(req)
            key = self.create_jira_ticket(t, d, page_id)
            if key: created_keys.append(key)

        # Build update with Summary
        new_content = original_html + f"<hr/><h2>AI Jira Sync</h2><p>{llm_result.get('summary')}</p>"
    
        if created_keys:
            # Added links to make the keys clickable in Confluence
            links = "".join([f'<li><a href="{self.jira_base}/browse/{k}">{k}</a></li>' for k in created_keys])
            new_content += f"<h3>Created Tickets</h3><ul>{links}</ul>"
            
        self.update_confluence_page(page_id, new_content)
        print(f"Success. {len(created_keys)} tickets in backlog.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", required=True)
    args = parser.parse_args()
    LLMConfluenceJiraAutomator().process_confluence_page(args.page_id)