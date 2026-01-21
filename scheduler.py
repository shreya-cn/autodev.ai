#!/usr/bin/env python3
"""
Simple scheduler for mid-sprint reports.
Run once: python3 scheduler.py
It will automatically run reports at the sprint midpoint.
"""

import time
import schedule
import sys
from datetime import datetime, timezone
from mid_sprint_report import (
    get_current_or_recent_sprint, 
    get_sprint_midpoint_date, 
    is_sprint_midpoint_today,
    BOARD_ID
)

def check_and_run_midpoint_report():
    """Check if today is sprint midpoint and run report if so."""
    try:
        sprint = get_current_or_recent_sprint(BOARD_ID)
        if not sprint:
            print(f"[{datetime.now()}] No active sprint found")
            return
        
        # Check if today is the sprint midpoint
        if not is_sprint_midpoint_today(sprint):
            midpoint = get_sprint_midpoint_date(sprint)
            midpoint_str = midpoint.strftime("%Y-%m-%d") if midpoint else "unknown"
            print(f"[{datetime.now()}] Not midpoint yet. Sprint: {sprint.get('name')}, Midpoint: {midpoint_str}")
            return
        
        print(f"[{datetime.now()}] 🎯 Today is sprint midpoint! Generating report for: {sprint.get('name')}")
        # Import here to avoid circular imports
        from mid_sprint_report import get_sprint_issues, compute_metrics, maybe_ai_notes, format_html, publish_to_confluence
        
        issues = get_sprint_issues(BOARD_ID, sprint["id"])
        end_str = sprint.get("endDate")
        sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        metrics = compute_metrics(issues, sprint_end)
        ai_note = maybe_ai_notes(sprint, metrics)
        html = format_html(sprint, metrics, ai_note)
        
        today = datetime.now().strftime("%Y-%m-%d")
        title = f"{sprint.get('name')} - Mid-Sprint Review ({today})"
        publish_to_confluence(title, html, sprint)
        print(f"[{datetime.now()}] ✅ Published mid-sprint review: {title}")
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("Mid-Sprint Report Scheduler Started")
    print("=" * 60)
    print(f"Checking daily at 9:00 AM for sprint midpoint")
    print("Report will be generated only at the actual sprint midpoint")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    # Schedule to check daily at 9 AM
    schedule.every().day.at("09:00").do(check_and_run_midpoint_report)
    
    # Also run immediately on startup to show current status
    print(f"\n[{datetime.now()}] Initial check...")
    sprint = get_current_or_recent_sprint(BOARD_ID)
    if sprint:
        print(f"[{datetime.now()}] Active sprint: {sprint.get('name')}")
        midpoint = get_sprint_midpoint_date(sprint)
        if midpoint:
            midpoint_date = midpoint.date()
            today = datetime.now(timezone.utc).date()
            print(f"[{datetime.now()}] Sprint midpoint: {midpoint_date}")
            if today == midpoint_date:
                print(f"[{datetime.now()}] 🎯 Today IS the midpoint! Running report now...")
                check_and_run_midpoint_report()
            else:
                days_until = (midpoint_date - today).days
                print(f"[{datetime.now()}] Days until midpoint: {days_until}")
    print()
    
    # Keep running
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute
