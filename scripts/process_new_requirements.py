import os
import requests
import sys

CONFLUENCE_URL = os.environ["CONFLUENCE_URL"]
CONFLUENCE_USER = os.environ["CONFLUENCE_USER"]
CONFLUENCE_API_TOKEN = os.environ["CONFLUENCE_API_TOKEN"]
SPACE_KEY = os.environ["SPACE_KEY"]
AUTH = (CONFLUENCE_USER, CONFLUENCE_API_TOKEN)
HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}

# Label to mark processed pages
PROCESSED_LABEL = "llm-jira-processed"

def get_requirement_pages():
    url = f"{CONFLUENCE_URL}/wiki/rest/api/content/search"
    params = {
        "cql": f'title ~ "requirement" and space="{SPACE_KEY}" and type="page"',
        "limit": 100
    }
    resp = requests.get(url, auth=AUTH, headers=HEADERS, params=params)
    resp.raise_for_status()
    return resp.json().get("results", [])

def has_processed_label(page):
    page_id = page["id"]
    url = f"{CONFLUENCE_URL}/wiki/rest/api/content/{page_id}/label"
    resp = requests.get(url, auth=AUTH, headers=HEADERS)
    resp.raise_for_status()
    labels = [l["name"] for l in resp.json().get("results", [])]
    return PROCESSED_LABEL in labels

def add_processed_label(page):
    page_id = page["id"]
    url = f"{CONFLUENCE_URL}/wiki/rest/api/content/{page_id}/label"
    data = [{"prefix": "global", "name": PROCESSED_LABEL}]
    resp = requests.post(url, auth=AUTH, headers=HEADERS, json=data)
    resp.raise_for_status()

def main():
    pages = get_requirement_pages()
    if not pages:
        print("No requirement pages found.")
        return
    for page in pages:
        if not has_processed_label(page):
            print(f"Processing page: {page['title']} ({page['id']})")
            # Call your LLM-Jira automation here
            ret = os.system(f'python confluence_llm_jira_automation.py --page-id {page["id"]}')
            if ret == 0:
                add_processed_label(page)
                print(f"Marked as processed: {page['title']} ({page['id']})")
            else:
                print(f"Failed to process: {page['title']} ({page['id']})", file=sys.stderr)
        else:
            print(f"Already processed: {page['title']} ({page['id']})")

if __name__ == "__main__":
    main()
