"""
JIRA Webhook Setup Helper
Automatically registers webhook in JIRA for ticket creation events
"""

import os
import requests
from requests.auth import HTTPBasicAuth
import json
from dotenv import load_dotenv

load_dotenv()

class JiraWebhookManager:
    def __init__(self):
        self.jira_url = os.getenv('JIRA_URL', 'https://auto-dev.atlassian.net')
        self.jira_username = os.getenv('JIRA_USERNAME', '')
        self.jira_api_token = os.getenv('JIRA_API_TOKEN', '')
        self.auth = HTTPBasicAuth(self.jira_username, self.jira_api_token)
        
    def register_webhook(self, webhook_url: str, project_key: str = 'AS'):
        """
        Register a webhook in JIRA to listen for ticket creation
        
        Args:
            webhook_url: Your public webhook endpoint (e.g., https://your-server.com/api/jira-webhook)
            project_key: JIRA project key (default: 'AS' for Auto Support)
            
        Returns:
            Dict with success status and webhook ID
        """
        
        url = f"{self.jira_url}/rest/webhooks/1.0/webhook"
        
        webhook_payload = {
            "name": f"Auto Support Analyzer - {project_key}",
            "url": webhook_url,
            "events": [
                "jira:issue_created"  # Trigger when ticket is created
            ],
            "filters": {
                "issue-related-events-section": f"project = {project_key}"
            },
            "excludeBody": False
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        try:
            print(f"🔄 Registering webhook in JIRA...")
            print(f"   Project: {project_key}")
            print(f"   Webhook URL: {webhook_url}")
            
            response = requests.post(
                url, 
                json=webhook_payload, 
                headers=headers, 
                auth=self.auth
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                webhook_id = result.get('self', '').split('/')[-1]
                
                print(f"✅ Webhook registered successfully!")
                print(f"   Webhook ID: {webhook_id}")
                print(f"   Name: {webhook_payload['name']}")
                
                return {
                    'success': True,
                    'webhook_id': webhook_id,
                    'message': 'Webhook registered'
                }
            else:
                error_msg = response.text
                print(f"❌ Failed to register webhook")
                print(f"   Status: {response.status_code}")
                print(f"   Error: {error_msg}")
                
                return {
                    'success': False,
                    'error': f"Status {response.status_code}: {error_msg}"
                }
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def list_webhooks(self):
        """List all registered webhooks"""
        
        url = f"{self.jira_url}/rest/webhooks/1.0/webhook"
        
        try:
            response = requests.get(url, auth=self.auth)
            
            if response.status_code == 200:
                webhooks = response.json()
                print(f"📋 Registered Webhooks ({len(webhooks)}):")
                print("="*60)
                
                for webhook in webhooks:
                    print(f"   Name: {webhook.get('name')}")
                    print(f"   URL: {webhook.get('url')}")
                    print(f"   Events: {', '.join(webhook.get('events', []))}")
                    print(f"   Enabled: {webhook.get('enabled', False)}")
                    print("-"*60)
                
                return {
                    'success': True,
                    'webhooks': webhooks
                }
            else:
                return {
                    'success': False,
                    'error': f"Status {response.status_code}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_webhook(self, webhook_id: str):
        """Delete a webhook by ID"""
        
        url = f"{self.jira_url}/rest/webhooks/1.0/webhook/{webhook_id}"
        
        try:
            response = requests.delete(url, auth=self.auth)
            
            if response.status_code == 204:
                print(f"✅ Webhook {webhook_id} deleted")
                return {'success': True}
            else:
                print(f"❌ Failed to delete webhook: {response.status_code}")
                return {
                    'success': False,
                    'error': f"Status {response.status_code}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


def main():
    """
    Interactive setup for JIRA webhook
    """
    
    print("\n" + "="*60)
    print("🔔 JIRA Webhook Setup - Auto Support Analyzer")
    print("="*60 + "\n")
    
    manager = JiraWebhookManager()
    
    # Check credentials
    if not manager.jira_username or not manager.jira_api_token:
        print("❌ Missing JIRA credentials!")
        print("   Please set in .env file:")
        print("   - JIRA_USERNAME")
        print("   - JIRA_API_TOKEN")
        return
    
    print("✅ JIRA credentials found\n")
    
    # Show current webhooks
    print("📋 Checking existing webhooks...")
    result = manager.list_webhooks()
    
    if result['success']:
        print(f"\n✅ Found {len(result['webhooks'])} existing webhook(s)\n")
    else:
        print(f"⚠️  Could not list webhooks: {result['error']}\n")
    
    # Prompt for webhook URL
    print("="*60)
    print("To register a new webhook, you need:")
    print("1. A public URL where JIRA can send events")
    print("2. Your server running on port 5001")
    print("="*60 + "\n")
    
    webhook_url = input("Enter your webhook URL (or press Enter to skip): ").strip()
    
    if webhook_url:
        project_key = input("Enter project key [AS]: ").strip() or 'AS'
        
        # Register webhook
        result = manager.register_webhook(webhook_url, project_key)
        
        if result['success']:
            print("\n" + "="*60)
            print("🎉 Webhook Registration Complete!")
            print("="*60)
            print(f"✅ Webhook URL: {webhook_url}")
            print(f"✅ Project: {project_key}")
            print(f"✅ Webhook ID: {result['webhook_id']}")
            print("\n📝 Next Steps:")
            print("   1. Keep your server running (python support_ticket_api.py)")
            print("   2. Create a ticket in JIRA project AS")
            print("   3. Watch automatic analysis appear as comment!")
            print("="*60 + "\n")
        else:
            print(f"\n❌ Registration failed: {result['error']}\n")
    else:
        print("\nℹ️  Webhook registration skipped\n")
        print("To manually register webhook:")
        print("1. Go to: https://auto-dev.atlassian.net/plugins/servlet/webhooks")
        print("2. Click 'Create a webhook'")
        print("3. Enter:")
        print("   - Name: Auto Support Analyzer")
        print("   - URL: http://your-server:5001/api/jira-webhook")
        print("   - Events: Issue Created")
        print("   - JQL filter: project = AS")
        print("4. Save\n")


if __name__ == '__main__':
    main()
