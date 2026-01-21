#!/usr/bin/env python3
"""
Test script to generate both midpoint and end reports for testing purposes.
"""

import sys
from datetime import datetime
from run_midpoint_check import generate_sprint_end_report
from mid_sprint_report import (
    get_current_or_recent_sprint,
    get_sprint_issues,
    compute_metrics,
    maybe_ai_notes,
    format_html,
    publish_to_confluence,
    BOARD_ID
)

def main():
    report_type = sys.argv[1] if len(sys.argv) > 1 else "both"
    
    sprint = get_current_or_recent_sprint(BOARD_ID)
    if not sprint:
        print("No active or recent sprint found")
        sys.exit(1)
    
    print(f"Generating {report_type} report(s) for: {sprint.get('name')}")
    
    issues = get_sprint_issues(BOARD_ID, sprint["id"])
    end_str = sprint.get("endDate")
    sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
    metrics = compute_metrics(issues, sprint_end)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    if report_type in ["midpoint", "both"]:
        print("\n📊 Generating mid-sprint report...")
        ai_note = maybe_ai_notes(sprint, metrics)
        html = format_html(sprint, metrics, ai_note)
        title = f"{sprint.get('name')} - Mid-Sprint Review (TEST-{today})"
        publish_to_confluence(title, html, sprint)
        print(f"✅ Published: {title}")
    
    if report_type in ["end", "both"]:
        print("\n🏁 Generating sprint end report...")
        html = generate_sprint_end_report(sprint, issues, metrics)
        title = f"{sprint.get('name')} - Sprint End Report (TEST-{today})"
        publish_to_confluence(title, html, sprint)
        print(f"✅ Published: {title}")
    
    print("\n✅ All reports generated successfully!")

if __name__ == "__main__":
    main()
