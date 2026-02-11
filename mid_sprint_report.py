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
                issues.extend(page.get("issues", []))
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
    return data.get("issues", [])


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


def _get_issue_age_days(issue: Dict[str, Any]) -> int:
    """Calculate how many days an issue has been in current status."""
    try:
        # Try to get last status change from changelog (would need API call)
        # For now, use creation date as approximation
        created = issue["fields"].get("created")
        if created:
            created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - created_dt).days
    except Exception:
        pass
    return 0


def detect_risks(issues: List[Dict[str, Any]], sprint_start: Optional[datetime], sprint_end: Optional[datetime]) -> Dict[str, List[Dict[str, Any]]]:
    """Enhanced risk detection with multiple risk categories."""
    now = datetime.now(timezone.utc)
    days_left = (sprint_end - now).days if sprint_end else 999
    sprint_duration = (sprint_end - sprint_start).days if (sprint_end and sprint_start) else 14
    
    risks = {
        "stale_in_progress": [],      # In progress for too long
        "unassigned_high_priority": [], # High priority with no assignee
        "overdue_tasks": [],           # Past expected completion
        "blocked_items": [],           # Explicitly blocked
        "large_items_todo": [],        # Large stories not started
        "sprint_goal_risk": [],        # Critical for sprint goal
    }
    
    def get_priority(issue: Dict[str, Any]) -> str:
        try:
            priority_obj = issue.get("fields", {}).get("priority")
            return priority_obj.get("name", "Medium") if isinstance(priority_obj, dict) else "Medium"
        except Exception:
            return "Medium"
    
    def is_blocked(issue: Dict[str, Any]) -> bool:
        try:
            fields = issue.get("fields", {})
            status_name = fields.get("status", {}).get("name", "").lower()
            labels = fields.get("labels", [])
            flagged = fields.get("flagged", False)
            return flagged or "blocked" in status_name or any(l.lower() == "blocked" for l in labels)
        except Exception:
            return False
    
    for issue in issues:
        if not issue or not isinstance(issue, dict):
            continue
            
        cat = _status_category(issue)
        pts = _story_points(issue)
        priority = get_priority(issue)
        assignee = issue.get("fields", {}).get("assignee")
        age_days = _get_issue_age_days(issue)
        
        # Rule 1: Stale in-progress items (in progress > 3 days)
        if cat == "indeterminate" and age_days >= 3:
            risks["stale_in_progress"].append({
                "issue": issue,
                "reason": f"In progress for {age_days} days with no updates",
                "severity": "high" if age_days >= 5 else "medium"
            })
        
        # Rule 2: Unassigned high priority items
        if not assignee and priority in ["Highest", "High"]:
            risks["unassigned_high_priority"].append({
                "issue": issue,
                "reason": f"{priority} priority issue not assigned",
                "severity": "high"
            })
        
        # Rule 3: Large items still in To Do with limited time
        if cat == "new" and pts >= 8 and days_left <= 3:
            risks["large_items_todo"].append({
                "issue": issue,
                "reason": f"Large story ({pts} points) not started with {days_left} days left",
                "severity": "critical"
            })
        
        # Rule 4: In progress items with high points near sprint end
        if cat == "indeterminate" and pts >= 5 and days_left <= 2:
            risks["sprint_goal_risk"].append({
                "issue": issue,
                "reason": f"{pts} point story in progress with only {days_left} days remaining",
                "severity": "high"
            })
        
        # Rule 5: Blocked items
        if is_blocked(issue):
            risks["blocked_items"].append({
                "issue": issue,
                "reason": "Issue is blocked or flagged",
                "severity": "critical"
            })
    
    return risks


