import os
import json
import base64
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from confluence_uploader_hierarchical import ConfluenceUploader

load_dotenv()

ATLASSIAN_BASE = os.getenv("CONFLUENCE_URL")
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
        self.uploader = ConfluenceUploader()
        self.jira_base = ATLASSIAN_BASE.replace("/wiki", "")

    def get_page_content(self, page_id: str) -> str:
        url = f"{ATLASSIAN_BASE}/rest/api/content/{page_id}?expand=body.storage"
        resp = requests.get(url, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        return data["body"]["storage"]["value"]

    def llm_extract(self, document: str) -> Dict[str, Any]:
        """Use LLM to extract summary, requirements, and diagram text from the document."""
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = f"""
You are an expert requirements analyst. Given the following Confluence document, do the following:
1. Write a concise summary (max 200 words).
2. Extract all requirements, features, or user stories as a list (with title and description for each).
3. If the document contains architecture or process descriptions, generate a PlantUML or Mermaid diagram code block that best represents it (if possible).

Document:
{document}

Respond in JSON with keys: summary, requirements (list of dicts with title, description), diagram_code (string, may be empty).
"""
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.2,
        )
        content = resp.choices[0].message.content.strip()
        # Try to parse JSON from LLM output
        try:
            data = json.loads(content)
        except Exception:
            # Try to extract JSON from markdown/code block
            import re
            match = re.search(r'```json\\s*(.*?)\\s*```', content, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
            else:
                raise RuntimeError("LLM did not return valid JSON")
        return data

    def create_jira_ticket(self, title: str, description: str, page_id: Optional[str] = None) -> Optional[str]:
        # By default, new issues are created in the backlog (not assigned to any sprint).
        # If your Jira workflow allows, you can explicitly set the status to 'To Do' to ensure backlog placement.
        confluence_link = f"{ATLASSIAN_BASE}/pages/viewpage.action?pageId={page_id}" if page_id else None
        desc = description.strip() if description and description.strip() else "No detailed description provided. Please refer to the linked Confluence page."
        desc_template = f"""
*Summary:*
{title}

*Description:*
{desc}
"""
        if confluence_link:
            desc_template += f"\n*Source Document:* [View in Confluence|{confluence_link}]"
        payload = {
            "fields": {
                "project": {"key": JIRA_PROJECT_KEY},
                "summary": title,
                "description": desc_template,
                "issuetype": {"name": "Story"},
                # Optionally, set status to 'To Do' if your workflow allows it. Otherwise, omit this field.
                # "status": {"name": "To Do"},
            }
        }
        url = f"{self.jira_base}/rest/api/3/issue"
        resp = requests.post(url, headers=HEADERS, data=json.dumps(payload))
        if resp.status_code < 300:
            return resp.json().get("key")
        else:
            print(f"Failed to create Jira ticket: {resp.text}")
            return None

    def attach_diagram(self, page_id: str, diagram_code: str, diagram_type: str = "plantuml"):
        """Attach diagram as a code block to the Confluence page."""
        if not diagram_code.strip():
            return
        # Add as a new comment or append to page
        code_block = f"<ac:structured-macro ac:name=\"code\"><ac:parameter ac:name=\"language\">{diagram_type}</ac:parameter><ac:plain-text-body><![CDATA[{diagram_code}]]></ac:plain-text-body></ac:structured-macro>"
        self.uploader.append_to_page(page_id, code_block)

    def process_confluence_page(self, page_id: str):
        print(f"Processing Confluence page: {page_id}")
        doc = self.get_page_content(page_id)
        llm_result = self.llm_extract(doc)
        summary = llm_result.get("summary", "")
        requirements = llm_result.get("requirements", [])
        diagram_code = llm_result.get("diagram_code", "")
        # Attach summary
        summary_html = f"<h2>AI-generated Summary</h2><p>{summary}</p>"
        self.uploader.append_to_page(page_id, summary_html)
        # Attach diagram if present
        if diagram_code.strip():
            self.attach_diagram(page_id, diagram_code)
        # Create Jira tickets
        created_keys = []
        for req in requirements:
            key = self.create_jira_ticket(req.get("title", "Untitled"), req.get("description", ""), page_id=page_id)
            if key:
                created_keys.append(key)
        # Attach ticket list
        if created_keys:
            tickets_html = "<h2>Jira Tickets Created</h2><ul>" + "".join([f'<li><a href=\"{self.jira_base}/browse/{k}\">{k}</a></li>' for k in created_keys]) + "</ul>"
            self.uploader.append_to_page(page_id, tickets_html)
        print(f"Done. Created {len(created_keys)} Jira tickets.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Process a Confluence page with LLM and create Jira tickets.")
    parser.add_argument("--page-id", required=True, help="Confluence page ID to process")
    args = parser.parse_args()
    LLMConfluenceJiraAutomator().process_confluence_page(args.page_id)
