import os
import base64
import requests
from dotenv import load_dotenv

# TODO(SCRUM-9): This client uses Basic Auth with an API token. It should be
# upgraded to use OAuth2 to allow for token refresh and better security.

class JiraClient:
    """A client for interacting with the Jira API."""

    def __init__(self):
        """Initializes the JiraClient, loading configuration from environment variables."""
        load_dotenv()
        self.base_url = os.getenv("CONFLUENCE_URL")
        self.email = os.getenv("CONFLUENCE_USER")
        self.api_token = os.getenv("CONFLUENCE_API_TOKEN")
        self.project_key = os.getenv("CONFLUDECE_PROJECT_KEY")

        if not all([self.base_url, self.email, self.api_token, self.project_key]):
            raise RuntimeError("Missing Jira configuration in .env file.")

        self.headers = self._create_auth_headers()

    def _create_auth_headers(self) -> dict:
        """Creates the authentication headers for Jira Basic Auth."""
        auth_token = base64.b64encode(
            f"{self.email}:{self.api_token}".encode("utf-8")
        ).decode("utf-8")
        return {
            "Authorization": f"Basic {auth_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def create_ticket(self, summary: str, outdated_packages, ai_analysis, issue_type: str = "Task") -> dict:
        """
        Creates a Jira issue.

        Args:
            summary (str): The summary for the Jira ticket.
            outdated_packages (list): A list of outdated packages.
            ai_analysis (dict or list): The AI analysis of the dependencies.
            issue_type (str): The type of issue to create (e.g., "Task", "Bug").

        Returns:
            dict: The JSON response from the Jira API.
        """
        url = f"{self.base_url}/rest/api/3/issue"
        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": summary[:255],  # Jira hard limit
                "issuetype": {"name": issue_type},
                "description": self._build_description(outdated_packages, ai_analysis),
            }
        }

        response = requests.post(url, headers=self.headers, json=payload)

        if response.status_code not in (200, 201):
            print("\n❌ Jira API Error")
            print("Status:", response.status_code)
            print("Response:", response.text)

        response.raise_for_status()
        return response.json()

    @staticmethod
    def _build_description(outdated_packages, ai_analysis) -> dict:
        """
        Builds the description for a Jira ticket in the Atlassian Document Format.

        Args:
            outdated_packages (list): A list of outdated packages.
            ai_analysis (dict or list): The AI analysis of the dependencies.

        Returns:
            dict: The description in Atlassian Document Format.
        """
        dependency_analysis = []
        code_improvements = []

        if isinstance(ai_analysis, dict):
            dependency_analysis = ai_analysis.get("dependency_analysis", [])
            code_improvements = ai_analysis.get("code_improvements", [])
        elif isinstance(ai_analysis, list):
            dependency_analysis = ai_analysis

        content = [
            {"type": "paragraph", "content": [{"type": "text", "text": "✅ Automated Dependency Upgrade Report", "marks": [{"type": "strong"}]}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "📦 Outdated Packages:", "marks": [{"type": "strong"}]}]}
        ]

        for pkg in outdated_packages:
            content.append({"type": "paragraph", "content": [{"type": "text", "text": f"- {pkg['package']}: {pkg['current']} → {pkg['latest']} ({pkg['type']})"}]})

        if dependency_analysis:
            content.append({"type": "paragraph", "content": [{"type": "text", "text": "🤖 AI Dependency Analysis:", "marks": [{"type": "strong"}]}]})
            for pkg in dependency_analysis:
                content.extend([
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Package: {pkg.get('package', 'N/A')}", "marks": [{"type": "strong"}]}]},
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Issues: {pkg.get('issues', '')}"}]},
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Improvements: {pkg.get('improvements', '')}"}]},
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Breaking Changes: {pkg.get('breaking_changes', '')}"}]},
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Risk: {pkg.get('risk', '')}"}]},
                    {"type": "paragraph", "content": [{"type": "text", "text": f"Recommendation: {pkg.get('recommendation', '')}"}]}
                ])

        if code_improvements:
            content.append({"type": "paragraph", "content": [{"type": "text", "text": "🛠️ AI Code Improvements (Repo-aware):", "marks": [{"type": "strong"}]}]})
            for item in code_improvements:
                content.append({"type": "paragraph", "content": [{"type": "text", "text": f"Package: {item.get('package', 'N/A')}", "marks": [{"type": "strong"}]}]})
                if files := item.get("files_touched", []):
                    content.append({"type": "paragraph", "content": [{"type": "text", "text": "Files touched:", "marks": [{"type": "strong"}]}]})
                    content.extend([{"type": "paragraph", "content": [{"type": "text", "text": f"- {f}"}]} for f in files])
                if changes := item.get("required_changes", []):
                    content.append({"type": "paragraph", "content": [{"type": "text", "text": "Required changes:", "marks": [{"type": "strong"}]}]})
                    content.extend([{"type": "paragraph", "content": [{"type": "text", "text": f"- {c}"}]} for c in changes])
                if refactors := item.get("recommended_refactors", []):
                    content.append({"type": "paragraph", "content": [{"type": "text", "text": "Recommended refactors:", "marks": [{"type": "strong"}]}]})
                    content.extend([{"type": "paragraph", "content": [{"type": "text", "text": f"- {r}"}]} for r in refactors])
                if risk := item.get("risk"):
                    content.append({"type": "paragraph", "content": [{"type": "text", "text": f"Risk: {risk}"}]})
        
        return {"type": "doc", "version": 1, "content": content}

# For backwards compatibility and to allow direct script execution
def create_jira_ticket(summary: str, outdated_packages, ai_analysis, issue_type: str = "Task") -> dict:
    """
    Create a Jira issue. This function is a wrapper for the JiraClient class for
    backwards compatibility.
    """
    client = JiraClient()
    return client.create_ticket(summary, outdated_packages, ai_analysis, issue_type)

if __name__ == '__main__':
    # This is an example of how to use the JiraClient.
    # It is not intended to be run directly without proper environment configuration.
    print("Jira Client Refactor Demonstration")
    print("This script is not intended for direct execution without a .env file and proper context.")
    
    try:
        client = JiraClient()
        print("\nJiraClient initialized successfully.")
        print(f"Jira Project: {client.project_key}")
        print(f"Jira URL: {client.base_url}")
        
        # Example dummy data - this will not create a real ticket without a valid server.
        # summary = "Test Ticket from Refactored Client"
        # outdated = [{"package": "example-pkg", "current": "1.0.0", "latest": "2.0.0", "type": "major"}]
        # analysis = {"dependency_analysis": [{"package": "example-pkg", "issues": "None", "risk": "Low"}]}
        #
        # print("\nAttempting to create a dummy ticket (this will likely fail without a live Jira)...")
        # try:
        #     ticket = client.create_ticket(summary, outdated, analysis)
        #     print("Ticket created successfully:")
        #     print(ticket)
        # except requests.exceptions.RequestException as e:
        #     print(f"Failed to create ticket as expected: {e}")
            
    except RuntimeError as e:
        print(f"\nError during client initialization: {e}")
