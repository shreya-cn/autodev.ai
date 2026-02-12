import os
import base64
import requests
from dotenv import load_dotenv

# ---------------- LOAD ENV ---------------- #

load_dotenv()

JIRA_BASE_URL = os.getenv("JIRA_BASE") or os.getenv("JIRA_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL") or os.getenv("JIRA_USERNAME")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN_SUPP") or os.getenv("JIRA_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv("CONFLUENCE_PROJECT_KEY")

missing = [
    name
    for name, value in {
        "JIRA_BASE/JIRA_URL": JIRA_BASE_URL,
        "JIRA_EMAIL/JIRA_USERNAME": JIRA_EMAIL,
        "JIRA_API_TOKEN_SUPP/JIRA_API_TOKEN": JIRA_API_TOKEN,
        "CONFLUENCE_PROJECT_KEY": JIRA_PROJECT_KEY,
    }.items()
    if not value
]

if missing:
    missing_list = ", ".join(missing)
    raise RuntimeError(f"Missing Jira configuration in .env: {missing_list}")

# ---------------- AUTH ---------------- #

auth_token = base64.b64encode(
    f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode("utf-8")
).decode("utf-8")

HEADERS = {
    "Authorization": f"Basic {auth_token}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# ---------------- HELPERS ---------------- #

def build_description(outdated_packages, ai_analysis):
    """
    Supports formats:
    1) Old format (list): ai_analysis = [{package, issues, ...}]
    2) New format (dict):
       {
         "dependency_analysis": [...],
         "code_improvements": [...],
         "repo_code_usage": [...]
       }
    """

    dependency_analysis = []
    code_improvements = []

    # ✅ New format
    if isinstance(ai_analysis, dict):
        dependency_analysis = ai_analysis.get("dependency_analysis", [])
        code_improvements = ai_analysis.get("code_improvements", [])

    # ✅ Old format fallback
    elif isinstance(ai_analysis, list):
        dependency_analysis = ai_analysis

    content = []

    # ---------------- Title ---------------- #
    content.append({
        "type": "paragraph",
        "content": [{"type": "text", "text": "✅ Automated Dependency Upgrade Report", "marks": [{"type": "strong"}]}]
    })

    # ---------------- Outdated Packages ---------------- #
    content.append({
        "type": "paragraph",
        "content": [{"type": "text", "text": "📦 Outdated Packages:", "marks": [{"type": "strong"}]}]
    })

    for pkg in outdated_packages:
        content.append({
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": f"- {pkg['package']}: {pkg['current']} → {pkg['latest']} ({pkg['type']})"
                }
            ]
        })

    # ---------------- Dependency AI Analysis ---------------- #
    if dependency_analysis:
        content.append({
            "type": "paragraph",
            "content": [{"type": "text", "text": "🤖 AI Dependency Analysis:", "marks": [{"type": "strong"}]}]
        })

        for pkg in dependency_analysis:
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Package: {pkg.get('package', 'N/A')}", "marks": [{"type": "strong"}]}]
            })
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Issues: {pkg.get('issues', '')}"}]
            })
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Improvements: {pkg.get('improvements', '')}"}]
            })
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Breaking Changes: {pkg.get('breaking_changes', '')}"}]
            })
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Risk: {pkg.get('risk', '')}"}]
            })
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Recommendation: {pkg.get('recommendation', '')}"}]
            })

    # ---------------- Repo-aware Code Improvements ---------------- #
    if code_improvements:
        content.append({
            "type": "paragraph",
            "content": [{"type": "text", "text": "🛠️ AI Code Improvements (Repo-aware):", "marks": [{"type": "strong"}]}]
        })

        for item in code_improvements:
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": f"Package: {item.get('package', 'N/A')}", "marks": [{"type": "strong"}]}]
            })

            files = item.get("files_touched", [])
            if files:
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Files touched:", "marks": [{"type": "strong"}]}]
                })
                for f in files:
                    content.append({
                        "type": "paragraph",
                        "content": [{"type": "text", "text": f"- {f}"}]
                    })

            required_changes = item.get("required_changes", [])
            if required_changes:
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Required changes:", "marks": [{"type": "strong"}]}]
                })
                for c in required_changes:
                    content.append({
                        "type": "paragraph",
                        "content": [{"type": "text", "text": f"- {c}"}]
                    })

            refactors = item.get("recommended_refactors", [])
            if refactors:
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Recommended refactors:", "marks": [{"type": "strong"}]}]
                })
                for r in refactors:
                    content.append({
                        "type": "paragraph",
                        "content": [{"type": "text", "text": f"- {r}"}]
                    })

            risk = item.get("risk")
            if risk:
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": f"Risk: {risk}"}]
                })

    return {
        "type": "doc",
        "version": 1,
        "content": content
    }


# ---------------- MAIN API ---------------- #

def create_jira_ticket(summary: str, outdated_packages, ai_analysis, issue_type: str = "Task") -> dict:
    """
    Create a Jira issue.

    issue_type MUST exist in the Jira project
    (e.g. Bug, Task, Story)
    """

    url = f"{JIRA_BASE_URL}/rest/api/3/issue"

    payload = {
        "fields": {
            "project": {"key": JIRA_PROJECT_KEY},
            "summary": summary[:255],  # Jira hard limit
            "issuetype": {"name": issue_type},
            "description": build_description(outdated_packages, ai_analysis),
        }
    }

    response = requests.post(url, headers=HEADERS, json=payload)

    # ---------- DEBUG LOGGING ----------
    if response.status_code not in (200, 201):
        print("\n❌ Jira API Error")
        print("Status:", response.status_code)
        print("Response:", response.text)
    # -----------------------------------

    response.raise_for_status()
    return response.json()
