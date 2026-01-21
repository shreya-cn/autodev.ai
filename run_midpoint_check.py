#!/usr/bin/env python3
"""
Standalone script to check and generate sprint reports at midpoint and end.
Designed to be run by cron/launchd daily.
"""

import sys
from datetime import datetime, timezone
from mid_sprint_report import (
    get_current_or_recent_sprint,
    get_sprint_midpoint_date,
    is_sprint_midpoint_today,
    is_sprint_end_today,
    get_sprint_issues,
    compute_metrics,
    maybe_ai_notes,
    format_html,
    publish_to_confluence,
    BOARD_ID
)

def generate_sprint_end_report(sprint, issues, metrics):
    """Generate end-of-sprint report with completion summary."""
    from mid_sprint_report import _story_points, _status_category, ATLASSIAN_BASE, BOARD_ID, PROJECT_KEY
    import tempfile
    
    end_str = sprint.get("endDate")
    start_str = sprint.get("startDate")
    end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
    start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00")) if start_str else None
    
    counts = metrics["counts"]
    pts = metrics["points"]
    completion_pct = metrics.get("completion_pct", 0)
    blocked = ", ".join(metrics["blocked_keys"]) or "None"
    
    # Sprint summary stats
    duration = (end_dt - start_dt).days if (end_dt and start_dt) else "?"
    spillover_issues = counts['todo'] + counts['in_progress']
    spillover_points = pts['todo'] + pts['in_progress']
    
    # Status determination
    if completion_pct >= 90:
        status_text = "Excellent"
        color = "#4caf50"
    elif completion_pct >= 75:
        status_text = "Good"
        color = "#8bc34a"
    elif completion_pct >= 50:
        status_text = "Fair"
        color = "#ffc107"
    else:
        status_text = "Needs Improvement"
        color = "#ff5722"
    
    # Generate chart for sprint end
    chart_html = ""
    try:
        import matplotlib.pyplot as plt
        done = max(0, min(100, int(round(completion_pct))))
        remaining = 100 - done
        
        fig, ax = plt.subplots(figsize=(6, 6))
        wedges, texts, autotexts = ax.pie(
            [done, remaining],
            labels=['Completed', 'Spillover'],
            colors=[color, '#e0e0e0'],
            autopct='%1.0f%%',
            startangle=90,
            wedgeprops={'width': 0.3, 'edgecolor': 'white', 'linewidth': 2},
            textprops={'fontsize': 12, 'weight': 'bold'}
        )
        ax.set_title(f'{int(completion_pct)}% Complete', fontsize=16, weight='bold', pad=20)
        
        # Save chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            chart_path = tmp.name
        fig.savefig(chart_path, dpi=100, bbox_inches='tight', facecolor='white')
        plt.close(fig)
        
        chart_image_name = f"sprint_end_{sprint.get('id', 'chart')}.png"
        chart_html = f'<ac:image><ri:attachment ri:filename="{chart_image_name}" /></ac:image>'
        
        sprint['_chart_path'] = chart_path
        sprint['_chart_name'] = chart_image_name
        print(f"📊 Chart generated: {chart_path}")
    except Exception as e:
        print(f"⚠️ Chart generation failed: {e}")
        chart_html = f"<p><em>{int(completion_pct)}% complete - {status_text}</em></p>"
    
    progress_html = f"""<h2>🏁 Final Sprint Results</h2>
<div style='text-align: left;'>
{chart_html}
<p><strong>{counts['done']} of {counts['total']}</strong> issues completed | <strong>{pts['done']:.1f} of {pts['total']:.1f}</strong> story points done</p>
</div>"""
    
    # Build spillover items table
    spillover_html = ""
    if spillover_issues > 0:
        spillover_html = "<h3>🔄 Spillover Items (Moving to Next Sprint)</h3>"
        spillover_html += "<table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>"
        spillover_html += "<tr style='background-color:#fff3cd;'><th style='padding:8px;'>Key</th><th>Summary</th><th>Status</th><th>Assignee</th><th>Points</th></tr>"
        
        all_incomplete = [issue for issue in issues if _status_category(issue) != "done"]
        
        for issue in all_incomplete[:20]:  # Top 20
            key = issue.get("key", "")
            summary = issue.get("fields", {}).get("summary", "")
            status = issue.get("fields", {}).get("status", {}).get("name", "")
            assignee = issue.get("fields", {}).get("assignee", {}).get("displayName", "Unassigned") if issue.get("fields", {}).get("assignee") else "Unassigned"
            points = _story_points(issue)
            spillover_html += f"<tr><td style='padding:8px;'><a href='{ATLASSIAN_BASE}/browse/{key}'>{key}</a></td><td>{summary}</td><td>{status}</td><td>{assignee}</td><td>{points}</td></tr>"
        spillover_html += "</table>"
    else:
        spillover_html = "<h3>✅ No Spillover - All Items Completed!</h3>"
    
    # AI insights for retrospective
    ai_retrospective = ""
    try:
        from openai import OpenAI
        from mid_sprint_report import OPENAI_API_KEY
        
        if OPENAI_API_KEY:
            client = OpenAI(api_key=OPENAI_API_KEY)
            prompt = f"""You are a delivery coach analyzing a completed sprint. 
Provide a brief retrospective with 3-4 bullets covering:
- What went well
- Areas for improvement
- Recommendations for next sprint

Sprint: {sprint.get('name')}
Completion: {completion_pct}%
Done: {counts['done']}/{counts['total']} issues, {pts['done']:.1f}/{pts['total']:.1f} points
Spillover: {spillover_issues} issues, {spillover_points:.1f} points
Blocked: {counts['blocked']} issues"""
            
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.3,
            )
            ai_retrospective = resp.choices[0].message.content.strip()
        else:
            ai_retrospective = "AI insights disabled: OPENAI_API_KEY not set."
    except Exception as e:
        ai_retrospective = f"AI retrospective unavailable: {e}"
    
    return f"""
    <div style='text-align: left;'>
    <h1>Sprint End Report: {sprint.get('name')}</h1>
    <p><strong>Board</strong>: {BOARD_ID or sprint.get('originBoardId', 'n/a')} | <strong>Project</strong>: {PROJECT_KEY or 'n/a'}</p>
    <p><strong>Dates</strong>: {start_dt.date() if start_dt else '?'} → {end_dt.date() if end_dt else '?'} | <strong>Duration</strong>: {duration} days</p>
    {progress_html}
    <p><strong>⏰ Final Velocity</strong>: {pts['done']:.1f} story points completed ({completion_pct}%)</p>
    
    <h2>📊 Sprint Summary</h2>
    <table border='1' style='border-collapse:collapse; width:100%; margin:10px 0;'>
      <tr style='background-color:#f5f5f5;'><th style='padding:8px;'>Metric</th><th>Count</th><th>Story Points</th></tr>
      <tr><td style='padding:8px;'>✅ Done</td><td>{counts['done']}</td><td>{pts['done']:.1f}</td></tr>
      <tr><td style='padding:8px;'>🔄 In Progress</td><td>{counts['in_progress']}</td><td>{pts['in_progress']:.1f}</td></tr>
      <tr><td style='padding:8px;'>📋 To Do</td><td>{counts['todo']}</td><td>{pts['todo']:.1f}</td></tr>
      <tr><td style='padding:8px;'>🚫 Blocked</td><td>{counts['blocked']}</td><td>-</td></tr>
      <tr style='background-color:#fff3cd; font-weight:bold;'><td style='padding:8px;'>📊 Total</td><td>{counts['total']}</td><td>{pts['total']:.1f}</td></tr>
    </table>
    
    <h2>🚨 Sprint Outcomes</h2>
    <ul>
      <li><strong>Completion Rate</strong>: {completion_pct}% ({status_text})</li>
      <li><strong>Velocity</strong>: {pts['done']:.1f} story points completed</li>
      <li><strong>Spillover Items</strong>: {spillover_issues} issues ({spillover_points:.1f} points)</li>
      <li><strong>Blocked Issues</strong>: {blocked}</li>
    </ul>
    
    {spillover_html}
    </div>
    
    <h2>💡 AI Retrospective</h2>
    <p>{ai_retrospective}</p>
    """


