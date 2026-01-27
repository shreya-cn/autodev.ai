import os
import re
import requests
import json
from packaging import version
from dotenv import load_dotenv
from openai import OpenAI
from jira_client import create_jira_ticket

# ---------------- LOAD ENV ---------------- #

load_dotenv()

GITHUB_TOKEN = os.getenv("TECH_DEBT_GITHUB_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not found in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

# ---------------- CONFIG ---------------- #

GITHUB_REPO = "Supp-2020/tech-debt-repo"  # owner/repo
BRANCH = "main"

GITHUB_RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{BRANCH}"
PACKAGE_JSON_URL = f"{GITHUB_RAW_BASE}/package.json"

GITHUB_API_BASE = "https://api.github.com"
NPM_REGISTRY_URL = "https://registry.npmjs.org"

# Only scan these file types for package usage
CODE_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx")

# Skip these folders (avoid huge unnecessary scans)
IGNORE_FOLDERS = (
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "coverage/",
    ".git/",
)

# Maximum files to attach per package (avoid large AI payload)
MAX_FILES_PER_PACKAGE = 5

# Maximum snippet matches per file
MAX_SNIPPETS_PER_FILE = 4

# ---------------- HELPERS ---------------- #

def github_headers():
    """
    Fine-grained tokens work best with Bearer
    """
    headers = {}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def clean_version(v):
    """
    Remove ^ ~ >= etc from npm version
    """
    return re.sub(r"^[^0-9]*", "", v)


def get_package_json():
    resp = requests.get(PACKAGE_JSON_URL, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_latest_version(pkg_name):
    url = f"{NPM_REGISTRY_URL}/{pkg_name}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data["dist-tags"]["latest"]


def classify_update(current, latest):
    c = version.parse(current)
    l = version.parse(latest)

    if l.major > c.major:
        return "MAJOR"
    if l.minor > c.minor:
        return "MINOR"
    if l.micro > c.micro:
        return "PATCH"
    return "NONE"


def is_code_file(path: str) -> bool:
    if not path.endswith(CODE_EXTENSIONS):
        return False

    for folder in IGNORE_FOLDERS:
        if path.startswith(folder):
            return False

    return True


# ---------------- GITHUB CODE PARSING ---------------- #

def get_repo_files():
    """
    Fetch all file paths from GitHub repo tree recursively using API.
    Requires token for private repos / better rate limits.
    """
    url = f"{GITHUB_API_BASE}/repos/{GITHUB_REPO}/git/trees/{BRANCH}?recursive=1"
    resp = requests.get(url, headers=github_headers(), timeout=20)

    # Helpful debug if token is missing / no access
    if resp.status_code == 401:
        raise RuntimeError("GitHub API 401 Unauthorized. Check TECH_DEBT_GITHUB_TOKEN.")
    if resp.status_code == 403:
        raise RuntimeError("GitHub API 403 Forbidden. Token missing permission or rate limited.")

    resp.raise_for_status()
    data = resp.json()

    return [
        item["path"]
        for item in data.get("tree", [])
        if item.get("type") == "blob"
    ]


def get_raw_file(path: str) -> str:
    url = f"{GITHUB_RAW_BASE}/{path}"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return resp.text


def file_uses_package(text: str, pkg_name: str) -> bool:
    """
    Detect usage by import/require statements.
    Example:
    import axios from "axios"
    import "react-router-dom"
    const x = require("lodash")
    """
    patterns = [
        rf'import\s+.*?\s+from\s+[\'"]{re.escape(pkg_name)}[\'"]',
        rf'import\s+[\'"]{re.escape(pkg_name)}[\'"]',
        rf'require\(\s*[\'"]{re.escape(pkg_name)}[\'"]\s*\)',
    ]
    return any(re.search(p, text) for p in patterns)


def extract_snippets(text: str, keyword: str, context_lines: int = 10, max_hits: int = 4):
    """
    Returns small code snippets around where the keyword appears.
    """
    lines = text.splitlines()
    hits = []

    for i, line in enumerate(lines):
        if keyword in line:
            start = max(0, i - context_lines)
            end = min(len(lines), i + context_lines + 1)

            hits.append({
                "line": i + 1,
                "snippet": "\n".join(lines[start:end])
            })

            if len(hits) >= max_hits:
                break

    return hits


def collect_relevant_code(outdated_packages):
    """
    For each outdated package, find the most relevant files/snippets from repo.
    """
    repo_files = get_repo_files()
    code_files = [f for f in repo_files if is_code_file(f)]

    results = []

    for pkg in outdated_packages:
        pkg_name = pkg["package"]
        matches = []

        for file_path in code_files:
            try:
                content = get_raw_file(file_path)

                if file_uses_package(content, pkg_name):
                    snippets = extract_snippets(
                        content,
                        pkg_name,
                        context_lines=10,
                        max_hits=MAX_SNIPPETS_PER_FILE
                    )

                    # even if snippet logic misses, still attach file reference
                    if snippets:
                        matches.append({
                            "file": file_path,
                            "snippets": snippets
                        })

                if len(matches) >= MAX_FILES_PER_PACKAGE:
                    break

            except Exception:
                # ignore broken files
                continue

        results.append({
            "package": pkg_name,
            "matches": matches
        })

    return results


# ---------------- AI ANALYSIS ---------------- #

def analyze_dependency_updates_with_ai(outdated_packages):
    """
    Your old logic - keep it (dependency upgrade analysis)
    """
    prompt = f"""
You are a Senior JavaScript engineer.

Return STRICT JSON only.
Do NOT return Markdown.
Do NOT add explanations outside JSON.

For EACH npm package, return:
- package
- issues
- improvements
- breaking_changes
- risk (LOW | MEDIUM | HIGH)
- recommendation

Packages:
{json.dumps(outdated_packages, indent=2)}

Return format:
[
  {{
    "package": "",
    "issues": "",
    "improvements": "",
    "breaking_changes": "",
    "risk": "",
    "recommendation": ""
  }}
]
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You analyze npm dependency upgrades."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


def analyze_code_improvements_with_ai(outdated_packages, relevant_code):
    """
    NEW: Send actual repo snippets to AI and request refactor/improvement suggestions.
    """
    prompt = f"""
You are a Senior JavaScript/TypeScript engineer.

Return STRICT JSON only.
Do NOT return Markdown.
Do NOT add explanations outside JSON.

Task:
We detected outdated dependencies and extracted the repo code snippets where they are used.
Suggest REQUIRED changes + RECOMMENDED improvements.

For each package, return:
- package
- files_touched
- required_changes (breaking fixes / upgrade adjustments)
- recommended_refactors (cleanups/better patterns)
- risk (LOW | MEDIUM | HIGH)
- example_patch_suggestions (before/after)

Outdated packages:
{json.dumps(outdated_packages, indent=2)}

Repo code usage snippets:
{json.dumps(relevant_code, indent=2)}

Return format:
[
  {{
    "package": "",
    "files_touched": ["..."],
    "required_changes": ["..."],
    "recommended_refactors": ["..."],
    "risk": "LOW|MEDIUM|HIGH",
    "example_patch_suggestions": [
      {{
        "file": "",
        "before": "",
        "after": ""
      }}
    ]
  }}
]
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You review repo code and suggest upgrade-safe improvements."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


# ---------------- MAIN ---------------- #

def main():
    print(f"\n🔍 Checking repo: {GITHUB_REPO}\n")

    pkg = get_package_json()

    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))

    outdated = []

    for name, current_raw in deps.items():
        try:
            current = clean_version(current_raw)
            latest = get_latest_version(name)

            if version.parse(latest) > version.parse(current):
                outdated.append({
                    "package": name,
                    "current": current_raw,
                    "latest": latest,
                    "type": classify_update(current, latest)
                })

        except Exception as e:
            print(f"⚠️ Skipped {name}: {e}")

    if not outdated:
        print("✅ All packages are up to date")
        return

    print("📦 Outdated packages:\n")
    for d in outdated:
        print(f"- {d['package']}: {d['current']} → {d['latest']} ({d['type']})")

    # ---------------- AI dependency analysis ---------------- #
    print("\n🤖 AI Dependency Upgrade Analysis...\n")
    deps_ai_raw = analyze_dependency_updates_with_ai(outdated)

    try:
        deps_ai_structured = json.loads(deps_ai_raw)
    except json.JSONDecodeError as e:
        print("❌ Failed to parse dependency AI JSON")
        print(deps_ai_raw)
        raise e

    # ---------------- Repo code parsing ---------------- #
    print("\n📂 Scanning repo for relevant code usage...\n")
    relevant_code = collect_relevant_code(outdated)

    # ---------------- AI code improvements ---------------- #
    print("\n🛠️ AI Code Improvements (Repo-Aware)...\n")
    code_ai_raw = analyze_code_improvements_with_ai(outdated, relevant_code)

    try:
        code_ai_structured = json.loads(code_ai_raw)
    except json.JSONDecodeError as e:
        print("❌ Failed to parse code AI JSON")
        print(code_ai_raw)
        raise e

    print("\n🎫 Creating Jira ticket...")

    ticket = create_jira_ticket(
        summary="[AI][Tech] Automated dependency upgrade + code improvement report",
        outdated_packages=outdated,
        ai_analysis={
            "dependency_analysis": deps_ai_structured,
            "code_improvements": code_ai_structured,
            "repo_code_usage": relevant_code
        },
        issue_type="Task"
    )

    print(f"✅ Jira ticket created: {ticket['key']}")


if __name__ == "__main__":
    main()