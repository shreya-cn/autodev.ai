import os
import json
import base64
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

ATLASSIAN_BASE = os.getenv("CONFLUENCE_URL").rstrip("/")
ATLASSIAN_USER = os.getenv("CONFLUENCE_USER")
ATLASSIAN_TOKEN = os.getenv("CONFLUENCE_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv("CONFLUENCE_PROJECT_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

AUTH_HEADER = base64.b64encode(f"{ATLASSIAN_USER}:{ATLASSIAN_TOKEN}".encode()).decode()
HEADERS = {
    "Authorization": f"Basic {AUTH_HEADER}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

class LLMConfluenceJiraAutomator:
    def __init__(self):
        # We no longer need self.uploader = ConfluenceUploader()
        self.jira_base = ATLASSIAN_BASE.replace("/wiki", "")

    def get_page_details(self, page_id: str) -> Dict[str, Any]:
        """Fetches the full page object including current version and body."""
        url = f"{ATLASSIAN_BASE}/wiki/rest/api/content/{page_id}?expand=body.storage,version"
        resp = requests.get(url, headers=HEADERS)
        resp.raise_for_status()
        return resp.json()

    def update_confluence_page(self, page_id: str, new_html: str):
        """Standard Confluence Update: Increments version and pushes new content."""
        # 1. Get current version and title (required for update)
        current_data = self.get_page_details(page_id)
        current_version = current_data["version"]["number"]
        title = current_data["title"]
        
        # 2. Prepare payload
        payload = {
            "id": page_id,
            "type": "page",
            "title": title,
            "version": {"number": current_version + 1},
            "body": {
                "storage": {
                    "value": new_html,
                    "representation": "storage"
                }
            }
        }
        
        url = f"{ATLASSIAN_BASE}/wiki/rest/api/content/{page_id}"
        resp = requests.put(url, headers=HEADERS, data=json.dumps(payload))
        resp.raise_for_status()
        print(f"Successfully updated Confluence page {page_id} to version {current_version + 1}")

    def llm_extract(self, document: str) -> Dict[str, Any]:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = f"""
        You are an expert requirements analyst. Given the following Confluence document, do the following:
        1. Write a concise summary (max 200 words).
        2. Extract all requirements, features, or user stories as a list.
        3. Generate a Mermaid diagram code block if applicable.

        Document:
        {document}

        Respond ONLY in JSON with keys: summary, requirements (list of dicts with title, description), diagram_code.
        """
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        return json.loads(resp.choices[0].message.content)

    def create_jira_ticket(self, title: str, description: str, page_id: str) -> Optional[str]:
        confluence_link = f"{ATLASSIAN_BASE}/wiki/pages/viewpage.action?pageId={page_id}"
        desc_template = f"*Summary:* {title}\n\n*Description:* {description}\n\n*Source:* [Confluence|{confluence_link}]"
        
        payload = {
            "fields": {
                "project": {"key": JIRA_PROJECT_KEY},
                "summary": f"[AI] {title}",
                "description": desc_template,
                "issuetype": {"name": "Story"},
            }
        }
        url = f"{self.jira_base}/rest/api/3/issue"
        resp = requests.post(url, headers=HEADERS, data=json.dumps(payload))
        return resp.json().get("key") if resp.status_code < 300 else None

    def process_confluence_page(self, page_id: str):
        print(f"Processing Confluence page: {page_id}")
        
        # 1. Get original content
        page_data = self.get_page_details(page_id)
        original_html = page_data["body"]["storage"]["value"]
        
        # 2. Extract Data via LLM
        llm_result = self.llm_extract(original_html)
        
        # 3. Create Jira tickets
        created_keys = []
        for req in llm_result.get("requirements", []):
            key = self.create_jira_ticket(req.get("title"), req.get("description"), page_id)
            if key: created_keys.append(key)

        # 4. Build NEW HTML content (Appending to the end)
        new_sections = f"<hr /><h2>AI Insights</h2>"
        new_sections += f"<h3>Summary</h3><p>{llm_result.get('summary')}</p>"
        
        if llm_result.get("diagram_code"):
            new_sections += f"<h3>Architecture Diagram</h3><ac:structured-macro ac:name=\"code\"><ac:parameter ac:name=\"language\">text</ac:parameter><ac:plain-text-body><![CDATA[{llm_result['diagram_code']}]]></ac:plain-text-body></ac:structured-macro>"
        
        if created_keys:
            links = "".join([f'<li><a href="{self.jira_base}/browse/{k}">{k}</a></li>' for k in created_keys])
            new_sections += f"<h3>Linked Jira Tickets</h3><ul>{links}</ul>"

        # Combine old content + new AI sections
        final_html = original_html + new_sections
        
        # 5. Push update
        self.update_confluence_page(page_id, final_html)
        print(f"Done. Processed {len(created_keys)} tickets.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", required=True)
    args = parser.parse_args()
    LLMConfluenceJiraAutomator().process_confluence_page(args.page_id)