def calculate_sprint_health_score(metrics: Dict[str, Any], risks: Dict[str, List[Dict[str, Any]]], sprint_start: Optional[datetime], sprint_end: Optional[datetime]) -> Dict[str, Any]:
    """Calculate a 0-100 health score based on multiple factors."""
    now = datetime.now(timezone.utc)
    
    # Factor 1: Completion Rate (30 points)
    completion_pct = metrics.get("completion_pct", 0)
    completion_score = min(30, (completion_pct / 100) * 30)
    
    # Factor 2: Pace vs Time Remaining (25 points)
    if sprint_start and sprint_end:
        sprint_duration = (sprint_end - sprint_start).total_seconds()
        elapsed = (now - sprint_start).total_seconds()
        time_pct = (elapsed / sprint_duration * 100) if sprint_duration > 0 else 0
        
        # Ideal: completion should match time elapsed
        pace_diff = completion_pct - time_pct
        if pace_diff >= 10:
            pace_score = 25  # Ahead of schedule
        elif pace_diff >= 0:
            pace_score = 20  # On track
        elif pace_diff >= -10:
            pace_score = 15  # Slightly behind
        elif pace_diff >= -20:
            pace_score = 10  # Behind
        else:
            pace_score = 5   # Significantly behind
    else:
        pace_score = 15  # Default to neutral
    
    # Factor 3: Blocked Issues (15 points)
    blocked_count = len(risks.get("blocked_items", []))
    if blocked_count == 0:
        blocked_score = 15
    elif blocked_count <= 2:
        blocked_score = 10
    elif blocked_count <= 5:
        blocked_score = 5
    else:
        blocked_score = 0
    
    # Factor 4: Stale/At-Risk Items (15 points)
    stale_count = len(risks.get("stale_in_progress", []))
    critical_risks = len([r for r in risks.get("sprint_goal_risk", []) if r.get("severity") == "critical"])
    total_risks = stale_count + critical_risks
    
    if total_risks == 0:
        risk_score = 15
    elif total_risks <= 2:
        risk_score = 10
    elif total_risks <= 5:
        risk_score = 5
    else:
        risk_score = 0
    
    # Factor 5: Velocity vs Capacity (15 points)
    # Simplified: based on total issues completed vs remaining time
    counts = metrics.get("counts", {})
    total = counts.get("total", 1)
    done = counts.get("done", 0)
    in_progress = counts.get("in_progress", 0)
    
    # If we have good completion rate, velocity is good
    work_distribution_score = 15
    if done < total * 0.3:  # Less than 30% done
        work_distribution_score = 5
    elif done < total * 0.5:  # Less than 50% done
        work_distribution_score = 10
    
    # Calculate total score
    total_score = completion_score + pace_score + blocked_score + risk_score + work_distribution_score
    total_score = min(100, max(0, round(total_score)))
    
    # Determine health status
    if total_score >= 80:
        status = "Excellent"
        emoji = "🟢"
        color = "#4caf50"
    elif total_score >= 65:
        status = "Good"
        emoji = "🟢"
        color = "#8bc34a"
    elif total_score >= 50:
        status = "Fair"
        emoji = "🟡"
        color = "#ffc107"
    elif total_score >= 35:
        status = "At Risk"
        emoji = "🟠"
        color = "#ff9800"
    else:
        status = "Critical"
        emoji = "🔴"
        color = "#f44336"
    
    return {
        "score": total_score,
        "status": status,
        "emoji": emoji,
        "color": color,
        "breakdown": {
            "completion": round(completion_score, 1),
            "pace": round(pace_score, 1),
            "blockers": round(blocked_score, 1),
            "risks": round(risk_score, 1),
            "velocity": round(work_distribution_score, 1),
        }
    }


