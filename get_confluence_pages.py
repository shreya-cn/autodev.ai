#!/usr/bin/env python3
import os
import sys
import json
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from parent directory if not found in current
current_dir = Path(__file__).parent
env_file = current_dir / '.env'
if not env_file.exists():
    # Try autodev-ui directory
    env_file = current_dir / 'autodev-ui' / '.env.local'
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()  # Try default locations

CONFLUENCE_URL = os.getenv("CONFLUENCE_URL")
CONFLUENCE_USER = os.getenv("CONFLUENCE_USER")
CONFLUENCE_API_TOKEN = os.getenv("CONFLUENCE_API_TOKEN")
SPACE_KEY = os.getenv("SPACE_KEY")

def get_all_pages():
    """Get all pages from the Confluence space"""
    base_url = f"{CONFLUENCE_URL}/wiki/rest/api"
    auth = (CONFLUENCE_USER, CONFLUENCE_API_TOKEN)
    headers = {'Accept': 'application/json'}
    
    try:
        # Get all pages in the space
        url = f"{base_url}/content"
        params = {
            'spaceKey': SPACE_KEY,
            'type': 'page',
            'expand': 'version,space',
            'limit': 100
        }
        
        response = requests.get(url, auth=auth, headers=headers, params=params)
        response.raise_for_status()
        
        results = response.json().get('results', [])
        
        # Build page mapping
        pages = []
        for page in results:
            page_info = {
                'id': page['id'],
                'title': page['title'],
                'url': f"{CONFLUENCE_URL}/wiki/spaces/{SPACE_KEY}/pages/{page['id']}/{page['title'].replace(' ', '+')}",
                'lastModified': page['version']['when'] if 'version' in page else None
            }
            pages.append(page_info)
        
        return pages
    
    except requests.RequestException as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return []

if __name__ == "__main__":
    pages = get_all_pages()
    print(json.dumps(pages, indent=2))
