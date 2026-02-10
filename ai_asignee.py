import os
import json
import requests
from requests.auth import HTTPBasicAuth
from openai import OpenAI
from dotenv import load_dotenv

# ======================
# CONFIG
# ======================
load_dotenv()

JIRA_BASE = os.getenv("JIRA_BASE")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_TOKEN = os.getenv("JIRA_API_TOKEN_SUPP")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

PROJECT_KEY = "SCRUM"

HISTORICAL_ISSUES = [
    "SCRUM-12",
    "SCRUM-13",
    "SCRUM-14",
    "SCRUM-15",
    "SCRUM-17",
]

# 👉 New issue to suggest assignee for
NEW_ISSUE = {
    "summary": "Fix login issue for OAuth users",
    "description": "Google OAuth login fails after deployment",
    "issue_type": "Bug"
}

# =========================
# CLIENTS
# =========================
auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_TOKEN)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# =========================
# JIRA HELPERS (SAFE APIs)
# =========================
def fetch_issue(issue_key):
    url = f"{JIRA_BASE}/rest/api/3/issue/{issue_key}"
    params = {"expand": "changelog"}

    r = requests.get(url, auth=auth, params=params)
    r.raise_for_status()
    return r.json()

def extract_assignees(issue):
    assignees = set()

    # current assignee
    current = issue["fields"].get("assignee")
    if current:
        assignees.add(current["displayName"])

    # historical assignees
    for h in issue.get("changelog", {}).get("histories", []):
        for item in h["items"]:
            if item["field"] == "assignee" and item["toString"]:
                assignees.add(item["toString"])

    return assignees

# =========================
# BUILD EXPERIENCE PROFILES
# =========================
def build_profiles(issue_keys):
    profiles = {}

    for key in issue_keys:
        issue = fetch_issue(key)
        summary = issue["fields"]["summary"]
        description = issue["fields"].get("description") or ""
        issue_type = issue["fields"]["issuetype"]["name"]

        context = f"{summary} {description}".lower()
        assignees = extract_assignees(issue)

        for name in assignees:
            if name not in profiles:
                profiles[name] = {
                    "issues_worked": 0,
                    "issue_types": set(),
                    "context": []
                }

            profiles[name]["issues_worked"] += 1
            profiles[name]["issue_types"].add(issue_type)
            profiles[name]["context"].append(context)

    # convert sets → lists for JSON
    for p in profiles.values():
        p["issue_types"] = list(p["issue_types"])

    return profiles

# =========================
# AI RANKING
# =========================
def suggest_assignee(new_issue, profiles):
    prompt = f"""
You are a Jira expert helping suggest assignees.

New issue:
Summary: {new_issue["summary"]}
Description: {new_issue["description"]}
Issue Type: {new_issue["issue_type"]}

Assignee experience data:
{json.dumps(profiles, indent=2)}

Rank the best assignees.
Return ONLY JSON in this format:
{{
  "ranking": [
    {{ "user": "name", "reason": "short reason", "confidence": 0.0 }}
  ]
}}
"""
    print("\n================ OPENAI PAYLOAD (DEBUG) ================\n")
    print(prompt)
    print("\n========================================================\n")

    # OpenAI disabled
    return None

#    response = openai_client.chat.completions.create(
#        model="gpt-4o-mini",
#        temperature=0.2,
#        messages=[{"role": "user", "content": prompt}]
#    )

#    return json.loads(response.choices[0].message.content)

# =========================
# RUN
# =========================
if __name__ == "__main__":
    print("Building assignee profiles...")
    profiles = build_profiles(HISTORICAL_ISSUES)

    print("Running AI suggestion...")
    result = suggest_assignee(NEW_ISSUE, profiles)

    print("\n🎯 Suggested Assignees:\n")
    for i, r in enumerate(result["ranking"], start=1):
        print(f"{i}. {r['user']} ({r['confidence']})")
        print(f"   Reason: {r['reason']}\n")