def compute_metrics(issues: List[Dict[str, Any]], sprint_end: Optional[datetime] = None) -> Dict[str, Any]:
    done, in_prog, todo = [], [], []
    blocked: List[Dict[str, Any]] = []
    at_risk: List[Dict[str, Any]] = []
    high_priority_todo: List[Dict[str, Any]] = []
    total_points = done_points = in_prog_points = todo_points = 0.0

    now = datetime.now(timezone.utc)
    days_left = (sprint_end - now).days if sprint_end else 999

    # Helper to safely get priority name
    def get_priority(issue: Dict[str, Any]) -> str:
        try:
            fields = issue.get("fields")
            if fields is None:
                return "Medium"
            priority_obj = fields.get("priority")
            if priority_obj is None:
                return "Medium"
            return priority_obj.get("name", "Medium") if isinstance(priority_obj, dict) else "Medium"
        except Exception:
            return "Medium"

    for issue in issues:
        # Skip if issue is None or fields is None
        if issue is None or not isinstance(issue, dict) or issue.get("fields") is None:
            continue
            
        cat = _status_category(issue)
        pts = _story_points(issue)
        total_points += pts
        priority = get_priority(issue)
        
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

        fields = issue.get("fields", {})
        status_obj = fields.get("status") if isinstance(fields, dict) else {}
        status_name = status_obj.get("name", "") if isinstance(status_obj, dict) else ""
        labels = fields.get("labels", []) if isinstance(fields, dict) else []
        labels = labels if isinstance(labels, list) else []
        flagged = fields.get("flagged", False) if isinstance(fields, dict) else False
        if flagged or "blocked" in str(status_name).lower() or any(l.lower() == "blocked" for l in (labels or [])):
            blocked.append(issue)

    completion = (done_points / total_points * 100) if total_points else 0.0
    
    # If no story points are assigned, use issue count as fallback
    if total_points == 0 and len(issues) > 0:
        completion = (len(done) / len(issues) * 100)
    
    # Sort at-risk by points descending
    at_risk.sort(key=lambda x: _story_points(x), reverse=True)
    # Sort high priority by priority and points
    priority_order = {"Highest": 0, "High": 1, "Medium": 2, "Low": 3, "Lowest": 4}
    high_priority_todo.sort(key=lambda x: (priority_order.get(get_priority(x), 2), -_story_points(x)))
    
    metrics_data = {
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
    
    return metrics_data


def format_html(sprint: Dict[str, Any], metrics: Dict[str, Any], notes: str = "", retro_insights: str = "", issues: List[Dict[str, Any]] = None) -> str:
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
    
    # Calculate enhanced risks and health score
    risks = detect_risks(issues or [], start_dt, end_dt) if issues else {}
    health = calculate_sprint_health_score(metrics, risks, start_dt, end_dt)

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
            
            # Save chart to temp file and convert to base64
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                chart_path = tmp.name
            fig.savefig(chart_path, dpi=100, bbox_inches='tight', facecolor='white')
            plt.close(fig)
            
            # Read chart and convert to base64 for embedding
            with open(chart_path, 'rb') as f:
                chart_data = f.read()
                chart_base64 = base64.b64encode(chart_data).decode('utf-8')
            
            # Embed as base64 data URL (works in Confluence)
            chart_html = f'<img src="data:image/png;base64,{chart_base64}" alt="Sprint Progress Chart" style="max-width:500px;" />'
            
            # Clean up temp file
            os.remove(chart_path)
            print(f"📊 Chart generated and embedded")
        except Exception as e:
            print(f"⚠️ Chart generation failed: {e}")
            chart_html = f"<p><em>{int(completion_pct)}% complete - {status_text}</em></p>"
    else:
        print(f"⚠️ matplotlib not available, using text fallback")
        chart_html = f"<p><em>{int(completion_pct)}% complete - {status_text}</em></p>"
    
    # Sprint Health Score Section
    health_html = f"""<h2>{health['emoji']} Sprint Health Score: {health['score']}/100 - {health['status']}</h2>
<div style='background-color:{health['color']}15; border-left: 4px solid {health['color']}; padding: 15px; margin: 10px 0;'>
<p style='font-size: 18px; margin: 5px 0;'><strong>Overall Health: {health['score']}/100</strong> {health['emoji']}</p>
<table border='0' style='width:100%; margin:10px 0;'>
  <tr><td style='padding:5px;'>✅ Completion Rate:</td><td><strong>{health['breakdown']['completion']}/30</strong></td></tr>
  <tr><td style='padding:5px;'>⏱️ Pace vs Timeline:</td><td><strong>{health['breakdown']['pace']}/25</strong></td></tr>
  <tr><td style='padding:5px;'>🚫 Blocker Management:</td><td><strong>{health['breakdown']['blockers']}/15</strong></td></tr>
  <tr><td style='padding:5px;'>⚠️ Risk Mitigation:</td><td><strong>{health['breakdown']['risks']}/15</strong></td></tr>
  <tr><td style='padding:5px;'>📊 Work Distribution:</td><td><strong>{health['breakdown']['velocity']}/15</strong></td></tr>
</table>
</div>"""
    
    progress_html = f"""<h2>🏁 Sprint Progress</h2>
<div style='text-align: left;'>
{chart_html}
<p><strong>{counts['done']} of {counts['total']}</strong> issues completed | <strong>{pts['done']:.1f} of {pts['total']:.1f}</strong> story points done</p>
</div>"""
    
    # Build enhanced risk detection section
    enhanced_risks_html = "<h2>🚨 Enhanced Risk Detection</h2>"
    
    total_risks = sum(len(v) for v in risks.values())
    if total_risks == 0:
        enhanced_risks_html += "<p style='color:#4caf50; font-weight:bold;'>✅ No significant risks detected! Sprint is healthy.</p>"
    else:
        enhanced_risks_html += f"<p style='color:#ff9800; font-weight:bold;'>⚠️ {total_risks} potential risks identified</p>"
        
        # Stale in-progress items
        if risks.get("stale_in_progress"):
            enhanced_risks_html += "<h3>⏰ Stale In-Progress Items</h3>"
            enhanced_risks_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
            enhanced_risks_html += "<tr style='background-color:#fff3cd;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Assignee</th><th>Risk</th><th>Severity</th></tr>"
            for risk_item in risks["stale_in_progress"][:5]:
                issue = risk_item["issue"]
                key = issue.get("key", "")
                summary = issue.get("fields", {}).get("summary", "")
                assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
                severity_color = "#d32f2f" if risk_item["severity"] == "critical" else ("#f57c00" if risk_item["severity"] == "high" else "#fbc02d")
                enhanced_risks_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{assignee}</td><td>{risk_item['reason']}</td><td style='color:{severity_color}; font-weight:bold;'>{risk_item['severity'].upper()}</td></tr>"
            enhanced_risks_html += "</table>"
        
        # Unassigned high priority
        if risks.get("unassigned_high_priority"):
            enhanced_risks_html += "<h3>👤 Unassigned High Priority Items</h3>"
            enhanced_risks_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
            enhanced_risks_html += "<tr style='background-color:#ffebee;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Priority</th><th>Risk</th></tr>"
            for risk_item in risks["unassigned_high_priority"][:5]:
                issue = risk_item["issue"]
                key = issue.get("key", "")
                summary = issue.get("fields", {}).get("summary", "")
                priority = issue.get("fields", {}).get("priority", {}).get("name", "Medium")
                enhanced_risks_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{priority}</td><td>{risk_item['reason']}</td></tr>"
            enhanced_risks_html += "</table>"
        
        # Large items not started
        if risks.get("large_items_todo"):
            enhanced_risks_html += "<h3>📦 Large Items Not Started</h3>"
            enhanced_risks_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
            enhanced_risks_html += "<tr style='background-color:#ffe0b2;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Points</th><th>Risk</th><th>Severity</th></tr>"
            for risk_item in risks["large_items_todo"][:5]:
                issue = risk_item["issue"]
                key = issue.get("key", "")
                summary = issue.get("fields", {}).get("summary", "")
                points = _story_points(issue)
                enhanced_risks_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{points}</td><td>{risk_item['reason']}</td><td style='color:#d32f2f; font-weight:bold;'>{risk_item['severity'].upper()}</td></tr>"
            enhanced_risks_html += "</table>"
        
        # Sprint goal at risk
        if risks.get("sprint_goal_risk"):
            enhanced_risks_html += "<h3>🎯 Sprint Goal at Risk</h3>"
            enhanced_risks_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
            enhanced_risks_html += "<tr style='background-color:#fce4ec;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Points</th><th>Assignee</th><th>Risk</th></tr>"
            for risk_item in risks["sprint_goal_risk"][:5]:
                issue = risk_item["issue"]
                key = issue.get("key", "")
                summary = issue.get("fields", {}).get("summary", "")
                points = _story_points(issue)
                assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
                enhanced_risks_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{points}</td><td>{assignee}</td><td>{risk_item['reason']}</td></tr>"
            enhanced_risks_html += "</table>"
        
        # Blocked items
        if risks.get("blocked_items"):
            enhanced_risks_html += "<h3>🚫 Blocked Items</h3>"
            enhanced_risks_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
            enhanced_risks_html += "<tr style='background-color:#ffcdd2;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Assignee</th><th>Status</th></tr>"
            for risk_item in risks["blocked_items"][:5]:
                issue = risk_item["issue"]
                key = issue.get("key", "")
                summary = issue.get("fields", {}).get("summary", "")
                assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
                status = issue.get("fields", {}).get("status", {}).get("name", "")
                enhanced_risks_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{assignee}</td><td>{status}</td></tr>"
            enhanced_risks_html += "</table>"
    
    # Build spillover risk section (keep legacy for compatibility)
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
    
    {health_html}
    
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
    
    {enhanced_risks_html}
    
    <h2>📋 Additional Details</h2>
    <h3>⚠️ Legacy At-Risk Analysis</h3>
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
    
    {"<h2>🔄 Retrospective Briefing (Sprint End)</h2>" + retro_insights if retro_insights else ""}
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


def publish_to_confluence(title: str, html: str, sprint_data: Dict[str, Any] = None, parent_title: str = "Mid-Sprint Reviews") -> str:
    """Publish report to Confluence and return the page URL."""
    try:
        uploader = ConfluenceUploader()
        parent = uploader.find_existing_page(parent_title)
        if parent:
            parent_id = parent["id"]
            print(f"📁 Found parent page: {parent_title}")
        else:
            print(f"📁 Creating parent page: {parent_title}")
            parent_content = f"<h1>{parent_title}</h1><p>Automatically generated sprint reports and retrospectives.</p>"
            parent_id = uploader.create_page(parent_title, parent_content)

        existing = uploader.find_existing_page(title)
        if existing:
            page_id = existing["id"]
            print(f"📝 Updating existing page: {title}")
            uploader.update_page(page_id, title, html, existing["version"]["number"], parent_id)
        else:
            print(f"📝 Creating new page: {title}")
            page_id = uploader.create_page(title, html, parent_id)
        
        # Build Confluence URL
        confluence_url = f"{ATLASSIAN_BASE}/wiki/spaces/{SPACE_KEY}/pages/{page_id}"
        
        return confluence_url
    except Exception as e:
        print(f"❌ Error publishing to Confluence: {e}")
        import traceback
        traceback.print_exc()
        raise


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


def analyze_sprint_for_retro(issues: List[Dict[str, Any]], sprint: Dict[str, Any], metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze sprint data to extract insights for retrospective."""
    
    # Extract key data points
    total_issues = len(issues)
    completed_issues = metrics["counts"]["done"]
    blocked_issues = metrics["counts"]["blocked"]
    at_risk_issues = metrics["counts"]["at_risk"]
    
    # Calculate velocity
    total_points = metrics["points"]["total"]
    completed_points = metrics["points"]["done"]
    completion_pct = metrics["completion_pct"]
    
    # Analyze blockers
    blocker_reasons = {}
    blocker_list = []
    for issue in issues:
        if issue in [i for sublist in [metrics.get(k, []) for k in ["at_risk_issues", "all_in_progress", "high_priority_todo"]] for i in sublist]:
            labels = issue.get("fields", {}).get("labels", []) or []
            status = issue.get("fields", {}).get("status", {}).get("name", "")
            
            # Identify blocker reasons from labels and status
            for label in labels:
                if "blocked" in label.lower():
                    blocker_reasons[label] = blocker_reasons.get(label, 0) + 1
            
            if "blocked" in status.lower():
                blocker_reasons["Status: Blocked"] = blocker_reasons.get("Status: Blocked", 0) + 1
            
            # Track blocked issues
            if blocked_issues > 0 and issue.get("key") in metrics["blocked_keys"]:
                blocker_list.append({
                    "key": issue.get("key"),
                    "summary": issue.get("fields", {}).get("summary", ""),
                    "points": _story_points(issue),
                    "assignee": issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned",
                })
    
    # Analyze work distribution
    assignee_workload = {}
    for issue in issues:
        assignee_obj = issue.get("fields", {}).get("assignee")
        if assignee_obj:
            assignee_name = assignee_obj.get("displayName", "Unknown")
            points = _story_points(issue)
            if assignee_name not in assignee_workload:
                assignee_workload[assignee_name] = {"count": 0, "points": 0, "completed": 0}
            assignee_workload[assignee_name]["count"] += 1
            assignee_workload[assignee_name]["points"] += points
            
            # Check if issue is completed
            if _status_category(issue) == "done":
                assignee_workload[assignee_name]["completed"] += 1
    
    # Find team members with high variance (over/under utilization)
    avg_points = total_points / len(assignee_workload) if assignee_workload else 0
    overloaded = [name for name, data in assignee_workload.items() if data["points"] > avg_points * 1.3]
    underutilized = [name for name, data in assignee_workload.items() if data["points"] < avg_points * 0.7]
    
    # Identify patterns from issue summary analysis
    issue_categories = {"bug": 0, "feature": 0, "refactor": 0, "tech_debt": 0, "other": 0}
    keywords = {
        "bug": ["bug", "fix", "defect", "issue", "error", "crash"],
        "feature": ["feature", "implement", "add", "new"],
        "refactor": ["refactor", "cleanup", "optimize", "improve"],
        "tech_debt": ["tech debt", "technical debt", "deprecat", "upgrade", "update"],
    }
    
    for issue in issues:
        summary = (issue.get("fields", {}).get("summary", "") or "").lower()
        categorized = False
        for category, words in keywords.items():
            if any(word in summary for word in words):
                issue_categories[category] += 1
                categorized = True
                break
        if not categorized:
            issue_categories["other"] += 1
    
    return {
        "total_issues": total_issues,
        "completed_issues": completed_issues,
        "completion_pct": completion_pct,
        "total_points": total_points,
        "completed_points": completed_points,
        "blocked_count": blocked_issues,
        "at_risk_count": at_risk_issues,
        "blocker_reasons": dict(sorted(blocker_reasons.items(), key=lambda x: x[1], reverse=True)[:5]),
        "blocker_list": blocker_list[:5],
        "assignee_workload": assignee_workload,
        "overloaded_members": overloaded,
        "underutilized_members": underutilized,
        "issue_distribution": issue_categories,
        "sprint_name": sprint.get("name"),
    }


def generate_retro_insights(retro_data: Dict[str, Any], sprint: Dict[str, Any]) -> str:
    """Generate AI-powered retrospective insights and suggested topics."""
    if not OPENAI_API_KEY:
        return "<p><em>AI retrospective insights disabled: OPENAI_API_KEY not set</em></p>"
    
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Build detailed context for better insights
        completion_status = "excellent" if retro_data['completion_pct'] >= 80 else "good" if retro_data['completion_pct'] >= 60 else "concerning"
        velocity = retro_data['completed_points'] / retro_data['total_points'] * 100 if retro_data['total_points'] > 0 else 0
        
        # Analyze team capacity issues
        capacity_issues = []
        if retro_data['overloaded_members']:
            capacity_issues.append(f"{len(retro_data['overloaded_members'])} team member(s) were overloaded: {', '.join(retro_data['overloaded_members'])}")
        if retro_data['underutilized_members']:
            capacity_issues.append(f"{len(retro_data['underutilized_members'])} team member(s) were underutilized: {', '.join(retro_data['underutilized_members'])}")
        
        # Identify primary work focus
        top_work_type = max(retro_data['issue_distribution'].items(), key=lambda x: x[1])[0] if retro_data['issue_distribution'] else "unknown"
        
        prompt = f"""You are an experienced agile coach analyzing sprint data. Generate SPECIFIC, ACTIONABLE retrospective insights.

SPRINT DATA ANALYSIS:
Sprint: {retro_data['sprint_name']}
Completion: {retro_data['completion_pct']}% ({retro_data['completed_issues']}/{retro_data['total_issues']} issues, {retro_data['completed_points']:.1f}/{retro_data['total_points']:.1f} points)
Status: {completion_status}

BLOCKER ANALYSIS:
- {retro_data['blocked_count']} blocked issues
- {retro_data['at_risk_count']} at-risk issues
- Top blockers: {', '.join([f"{k} ({v}x)" for k, v in list(retro_data['blocker_reasons'].items())[:3]]) if retro_data['blocker_reasons'] else 'None'}

TEAM CAPACITY:
{chr(10).join(['- ' + issue for issue in capacity_issues]) if capacity_issues else '- Balanced workload distribution'}

WORK TYPE BREAKDOWN:
- Primary focus: {top_work_type.replace('_', ' ').title()} ({retro_data['issue_distribution'].get(top_work_type, 0)} issues)
- Distribution: {', '.join([f"{k.replace('_', ' ').title()}: {v}" for k, v in retro_data['issue_distribution'].items()])}

REQUIREMENTS:
1. Be SPECIFIC - reference actual numbers and team members
2. Be ACTIONABLE - every insight must have a concrete next step
3. Prioritize by IMPACT - focus on issues that affected sprint goals most
4. Be REALISTIC - recommendations must be implementable in next sprint

Generate HTML with these sections:

<h3>✅ What Went Well</h3>
<ul>
[2-3 specific positive outcomes with numbers. Examples:
- "Team completed 85% of committed story points despite 3 blocked issues"
- "Bug resolution improved by focusing 40% of sprint on technical debt"]
</ul>

<h3>⚠️ What Needs Improvement</h3>
<ul>
[3-4 specific problems with root causes. Examples:
- "3 team members (John, Sarah, Mike) were overloaded with 30% above average workload - caused by uneven story assignment"
- "5 issues blocked due to external API dependencies - no fallback plan defined"]
</ul>

<h3>🎯 Suggested Discussion Topics for Retro</h3>
<ol>
[5-7 SPECIFIC questions tied to actual data. Examples:
- "How can we prevent the 'API Integration' blocker (occurred 3 times) in next sprint?"
- "Should we implement WIP limits? Sarah handled 12 issues vs team avg of 5."
- "Why did 40% of bugs emerge in last 2 days? Was testing delayed?"]
</ol>

<h3>🚀 Action Items for Next Sprint</h3>
<ol>
[3-5 CONCRETE actions with owners/metrics. Examples:
- "Implement daily blocker review in standup (SM to facilitate)"
- "Set WIP limit of 3 in-progress issues per person (team to agree)"
- "Create API dependency checklist before sprint planning (Tech Lead to draft)"
- "Balance workload: aim for ±20% variance from team average (SM to monitor)"]
</ol>

NO GENERIC ADVICE. Every point must reference specific sprint data."""
        
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2500,
            temperature=0.2,
        )
        
        return resp.choices[0].message.content.strip()
    
    except Exception as exc:
        return f"<p><em>⚠️ Retro insights generation failed: {exc}</em></p>"


def format_retrospective_page(sprint: Dict[str, Any], retro_data: Dict[str, Any], ai_insights: str, metrics: Dict[str, Any]) -> str:
    """Format a dedicated retrospective page with detailed sprint data."""
    end = sprint.get("endDate")
    start = sprint.get("startDate")
    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00")) if end else None
    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00")) if start else None
    
    duration = (end_dt - start_dt).days if (end_dt and start_dt) else "?"
    
    # Build workload distribution table
    workload_html = "<h3>👥 Team Workload Distribution</h3>"
    workload_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
    workload_html += "<tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Team Member</th><th>Issues</th><th>Story Points</th><th>Completed</th><th>Completion %</th></tr>"
    
    for name, data in sorted(retro_data['assignee_workload'].items(), key=lambda x: x[1]['points'], reverse=True):
        completion_pct = (data['completed'] / data['count'] * 100) if data['count'] > 0 else 0
        row_color = ""
        if name in retro_data['overloaded_members']:
            row_color = "background-color:#ffe0e0;"
        elif name in retro_data['underutilized_members']:
            row_color = "background-color:#fff8e0;"
        
        workload_html += f"<tr style='{row_color}'><td style='padding:8px;'>{name}</td><td>{data['count']}</td><td>{data['points']:.1f}</td><td>{data['completed']}</td><td>{completion_pct:.0f}%</td></tr>"
    
    workload_html += "</table>"
    
    if retro_data['overloaded_members']:
        workload_html += f"<p>⚠️ <strong>Overloaded:</strong> {', '.join(retro_data['overloaded_members'])}</p>"
    if retro_data['underutilized_members']:
        workload_html += f"<p>ℹ️ <strong>Underutilized:</strong> {', '.join(retro_data['underutilized_members'])}</p>"
    
    # Build issue distribution chart
    issue_dist_html = "<h3>📊 Work Type Distribution</h3>"
    issue_dist_html += "<table border='1' style='border-collapse:collapse; width:60%; margin:10px 0;'>"
    issue_dist_html += "<tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Category</th><th>Count</th><th>%</th></tr>"
    
    total_categorized = sum(retro_data['issue_distribution'].values())
    for category, count in sorted(retro_data['issue_distribution'].items(), key=lambda x: x[1], reverse=True):
        pct = (count / total_categorized * 100) if total_categorized > 0 else 0
        issue_dist_html += f"<tr><td style='padding:8px;'>{category.replace('_', ' ').title()}</td><td>{count}</td><td>{pct:.1f}%</td></tr>"
    
    issue_dist_html += "</table>"
    
    # Build blocker analysis
    blocker_html = "<h3>🚫 Blocker Analysis</h3>"
    if retro_data['blocker_reasons']:
        blocker_html += "<table border='1' style='border-collapse:collapse; width:70%; margin:10px 0;'>"
        blocker_html += "<tr style='background-color:#ffe0e0;'><th style='padding:8px;'>Blocker Reason</th><th>Occurrences</th></tr>"
        for reason, count in retro_data['blocker_reasons'].items():
            blocker_html += f"<tr><td style='padding:8px;'>{reason}</td><td>{count}</td></tr>"
        blocker_html += "</table>"
    else:
        blocker_html += "<p>✅ No significant blockers identified</p>"
    
    # List blocked items
    if retro_data['blocker_list']:
        blocker_html += "<h4>Blocked Items Detail</h4>"
        blocker_html += "<ul>"
        for item in retro_data['blocker_list']:
            blocker_html += f"<li><a href='{ATLASSIAN_BASE}/browse/{item['key']}'>{item['key']}</a>: {item['summary']} ({item['points']} pts, Assignee: {item['assignee']})</li>"
        blocker_html += "</ul>"
    
    return f"""
    <div style='text-align: left;'>
    <h1>🔄 Sprint Retrospective: {sprint.get('name')}</h1>
    <p><strong>Sprint Duration</strong>: {start_dt.date() if start_dt else '?'} → {end_dt.date() if end_dt else '?'} ({duration} days)</p>
    <p><strong>Board</strong>: {BOARD_ID or 'n/a'} | <strong>Project</strong>: {PROJECT_KEY or 'n/a'}</p>
    
    <h2>📈 Sprint Summary</h2>
    <table border='1' style='border-collapse:collapse; width:80%; margin:10px 0;'>
      <tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Metric</th><th>Value</th></tr>
      <tr><td style='padding:8px;'>Total Issues</td><td>{retro_data['total_issues']}</td></tr>
      <tr><td style='padding:8px;'>Completed Issues</td><td>{retro_data['completed_issues']}</td></tr>
      <tr><td style='padding:8px;'>Completion %</td><td><strong>{retro_data['completion_pct']}%</strong></td></tr>
      <tr><td style='padding:8px;'>Story Points Completed</td><td>{retro_data['completed_points']:.1f} / {retro_data['total_points']:.1f}</td></tr>
      <tr><td style='padding:8px;'>Blocked Issues</td><td>{retro_data['blocked_count']}</td></tr>
      <tr><td style='padding:8px;'>At-Risk Issues</td><td>{retro_data['at_risk_count']}</td></tr>
    </table>
    
    {workload_html}
    
    {issue_dist_html}
    
    {blocker_html}
    
    <h2>💡 AI-Generated Insights</h2>
    {ai_insights}
    
    <hr style='margin: 30px 0;'>
    <p style='color:#666; font-size:0.9em;'>This retrospective was automatically generated on {datetime.now().strftime("%Y-%m-%d %H:%M")}. Data is based on sprint metrics at the time of generation.</p>
    </div>
    """


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate mid-sprint review report")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force report generation regardless of sprint midpoint date"
    )
    parser.add_argument(
        "--sprint-end",
        action="store_true",
        help="Generate sprint-end report with retrospective insights (for testing)"
    )
    args = parser.parse_args()

    sprint = get_current_or_recent_sprint(BOARD_ID)
    if not sprint:
        raise RuntimeError("No active sprint found for board")

    # Check if today is sprint end - if so, generate retro insights
    is_sprint_ending = is_sprint_end_today(sprint) or args.sprint_end
    
    # Check if today is the sprint midpoint (unless --force is used)
    if not args.force and not is_sprint_midpoint_today(sprint) and not is_sprint_ending:
        midpoint = get_sprint_midpoint_date(sprint)
        midpoint_str = midpoint.strftime("%Y-%m-%d") if midpoint else "unknown"
        end_str = sprint.get("endDate")
        end_date_str = end_str.split("T")[0] if end_str else "unknown"
        print(f"ℹ️  Today is not the sprint midpoint or end date")
        print(f"   Sprint: {sprint.get('name')}")
        print(f"   Midpoint: {midpoint_str}")
        print(f"   End date: {end_date_str}")
        print(f"   Start: {sprint.get('startDate', 'N/A')}")
        print(f"\n💡 Tip: Use --force flag to generate report at any time")
        return
    
    if args.force:
        print(f"🚀 Forcing report generation (bypassing date check)...")
    elif is_sprint_ending:
        print(f"✅ Today is sprint end! Generating report with retrospective insights...")
    else:
        print(f"✅ Today is sprint midpoint! Generating report...")
    print(f"   Sprint: {sprint.get('name')}")

    issues = get_sprint_issues(BOARD_ID, sprint["id"])
    
    # Parse sprint end date for risk analysis
    end_str = sprint.get("endDate")
    sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
    
    metrics = compute_metrics(issues, sprint_end)
    ai_note = maybe_ai_notes(sprint, metrics)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Generate retrospective insights if it's sprint end
    if is_sprint_ending:
        print("📊 Analyzing sprint for retrospective insights...")
        retro_data = analyze_sprint_for_retro(issues, sprint, metrics)
        retro_insights_html = generate_retro_insights(retro_data, sprint)
        print("✨ Retrospective insights generated")
        
        # Publish dedicated retrospective page
        print(f"\n📤 Publishing Sprint Retrospective to Confluence...")
        retro_html = format_retrospective_page(sprint, retro_data, retro_insights_html, metrics)
        retro_title = f"{sprint.get('name')} - Sprint Retrospective ({today})"
        retro_url = publish_to_confluence(retro_title, retro_html, sprint, parent_title="Sprint Retrospectives")
        print(f"\n✅ Published sprint retrospective: {retro_title}")
        print(f"🔗 View retrospective: {retro_url}\n")
    else:
        # Regular mid-sprint review
        print(f"\n📤 Publishing Mid-Sprint Review to Confluence...")
        html = format_html(sprint, metrics, ai_note, "", issues)
        title = f"{sprint.get('name')} - Mid-Sprint Review ({today})"
        confluence_url = publish_to_confluence(title, html, sprint)
        print(f"\n✅ Published mid-sprint review: {title}")
        print(f"🔗 View report: {confluence_url}\n")


if __name__ == "__main__":
    main()
