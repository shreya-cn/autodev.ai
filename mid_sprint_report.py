import os
import json
import base64
import requests
import tempfile
import argparse
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from urllib.parse import quote
from dotenv import load_dotenv
from confluence_uploader_hierarchical import ConfluenceUploader

try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

load_dotenv()

ATLASSIAN_BASE = os.getenv("CONFLUENCE_URL")
ATLASSIAN_USER = os.getenv("CONFLUENCE_USER")
ATLASSIAN_TOKEN = os.getenv("CONFLUENCE_API_TOKEN")
SPACE_KEY = os.getenv("SPACE_KEY", "XFLOW")
BOARD_ID = os.getenv("JIRA_BOARD_ID")
PROJECT_KEY = os.getenv("CONFLUENCE_PROJECT_KEY")
STORY_POINTS_FIELD = os.getenv("JIRA_STORY_POINTS_FIELD", "customfield_10016")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not all([ATLASSIAN_BASE, ATLASSIAN_USER, ATLASSIAN_TOKEN]):
    raise RuntimeError("Missing Atlassian env vars: set CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_API_TOKEN")

AUTH_HEADER = base64.b64encode(f"{ATLASSIAN_USER}:{ATLASSIAN_TOKEN}".encode()).decode()
HEADERS = {
    "Authorization": f"Basic {AUTH_HEADER}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def _get(url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    resp = requests.get(url, headers=HEADERS, params=params)
    if resp.status_code >= 300:
        raise RuntimeError(f"Atlassian API error {resp.status_code}: {resp.text}")
    return resp.json()


def _search_jql(jql: str, fields: str, max_results: int = 200) -> Dict[str, Any]:
    field_list = [f.strip() for f in fields.split(",") if f.strip()]

    # Use GET /search (works reliably on all Jira Cloud instances)
    url = f"{ATLASSIAN_BASE}/rest/api/3/search"
    params = {
        "jql": jql,
        "startAt": 0,
        "maxResults": max_results,
        "fields": ",".join(field_list),
    }
    resp = requests.get(url, headers=HEADERS, params=params)
    if resp.status_code < 300:
        return resp.json()
    
    raise RuntimeError(f"Atlassian JQL error {resp.status_code}: {resp.text}")


def get_project_key_from_board(board_id: str) -> Optional[str]:
    try:
        info = _get(f"{ATLASSIAN_BASE}/rest/agile/1.0/board/{board_id}")
        return info.get("location", {}).get("projectKey") or info.get("filter", {}).get("query")
    except Exception:
        return None


def search_active_sprint_by_project(project_key: Optional[str], board_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Fallback for Kanban boards: find active sprint via JQL search."""
    if not project_key and board_id:
        project_key = get_project_key_from_board(board_id)
    if not project_key:
        return None
    jql = f"project = {project_key} AND sprint in openSprints()"
    data = _search_jql(jql, "sprint", max_results=50)
    for issue in data.get("issues", []):
        for sprint in issue.get("fields", {}).get("sprint", []) if isinstance(issue.get("fields", {}).get("sprint"), list) else [issue.get("fields", {}).get("sprint")]:
            if sprint and sprint.get("state", "").lower() == "active":
                return sprint
    return None


def get_active_sprint(board_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if board_id:
        url = f"{ATLASSIAN_BASE}/rest/agile/1.0/board/{board_id}/sprint"
        try:
            data = _get(url, {"state": "active"})
            return data.get("values", [None])[0] if data.get("values") else None
        except RuntimeError as exc:
            if "does not support sprints" not in str(exc) and "cannot be viewed" not in str(exc):
                raise
            # Fallback for team-managed/simple boards
    return search_active_sprint_by_project(PROJECT_KEY, board_id)


def _get_board_sprints(board_id: str, state: str, max_results: int = 50) -> List[Dict[str, Any]]:
    try:
        data = _get(
            f"{ATLASSIAN_BASE}/rest/agile/1.0/board/{board_id}/sprint",
            {"state": state, "startAt": 0, "maxResults": max_results},
        )
        return data.get("values", [])
    except Exception:
        return []


def get_current_or_recent_sprint(board_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Return active sprint; if none, return latest closed; else an upcoming sprint.

    This makes the script resilient around sprint rollover.
    """
    # 1) Active
    active = get_active_sprint(board_id)
    if active:
        return active

    if not board_id:
        return None

    # 2) Latest closed by end/complete date
    closed = _get_board_sprints(board_id, "closed", max_results=100)
    def _parse_dt(s: Optional[str]) -> Optional[datetime]:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
        except Exception:
            return None
    if closed:
        closed_sorted = sorted(
            closed,
            key=lambda s: (_parse_dt(s.get("completeDate")) or _parse_dt(s.get("endDate")) or datetime.min.replace(tzinfo=timezone.utc)),
            reverse=True,
        )
        if closed_sorted:
            return closed_sorted[0]

    # 3) Upcoming (future) - pick the earliest start date
    future = _get_board_sprints(board_id, "future", max_results=50)
    if future:
        future_sorted = sorted(
            future,
            key=lambda s: (_parse_dt(s.get("startDate")) or datetime.max.replace(tzinfo=timezone.utc))
        )
        if future_sorted:
            return future_sorted[0]

    # 4) Fallback via project search
    return search_active_sprint_by_project(PROJECT_KEY, board_id)


def get_sprint_issues(board_id: Optional[str], sprint_id: str) -> List[Dict[str, Any]]:
    """Fetch sprint issues; use board API when available, else JQL."""
    fields = f"summary,status,assignee,created,labels,flagged,priority,{STORY_POINTS_FIELD}"
    if board_id:
        try:
            issues: List[Dict[str, Any]] = []
            start_at = 0
            max_results = 100
            while True:
                url = f"{ATLASSIAN_BASE}/rest/agile/1.0/board/{board_id}/sprint/{sprint_id}/issue"
                page = _get(url, {"startAt": start_at, "maxResults": max_results, "fields": fields})
                if page is None:
                    break
                issues.extend([i for i in page.get("issues", []) if i is not None])
                if start_at + max_results >= page.get("total", 0):
                    break
                start_at += max_results
            return issues
        except RuntimeError as exc:
            if "does not support sprints" not in str(exc):
                raise

    # Fallback via JQL
    jql = f"sprint = {sprint_id}"
    data = _search_jql(jql, fields, max_results=200)
    issues = data.get("issues", [])
    return [i for i in issues if i is not None]


def _status_category(issue: Dict[str, Any]) -> str:
    try:
        return issue["fields"]["status"]["statusCategory"]["key"].lower()
    except Exception:
        return "unknown"


def _story_points(issue: Dict[str, Any]) -> float:
    try:
        points = issue["fields"].get(STORY_POINTS_FIELD)
        return float(points) if points is not None else 0.0
    except Exception:
        return 0.0


def compute_metrics(issues: List[Dict[str, Any]], sprint_end: Optional[datetime] = None) -> Dict[str, Any]:
    done, in_prog, todo = [], [], []
    blocked: List[Dict[str, Any]] = []
    at_risk: List[Dict[str, Any]] = []
    high_priority_todo: List[Dict[str, Any]] = []
    total_points = done_points = in_prog_points = todo_points = 0.0

    now = datetime.now(timezone.utc)
    days_left = (sprint_end - now).days if sprint_end else 999

    for issue in issues:
        if issue is None or not isinstance(issue, dict):
            continue
        if "fields" not in issue or issue.get("fields") is None:
            continue
        
        cat = _status_category(issue)
        pts = _story_points(issue)
        total_points += pts
        priority = (issue.get("fields") or {}).get("priority") or {}
        priority = priority.get("name", "Medium") if isinstance(priority, dict) else "Medium"
        
        if cat == "done":
            done.append(issue)
            done_points += pts
        elif cat == "indeterminate":
            in_prog.append(issue)
            in_prog_points += pts
            # At-risk logic: in progress with high points or high priority and limited time
            if (pts >= 5 or priority in ["Highest", "High"]) and days_left <= 3:
                at_risk.append(issue)
        else:
            todo.append(issue)
            todo_points += pts
            # High priority items still in backlog
            if priority in ["Highest", "High"]:
                high_priority_todo.append(issue)

        status_name = (issue.get("fields") or {}).get("status") or {}
        status_name = status_name.get("name", "") if isinstance(status_name, dict) else ""
        labels = (issue.get("fields") or {}).get("labels", []) or []
        flagged = (issue.get("fields") or {}).get("flagged", False)
        if flagged or "blocked" in status_name.lower() or any(l.lower() == "blocked" for l in labels):
            blocked.append(issue)

    completion = (done_points / total_points * 100) if total_points else 0.0
    
    # If no story points are assigned, use issue count as fallback
    if total_points == 0 and len(issues) > 0:
        completion = (len(done) / len(issues) * 100)
    
    # Sort at-risk by points descending
    at_risk.sort(key=lambda x: _story_points(x), reverse=True)
    # Sort high priority by priority and points
    priority_order = {"Highest": 0, "High": 1, "Medium": 2, "Low": 3, "Lowest": 4}
    high_priority_todo.sort(key=lambda x: (priority_order.get(x.get("fields", {}).get("priority", {}).get("name", "Medium"), 2), -_story_points(x)))
    
    return {
        "counts": {
            "total": len(issues),
            "done": len(done),
            "in_progress": len(in_prog),
            "todo": len(todo),
            "blocked": len(blocked),
            "at_risk": len(at_risk),
        },
        "points": {
            "total": total_points,
            "done": done_points,
            "in_progress": in_prog_points,
            "todo": todo_points,
        },
        "completion_pct": round(completion, 1),
        "blocked_keys": [i.get("key") for i in blocked],
        "at_risk_issues": at_risk,
        "high_priority_todo": high_priority_todo,
        "all_in_progress": in_prog,
    }


def format_html(sprint: Dict[str, Any], metrics: Dict[str, Any], notes: str = "") -> str:
    end = sprint.get("endDate")
    start = sprint.get("startDate")
    now = datetime.now(timezone.utc)
    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00")) if end else None
    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00")) if start else None
    # Days left: don't show negatives if sprint is closed
    raw_days_left = (end_dt - now).days if end_dt else None
    days_left = max(0, raw_days_left) if raw_days_left is not None else "?"
    elapsed = (now - start_dt).days if start_dt else "?"

    counts = metrics["counts"]
    pts = metrics["points"]
    blocked = ", ".join(metrics["blocked_keys"]) or "None"
    completion_pct = metrics.get("completion_pct", 0)

    # Determine status and color based on completion
    if completion_pct >= 75:
        status_text = "On Track"
        color = "#4caf50"
    elif completion_pct >= 50:
        status_text = "Good Progress"
        color = "#8bc34a"
    elif completion_pct >= 25:
        status_text = "Needs Attention"
        color = "#ffc107"
    else:
        status_text = "Critical"
        color = "#ff9800"

    # Generate donut chart image locally using matplotlib
    chart_image_name = f"sprint_progress_{sprint.get('id', 'chart')}.png"
    chart_html = ""
    
    if plt:
        try:
            done = max(0, min(100, int(round(completion_pct))))
            remaining = 100 - done
            
            fig, ax = plt.subplots(figsize=(6, 6))
            wedges, texts, autotexts = ax.pie(
                [done, remaining],
                labels=['Done', 'Remaining'],
                colors=[color, '#e0e0e0'],
                autopct='%1.0f%%',
                startangle=90,
                wedgeprops={'width': 0.3, 'edgecolor': 'white', 'linewidth': 2},
                textprops={'fontsize': 12, 'weight': 'bold'}
            )
            ax.set_title(f'{int(completion_pct)}% Complete', fontsize=16, weight='bold', pad=20)
            
            # Save chart to temp file
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                chart_path = tmp.name
            fig.savefig(chart_path, dpi=100, bbox_inches='tight', facecolor='white')
            plt.close(fig)
            
            # Store path for later attachment
            chart_html = f'<ac:image><ri:attachment ri:filename="{chart_image_name}" /></ac:image>'
            
            # Pass chart info to sprint metadata
            sprint['_chart_path'] = chart_path
            sprint['_chart_name'] = chart_image_name
            print(f"📊 Chart generated: {chart_path}")
        except Exception as e:
            print(f"⚠️ Chart generation failed: {e}")
            chart_html = f"<p><em>{int(completion_pct)}% complete - {status_text}</em></p>"
    else:
        print(f"⚠️ matplotlib not available, using text fallback")
        chart_html = f"<p><em>{int(completion_pct)}% complete - {status_text}</em></p>"
    
    progress_html = f"""<h2>🏁 Sprint Progress</h2>
<div style='text-align: left;'>
{chart_html}
<p><strong>{counts['done']} of {counts['total']}</strong> issues completed | <strong>{pts['done']:.1f} of {pts['total']:.1f}</strong> story points done</p>
</div>"""
    
    # Build spillover risk section
    at_risk_html = ""
    if metrics.get("at_risk_issues"):
        at_risk_html = "<h3>⚠️ Tickets at Risk of Spillover</h3><table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
        at_risk_html += "<tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Assignee</th><th>Points</th><th>Priority</th></tr>"
        for issue in metrics["at_risk_issues"][:10]:  # Top 10
            key = issue.get("key", "")
            summary = issue.get("fields", {}).get("summary", "")
            assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
            points = _story_points(issue)
            priority = issue.get("fields", {}).get("priority", {}).get("name", "Medium")
            at_risk_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{assignee}</td><td>{points}</td><td>{priority}</td></tr>"
        at_risk_html += "</table>"
    else:
        at_risk_html = "<h3>✅ No Tickets at High Risk of Spillover</h3>"
    
    # Build priority recommendations
    priority_html = ""
    if metrics.get("high_priority_todo"):
        priority_html = "<h3>🎯 High Priority Items to Focus On</h3><table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
        priority_html += "<tr style='background-color:#fff3cd;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Priority</th><th>Points</th><th>Status</th></tr>"
        for issue in metrics["high_priority_todo"][:10]:  # Top 10
            key = issue.get("key", "")
            summary = issue.get("fields", {}).get("summary", "")
            priority = issue.get("fields", {}).get("priority", {}).get("name", "Medium")
            points = _story_points(issue)
            status = issue.get("fields", {}).get("status", {}).get("name", "")
            priority_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{priority}</td><td>{points}</td><td>{status}</td></tr>"
        priority_html += "</table>"
    
    # Build all in-progress items
    in_progress_html = "<h3>🔄 Currently In Progress</h3><table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
    in_progress_html += "<tr style='background-color:#e7f3ff;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Assignee</th><th>Points</th><th>Status</th></tr>"
    for issue in metrics.get("all_in_progress", [])[:15]:  # Top 15
        key = issue.get("key", "")
        summary = issue.get("fields", {}).get("summary", "")
        assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
        points = _story_points(issue)
        status = issue.get("fields", {}).get("status", {}).get("name", "")
        in_progress_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{assignee}</td><td>{points}</td><td>{status}</td></tr>"
    in_progress_html += "</table>"

    return f"""
    <div style='text-align: left;'>
    <h1>Mid-Sprint Review: {sprint.get('name')}</h1>
    <p><strong>Board</strong>: {BOARD_ID or sprint.get('originBoardId', 'n/a')} | <strong>Project</strong>: {PROJECT_KEY or 'n/a'}</p>
    <p><strong>Dates</strong>: {start_dt.date() if start_dt else '?'} → {end_dt.date() if end_dt else '?'} | <strong>Elapsed</strong>: {elapsed}d | <strong>Days left</strong>: {days_left}</p>
        {progress_html}
    <p><strong>⏰ Sprint Velocity Check</strong>: {counts['done']}/{counts['total']} issues completed ({metrics['completion_pct']}%)</p>
    
    <h2>📊 Sprint Progress Summary</h2>
    <table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>
      <tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Metric</th><th>Count</th><th>Story Points</th></tr>
      <tr><td style='padding:8px;'>✅ Done</td><td>{counts['done']}</td><td>{pts['done']}</td></tr>
      <tr><td style='padding:8px;'>🔄 In Progress</td><td>{counts['in_progress']}</td><td>{pts['in_progress']}</td></tr>
      <tr><td style='padding:8px;'>📋 To Do</td><td>{counts['todo']}</td><td>{pts['todo']}</td></tr>
      <tr><td style='padding:8px;'>🚫 Blocked</td><td>{counts['blocked']}</td><td>-</td></tr>
      <tr style='background-color:#fff3cd; font-weight:bold;'><td style='padding:8px;'>📊 Total</td><td>{counts['total']}</td><td>{pts['total']}</td></tr>
    </table>
    
    <h2>🚨 Risks & Blockers</h2>
    <ul>
      <li><strong>Blocked issues</strong>: {blocked}</li>
      <li><strong>At-risk items</strong>: {counts['at_risk']} tickets may spill over</li>
      <li><strong>Completion pace</strong>: {metrics['completion_pct']}% complete with {days_left} days remaining</li>
    </ul>
    
    {at_risk_html}
    
    {priority_html}
    
    {in_progress_html}
    
    <h2>💡 AI Insights</h2>
    <p>{notes or 'No AI insights available'}</p>
    </div>
    """


def maybe_ai_notes(sprint: Dict[str, Any], metrics: Dict[str, Any]) -> str:
    if not OPENAI_API_KEY:
        return "AI insights disabled: OPENAI_API_KEY not set."
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = (
            "You are a delivery coach. Write a terse, action-oriented mid-sprint note. "
            "Use at most 4 bullets. Highlight risks, blockers, and specific next actions. "
            f"Sprint: {sprint.get('name')} metrics: {json.dumps(metrics)}"
        )
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=220,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        return f"AI note unavailable: {exc}"


def generate_ai_report(sprint: Dict[str, Any], issues: List[Dict[str, Any]], metrics: Dict[str, Any]) -> str:
    """Use AI to generate the complete mid-sprint review report in HTML."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set. Cannot generate report without AI.")
    
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Build comprehensive data summary for the AI
        now = datetime.now(timezone.utc)
        end_dt = datetime.fromisoformat(sprint.get("endDate", "").replace("Z", "+00:00")) if sprint.get("endDate") else None
        start_dt = datetime.fromisoformat(sprint.get("startDate", "").replace("Z", "+00:00")) if sprint.get("startDate") else None
        days_left = (end_dt - now).days if end_dt else "?"
        elapsed = (now - start_dt).days if start_dt else "?"
        
        # Prepare issue summaries
        at_risk_summary = []
        for issue in metrics.get("at_risk_issues", [])[:10]:
            at_risk_summary.append({
                "key": issue.get("key"),
                "summary": issue.get("fields", {}).get("summary", ""),
                "assignee": issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned",
                "points": _story_points(issue),
                "priority": issue.get("fields", {}).get("priority", {}).get("name", "Medium"),
                "status": issue.get("fields", {}).get("status", {}).get("name", ""),
            })
        
        high_priority_summary = []
        for issue in metrics.get("high_priority_todo", [])[:10]:
            high_priority_summary.append({
                "key": issue.get("key"),
                "summary": issue.get("fields", {}).get("summary", ""),
                "priority": issue.get("fields", {}).get("priority", {}).get("name", "Medium"),
                "points": _story_points(issue),
                "status": issue.get("fields", {}).get("status", {}).get("name", ""),
            })
        
        in_progress_summary = []
        for issue in metrics.get("all_in_progress", [])[:15]:
            in_progress_summary.append({
                "key": issue.get("key"),
                "summary": issue.get("fields", {}).get("summary", ""),
                "assignee": issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned",
                "points": _story_points(issue),
                "status": issue.get("fields", {}).get("status", {}).get("name", ""),
            })
        
        data_summary = {
            "sprint_name": sprint.get("name"),
            "board_id": BOARD_ID,
            "project_key": PROJECT_KEY,
            "start_date": start_dt.date().isoformat() if start_dt else "?",
            "end_date": end_dt.date().isoformat() if end_dt else "?",
            "elapsed_days": elapsed,
            "days_left": days_left,
            "metrics": {
                "total_issues": metrics["counts"]["total"],
                "done": metrics["counts"]["done"],
                "in_progress": metrics["counts"]["in_progress"],
                "todo": metrics["counts"]["todo"],
                "blocked": metrics["counts"]["blocked"],
                "at_risk": metrics["counts"]["at_risk"],
                "completion_percentage": metrics["completion_pct"],
                "total_story_points": metrics["points"]["total"],
                "done_points": metrics["points"]["done"],
                "in_progress_points": metrics["points"]["in_progress"],
                "todo_points": metrics["points"]["todo"],
            },
            "at_risk_issues": at_risk_summary,
            "high_priority_todo": high_priority_summary,
            "in_progress_items": in_progress_summary,
            "blocked_issues": metrics["blocked_keys"],
        }
        
        prompt = f"""You are an expert delivery coach analyzing a software sprint mid-point. 
Generate a comprehensive mid-sprint review report in HTML format.

Sprint Data:
{json.dumps(data_summary, indent=2)}

Instructions:
1. Create an HTML report (no outer html/body tags, just the content)
2. Include sections for:
   - Sprint Progress Summary (with a table of metrics)
   - Risks & Blockers (highlight spillover risks and blocked items)
   - Tickets at Risk of Spillover (detailed table with key, summary, assignee, points, priority)
   - High Priority Items to Focus On (detailed table with key, summary, priority, points, status)
   - Currently In Progress (detailed table with key, summary, assignee, points, status)
   - AI Insights & Recommendations (analysis-based action items for the team)
3. Use meaningful emojis for section headers
4. Make tables professional with border-collapse, padding, and alternating row colors where appropriate
5. Provide actionable insights specific to this sprint's data (risks, blockers, priority recommendations)
6. Keep the tone professional, data-driven, and action-oriented
7. Format all Jira keys as clickable links: <a href='https://{ATLASSIAN_BASE.replace('https://', '')}/browse/{{key}}'>{{key}}</a>

Generate the report now:"""
        
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.3,
        )
        
        html_content = resp.choices[0].message.content.strip()
        return html_content
    
    except Exception as exc:
        raise RuntimeError(f"Failed to generate AI report: {exc}")


def publish_to_confluence(title: str, html: str, sprint_data: Dict[str, Any] = None) -> str:
    """Publish report to Confluence and return the page URL"""
    uploader = ConfluenceUploader()
    parent_title = "Mid-Sprint Reviews"
    parent = uploader.find_existing_page(parent_title)
    if parent:
        parent_id = parent["id"]
    else:
        parent_content = f"<h1>{parent_title}</h1><p>Auto-created</p>"
        parent_id = uploader.create_page(parent_title, parent_content)

    existing = uploader.find_existing_page(title)
    if existing:
        page_id = existing["id"]
        uploader.update_page(page_id, title, html, existing["version"]["number"], parent_id)
    else:
        page_id = uploader.create_page(title, html, parent_id)
    
    # Attach chart image if available
    if sprint_data and '_chart_path' in sprint_data and page_id:
        chart_path = sprint_data['_chart_path']
        chart_name = sprint_data.get('_chart_name', 'sprint_chart.png')
        if os.path.exists(chart_path):
            print(f"📎 Attaching chart: {chart_name}")
            success = uploader.attach_file(page_id, chart_path, chart_name)
            print(f"✅ Chart attached" if success else f"❌ Chart attachment failed")
            try:
                os.remove(chart_path)
            except:
                pass
        else:
            print(f"⚠️ Chart file not found: {chart_path}")
    elif sprint_data and '_chart_path' not in sprint_data:
        print(f"ℹ️ No chart data to attach")
    
    # Build Confluence page URL
    # For personal spaces, SPACE_KEY starts with ~ and we need to keep it
    page_url = f"{ATLASSIAN_BASE}/wiki/spaces/{SPACE_KEY}/pages/{page_id}"
    print(f"📖 Confluence page URL: {page_url}")
    return page_url


def get_sprint_midpoint_date(sprint: Dict[str, Any]) -> Optional[datetime]:
    """Calculate the midpoint date of a sprint."""
    try:
        start_str = sprint.get("startDate")
        end_str = sprint.get("endDate")
        
        if not start_str or not end_str:
            return None
        
        start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        
        # Calculate midpoint
        midpoint = start + (end - start) / 2
        return midpoint
    except Exception as e:
        print(f"⚠️  Error calculating midpoint: {e}")
        return None


def is_sprint_midpoint_today(sprint: Dict[str, Any]) -> bool:
    """Check if today is the sprint midpoint date."""
    midpoint = get_sprint_midpoint_date(sprint)
    if not midpoint:
        return False
    
    today = datetime.now(timezone.utc).date()
    midpoint_date = midpoint.date()
    
    return today == midpoint_date


def is_sprint_end_today(sprint: Dict[str, Any]) -> bool:
    """Check if today is the sprint end date."""
    try:
        end_str = sprint.get("endDate")
        if not end_str:
            return False
        
        end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        today = datetime.now(timezone.utc).date()
        end_date = end.date()
        
        return today == end_date
    except Exception as e:
        print(f"⚠️  Error checking sprint end: {e}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate mid-sprint review report")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force report generation regardless of sprint midpoint date"
    )
    args = parser.parse_args()

    sprint = get_current_or_recent_sprint(BOARD_ID)
    if not sprint:
        raise RuntimeError("No active sprint found for board")

    # Check if today is the sprint midpoint (unless --force is used)
    if not args.force and not is_sprint_midpoint_today(sprint):
        midpoint = get_sprint_midpoint_date(sprint)
        midpoint_str = midpoint.strftime("%Y-%m-%d") if midpoint else "unknown"
        print(f"ℹ️  Today is not the sprint midpoint (midpoint: {midpoint_str})")
        print(f"   Sprint: {sprint.get('name')}")
        print(f"   Start: {sprint.get('startDate', 'N/A')}")
        print(f"   End: {sprint.get('endDate', 'N/A')}")
        print(f"\n💡 Tip: Use --force flag to generate report at any time")
        return
    
    if args.force:
        print(f"🚀 Forcing report generation (bypassing midpoint check)...")
    else:
        print(f"✅ Today is sprint midpoint! Generating report...")
    print(f"   Sprint: {sprint.get('name')}")

    issues = get_sprint_issues(BOARD_ID, sprint["id"])
    
    # Parse sprint end date for risk analysis
    end_str = sprint.get("endDate")
    sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
    
    metrics = compute_metrics(issues, sprint_end)
    ai_note = maybe_ai_notes(sprint, metrics)
    html = format_html(sprint, metrics, ai_note)

    today = datetime.now().strftime("%Y-%m-%d")
    title = f"{sprint.get('name')} - Mid-Sprint Review ({today})"
    publish_to_confluence(title, html, sprint)
    print(f"✅ Published mid-sprint review: {title}")


if __name__ == "__main__":
    main()