def main():
    try:
        sprint = get_current_or_recent_sprint(BOARD_ID)
        if not sprint:
            print(f"[{datetime.now()}] No active or recent sprint found")
            sys.exit(0)
        
        is_midpoint = is_sprint_midpoint_today(sprint)
        is_end = is_sprint_end_today(sprint)
        
        if not is_midpoint and not is_end:
            midpoint = get_sprint_midpoint_date(sprint)
            midpoint_str = midpoint.strftime("%Y-%m-%d") if midpoint else "unknown"
            end_str = sprint.get("endDate", "unknown")
            print(f"[{datetime.now()}] No report due today.")
            print(f"   Sprint: {sprint.get('name')}")
            print(f"   Midpoint: {midpoint_str}, End: {end_str}")
            sys.exit(0)
        
        # Get sprint data
        issues = get_sprint_issues(BOARD_ID, sprint["id"])
        end_str = sprint.get("endDate")
        sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        metrics = compute_metrics(issues, sprint_end)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        if is_midpoint:
            print(f"[{datetime.now()}] 🎯 Today is sprint midpoint! Generating mid-sprint report for: {sprint.get('name')}")
            ai_note = maybe_ai_notes(sprint, metrics)
            html = format_html(sprint, metrics, ai_note)
            title = f"{sprint.get('name')} - Mid-Sprint Review ({today})"
            publish_to_confluence(title, html, sprint)
            print(f"[{datetime.now()}] ✅ Published mid-sprint review: {title}")
        
        if is_end:
            print(f"[{datetime.now()}] 🏁 Today is sprint end! Generating sprint end report for: {sprint.get('name')}")
            html = generate_sprint_end_report(sprint, issues, metrics)
            title = f"{sprint.get('name')} - Sprint End Report ({today})"
            publish_to_confluence(title, html, sprint)
            print(f"[{datetime.now()}] ✅ Published sprint end report: {title}")
        
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
