"""
Support Ticket Analysis API
Handles ticket analysis requests and returns comprehensive analysis
"""

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import os
import json
from datetime import datetime
from typing import Dict, Any
import sys
import requests

from support_analyzer import (
    SupportTicketAnalyzer, 
    DeveloperExpertiseMatcher,
    format_analysis_for_jira
)
from github_analyzer import (
    GitHubAnalyzer,
    format_github_analysis
)
from jira_ticket_fetcher import JiraTicketFetcher
from mid_sprint_report import (
    get_active_sprint,
    get_sprint_issues,
    compute_metrics,
    format_html,
    publish_to_confluence,
)
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type"]}})

# In-memory cache for analyzed tickets
analyzed_tickets_cache = set()  # Stores ticket IDs that have been analyzed
@app.errorhandler(500)
def handle_error(error):
    import traceback
    print(f"❌ Unhandled error: {str(error)}", flush=True)
    print(traceback.format_exc(), flush=True)
    return jsonify({"error": "Internal server error", "details": str(error)}), 500

@app.before_request
def before_request():
    print(f"📥 Request: {request.method} {request.path}", flush=True)
    sys.stdout.flush()

@app.after_request
def after_request(response):
    print(f"📤 Response: {response.status_code} {request.path}", flush=True)
    sys.stdout.flush()
    return response

# Initialize analyzers
support_analyzer = SupportTicketAnalyzer()
github_analyzer = GitHubAnalyzer(repo_path=os.getenv('REPO_PATH', '.'))
jira_fetcher = JiraTicketFetcher()


@app.route('/api/analyze-support-ticket', methods=['POST'])
def analyze_support_ticket():
    """
    Analyze a support ticket for root cause and code areas
    
    Request body:
    {
        "summary": "Login page shows blank",
        "description": "After latest deployment, login page shows blank for all users",
        "error_log": "Optional stack trace or error logs",
        "ticket_id": "SUPPORT-123"
    }
    """
    
    try:
        data = request.get_json()
        
        # Validate required fields
        summary = data.get('summary', '')
        description = data.get('description', '')
        error_log = data.get('error_log', '')
        ticket_id = data.get('ticket_id', 'UNKNOWN')
        
        if not summary:
            return jsonify({'error': 'Missing required field: summary'}), 400
        
        print(f"\n{'='*60}")
        print(f"🎫 Processing Support Ticket: {ticket_id}")
        print(f"{'='*60}")
        
        # 1. Analyze support ticket
        print("\n[1/3] Analyzing ticket with AI...")
        ticket_analysis = support_analyzer.analyze_ticket(ticket_summary=summary, ticket_description=description, error_log=error_log)
        
        # 2. Get GitHub code analysis
        print("\n[2/3] Scanning GitHub for code changes...")
        recent_changes = github_analyzer.get_recent_changes(days=7, limit=20)
        developer_expertise = github_analyzer.get_developer_expertise(days=90)
        related_commits = github_analyzer.find_similar_error_fixes(
            error_message=summary,
            days=30
        )
        
        # 3. Match to developer
        print("\n[3/3] Finding best-fit developer...")
        dev_commit_history = {
            dev: list(info.get('files', {}).keys()) 
            for dev, info in developer_expertise.items()
        }
        
        expertise_matcher = DeveloperExpertiseMatcher()
        developer_suggestion = expertise_matcher.suggest_developer(
            code_areas=ticket_analysis['suggested_code_areas'],
            category=ticket_analysis['category'],
            dev_commit_history=dev_commit_history
        )
        
        # Combine all analysis
        full_analysis = {
            "ticket_id": ticket_id,
            "timestamp": datetime.now().isoformat(),
            "support_analysis": ticket_analysis,
            "github_analysis": {
                "recent_changes": recent_changes[:5],
                "developer_expertise": developer_expertise,
                "related_commits": related_commits
            },
            "developer_suggestion": developer_suggestion,
            "recommended_actions": [
                f"Review these code areas: {', '.join(ticket_analysis['suggested_code_areas'][:3])}",
                f"Check recent commits by {developer_suggestion.get('suggested_developer', 'assigned developer')}",
                f"Look for similar issues: {len(related_commits)} related commits found",
                "Compare with past resolutions to similar issues"
            ],
            "jira_comment": format_analysis_for_jira(ticket_analysis),
            "github_comment": format_github_analysis(recent_changes, developer_expertise, related_commits)
        }
        
        print(f"\n✅ Analysis Complete!")
        print(f"   Category: {ticket_analysis['category']}")
        print(f"   Severity: {ticket_analysis['severity']}")
        print(f"   Suggested Developer: {developer_suggestion.get('suggested_developer', 'Unassigned')}")
        print(f"   Confidence: {developer_suggestion.get('confidence', 0)}%")
        
        return jsonify({
            "success": True,
            "data": full_analysis
        }), 200
    
    except Exception as e:
        print(f"❌ Error analyzing ticket: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"Failed to analyze ticket: {str(e)}"
        }), 500


@app.route('/api/analyze-jira-ticket', methods=['POST'])
def analyze_jira_ticket():
    """
    Fetch JIRA ticket and analyze it automatically
    Expects: {"ticket_id": "AUT-123", "update_jira": true}
    """
    try:
        data = request.get_json()
        ticket_id = data.get('ticket_id')
        update_jira = data.get('update_jira', False)
        
        if not ticket_id:
            return jsonify({"error": "ticket_id is required"}), 400
        
        print(f"\n{'='*60}")
        print(f"🎫 Fetching JIRA Ticket: {ticket_id}")
        print(f"{'='*60}")
        
        # Step 1: Fetch ticket from JIRA
        ticket_data = jira_fetcher.fetch_ticket(ticket_id)
        
        if not ticket_data.get('success'):
            return jsonify({
                "error": ticket_data.get('error', 'Failed to fetch ticket')
            }), 404
        
        print(f"\n✅ Ticket fetched successfully")
        print(f"   Summary: {ticket_data['summary']}")
        print(f"   Status: {ticket_data['status']}")
        print(f"   Reporter: {ticket_data['reporter']['name']}")
        print(f"   Attachments: {len(ticket_data['attachments'])}")
        
        # Step 2: Analyze the ticket
        summary = ticket_data['summary']
        description = ticket_data['description']
        error_log = ticket_data['error_log']
        
        # Combine description with comments for more context
        full_context = description
        if ticket_data['comments']:
            recent_comments = ticket_data['comments'][:3]
            full_context += "\n\nRecent Comments:\n"
            full_context += "\n".join([f"- {c['author']}: {c['body']}" for c in recent_comments])
        
        print(f"\n🤖 Analyzing ticket...")
        
        # Run support analysis
        ticket_analysis = support_analyzer.analyze_ticket(
            ticket_summary=summary,
            ticket_description=full_context,
            error_log=error_log
        )
        
        # Get GitHub analysis
        recent_changes = github_analyzer.get_recent_changes(days=30, limit=10)
        developer_expertise = github_analyzer.get_developer_expertise(days=90)
        
        keywords = summary.lower().split() + (description.lower().split() if description else [])
        related_commits = github_analyzer.find_related_commits(keywords[:5], days=90)
        
        # Developer matching
        dev_commit_history = {
            dev: list(info.get('files', {}).keys()) 
            for dev, info in developer_expertise.items()
        }
        
        expertise_matcher = DeveloperExpertiseMatcher()
        developer_suggestion = expertise_matcher.suggest_developer(
            code_areas=ticket_analysis['suggested_code_areas'],
            category=ticket_analysis['category'],
            dev_commit_history=dev_commit_history
        )
        
        # Combine all analysis
        full_analysis = {
            "ticket_id": ticket_id,
            "ticket_key": ticket_data['key'],
            "ticket_url": f"{jira_fetcher.jira_url}/browse/{ticket_data['key']}",
            "timestamp": datetime.now().isoformat(),
            "ticket_details": {
                "summary": ticket_data['summary'],
                "status": ticket_data['status'],
                "priority": ticket_data['priority'],
                "reporter": ticket_data['reporter'],
                "assignee": ticket_data['assignee'],
                "created": ticket_data['created'],
                "attachments": [
                    {
                        "filename": att['filename'],
                        "size": att['size'],
                        "mime_type": att['mime_type']
                    }
                    for att in ticket_data['attachments']
                ]
            },
            "support_analysis": ticket_analysis,
            "github_analysis": {
                "recent_changes": recent_changes[:5],
                "developer_expertise": developer_expertise,
                "related_commits": related_commits
            },
            "developer_suggestion": developer_suggestion,
            "recommended_actions": [
                f"Review these code areas: {', '.join(ticket_analysis['suggested_code_areas'][:3])}",
                f"Assign to {developer_suggestion.get('suggested_developer', 'team')} ({developer_suggestion.get('confidence', 0)}% match)",
                f"Check recent commits by {developer_suggestion.get('suggested_developer', 'assigned developer')}",
                f"Look for similar issues: {len(related_commits)} related commits found",
                "Compare with past resolutions to similar issues"
            ]
        }
        
        # Step 3: Update JIRA ticket if requested
        if update_jira:
            print(f"\n📝 Updating JIRA ticket with analysis...")
            comment_added = jira_fetcher.add_analysis_comment(ticket_id, full_analysis)
            full_analysis['jira_updated'] = comment_added
            
            if comment_added:
                print(f"✅ Analysis comment added to JIRA")
            else:
                print(f"⚠️ Failed to add comment to JIRA")
        
        # Mark ticket as analyzed
        analyzed_tickets_cache.add(ticket_id)
        
        print(f"\n✅ Analysis Complete!")
        print(f"   Category: {ticket_analysis['category']}")
        print(f"   Severity: {ticket_analysis['severity']}")
        print(f"   Suggested Developer: {developer_suggestion.get('suggested_developer', 'Unassigned')}")
        print(f"   Confidence: {developer_suggestion.get('confidence', 0)}%")
        print(f"   Status: Marked as ANALYZED ✅")
        
        return jsonify({
            "success": True,
            "data": full_analysis
        }), 200
    
    except Exception as e:
        print(f"❌ Error analyzing JIRA ticket: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"Failed to analyze JIRA ticket: {str(e)}"
        }), 500


@app.route('/api/get-developer-expertise', methods=['GET'])
def get_developer_expertise():
    """Get developer expertise map"""
    try:
        expertise = github_analyzer.get_developer_expertise(days=int(request.args.get('days', 90)))
        
        return jsonify({
            "success": True,
            "data": {
                dev: {
                    "commits": info['commits'],
                    "specialties": info.get('specialties', []),
                    "top_files": [f[0] for f in info.get('top_files', [])]
                }
                for dev, info in expertise.items()
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/find-related-commits', methods=['POST'])
def find_related_commits():
    """Find commits related to an issue"""
    try:
        data = request.get_json()
        keywords = data.get('keywords', [])
        days = data.get('days', 30)
        
        if not keywords:
            return jsonify({'error': 'Missing keywords'}), 400
        
        commits = github_analyzer.find_related_commits(keywords, days=days)
        
        return jsonify({
            "success": True,
            "data": commits
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/support-metrics', methods=['GET'])
def support_metrics():
    """Get support analysis metrics"""
    try:
        expertise = github_analyzer.get_developer_expertise()
        recent_changes = github_analyzer.get_recent_changes(days=7)
        
        return jsonify({
            "success": True,
            "data": {
                "total_developers": len(expertise),
                "recent_commits": len(recent_changes),
                "top_developers": sorted(
                    [(dev, info['commits']) for dev, info in expertise.items()],
                    key=lambda x: x[1],
                    reverse=True
                )[:5],
                "active_areas": list(set([
                    '/'.join(file['name'].split('/')[:2]) 
                    for commit in recent_changes 
                    for file in commit.get('files', [])
                ]))[:10]
            }
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/jira-webhook', methods=['POST'])
def jira_webhook():
    """
    Webhook receiver for JIRA ticket creation events
    Automatically analyzes new tickets and posts structured response
    
    JIRA sends webhook payload when ticket is created:
    {
        "webhookEvent": "jira:issue_created",
        "issue": {
            "key": "AS-123",
            "fields": {...}
        }
    }
    """
    try:
        data = request.get_json()
        
        # Log the webhook event
        webhook_event = data.get('webhookEvent', '')
        print(f"\n{'='*60}")
        print(f"📥 JIRA Webhook Received: {webhook_event}")
        print(f"{'='*60}")
        
        # Only process ticket creation events
        if webhook_event not in ['jira:issue_created', 'jira:issue_updated']:
            print(f"ℹ️  Ignoring event: {webhook_event}")
            return jsonify({
                "success": True,
                "message": f"Event {webhook_event} ignored"
            }), 200
        
        # Extract ticket key
        issue = data.get('issue', {})
        ticket_id = issue.get('key', '')
        
        if not ticket_id:
            print("❌ No ticket ID found in webhook payload")
            return jsonify({"error": "No ticket ID in webhook"}), 400
        
        print(f"🎫 Processing ticket: {ticket_id}")
        
        # Fetch full ticket details
        print(f"📡 Fetching ticket details from JIRA...")
        ticket_data = jira_fetcher.fetch_ticket(ticket_id)
        
        if not ticket_data.get('success'):
            error_msg = ticket_data.get('error', 'Failed to fetch ticket')
            print(f"❌ Error: {error_msg}")
            return jsonify({"error": error_msg}), 500
        
        # Extract ticket info
        summary = ticket_data.get('summary', '')
        description = ticket_data.get('description', '')
        error_log = ticket_data.get('error_log', '')
        
        print(f"📝 Summary: {summary}")
        print(f"📋 Description length: {len(description)} chars")
        print(f"🐛 Error log: {'Yes' if error_log else 'No'}")
        
        # Analyze the ticket
        print(f"🤖 Running AI analysis...")
        analysis = support_analyzer.analyze_ticket(
            ticket_summary=summary,
            ticket_description=description,
            error_log=error_log
        )
        
        print(f"✅ Analysis complete:")
        print(f"   Category: {analysis['category']}")
        print(f"   Severity: {analysis['severity']}")
        print(f"   Confidence: {analysis['confidence']}%")
        
        # Get developer recommendation
        developer_match = support_analyzer.suggest_developer(analysis)
        suggested_dev = developer_match.get('developer', 'Unassigned')
        dev_confidence = developer_match.get('confidence', 0)
        
        print(f"👤 Suggested developer: {suggested_dev} ({dev_confidence}%)")
        
        # Format analysis for JIRA
        jira_comment = format_analysis_for_jira(analysis, developer_match)
        
        # Post analysis as comment to JIRA
        print(f"💬 Posting analysis to JIRA...")
        comment_result = jira_fetcher.add_analysis_comment(ticket_id, jira_comment)
        
        if comment_result.get('success'):
            print(f"✅ Analysis posted to {ticket_id}")
        else:
            print(f"⚠️  Warning: Could not post comment - {comment_result.get('error')}")
        
        # Optional: Update assignee if confidence is high
        if dev_confidence >= 80 and suggested_dev != 'Unassigned':
            print(f"🔄 Auto-assigning to {suggested_dev}...")
            assign_result = jira_fetcher.update_assignee(ticket_id, suggested_dev)
            if assign_result.get('success'):
                print(f"✅ Assigned to {suggested_dev}")
            else:
                print(f"⚠️  Could not assign: {assign_result.get('error')}")
        
        # Mark ticket as analyzed
        analyzed_tickets_cache.add(ticket_id)
        
        print(f"{'='*60}\n")
        
        return jsonify({
            "success": True,
            "message": f"Ticket {ticket_id} analyzed successfully",
            "ticket_id": ticket_id,
            "analysis": {
                "category": analysis['category'],
                "severity": analysis['severity'],
                "confidence": analysis['confidence'],
                "suggested_developer": suggested_dev
            }
        }), 200
    
    except Exception as e:
        print(f"❌ Error processing webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/analyzed-tickets', methods=['GET'])
def get_analyzed_tickets():
    """Get all analyzed tickets from JIRA AutoDev Support (AS) project"""
    try:
        print("📊 Fetching tickets from JIRA (AutoDev Support project)...", flush=True)
        
        url = f"{jira_fetcher.jira_url}/rest/api/3/search/jql"
        jql_query = 'project = "AS"'
        
        payload = {
            'jql': jql_query,
            'maxResults': 100,
            'fields': ['summary', 'description', 'assignee', 'status', 'created', 'updated', 'priority', 'comment', 'key', 'issuetype']
        }
        
        print(f"🔗 JIRA URL: {url}", flush=True)
        print(f"📋 JQL: {jql_query}", flush=True)
        
        response = requests.post(
            url,
            json=payload,
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            auth=jira_fetcher.auth,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ JIRA API Error: {response.status_code}", flush=True)
            print(f"Response: {response.text[:500]}", flush=True)
            return jsonify({"error": f"JIRA API Error {response.status_code}", "details": response.text[:500]}), response.status_code
        
        data = response.json()
        issues = data.get('issues', [])
        print(f"✅ Found {len(issues)} issues from JIRA", flush=True)
        
        tickets = []
        for issue in issues:
            fields = issue.get('fields', {})
            
            # Extract description
            description = fields.get('description', '')
            if isinstance(description, dict):
                description = jira_fetcher._parse_adf(description)
            description_preview = description[:200] if description else ''
            
            # Extract assignee
            assignee_obj = fields.get('assignee')
            assignee_name = assignee_obj.get('displayName', 'Unassigned') if assignee_obj else 'Unassigned'
            
            # Extract priority
            priority_obj = fields.get('priority')
            priority_name = priority_obj.get('name', 'Medium') if priority_obj else 'Medium'
            
            # Extract status
            status_obj = fields.get('status')
            status_name = status_obj.get('name', 'Unknown') if status_obj else 'Unknown'
            
            # Check if ticket has been analyzed (either in cache or has AI analysis comment in JIRA)
            ticket_key = issue.get('key')
            is_analyzed = ticket_key in analyzed_tickets_cache
            
            # Check for AI analysis comments in JIRA
            if not is_analyzed:
                comments = fields.get('comment', {}).get('comments', [])
                for comment in comments:
                    comment_body = comment.get('body', '')
                    # Check if comment contains AI analysis markers
                    if any(marker in str(comment_body) for marker in ['🤖', 'Category:', 'Severity:', 'AI ANALYSIS', 'Root Cause']):
                        is_analyzed = True
                        analyzed_tickets_cache.add(ticket_key)  # Add to cache for next time
                        print(f"✅ Found AI analysis comment in {ticket_key}", flush=True)
                        break
            
            tickets.append({
                'id': ticket_key,
                'key': ticket_key,
                'summary': fields.get('summary', ''),
                'description': description_preview,
                'fullDescription': description,
                'status': status_name,
                'assignee': assignee_name,
                'priority': priority_name,
                'created': fields.get('created', ''),
                'updated': fields.get('updated', ''),
                'analyzed': is_analyzed,
                'analysis': {}
            })
        
        print(f"✅ Returning {len(tickets)} tickets", flush=True)
        return jsonify({"success": True, "total": len(tickets), "analyzed_count": 0, "tickets": tickets}), 200
    
    except Exception as e:
        import traceback
        print(f"❌ Error: {str(e)}", flush=True)
        print(traceback.format_exc(), flush=True)
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500


@app.route('/api/generate-sprint-report', methods=['POST'])
def generate_sprint_report():
    """Generate a sprint progress report up to a specific date"""
    from datetime import timezone
    
    try:
        data = request.get_json()
        to_date_str = data.get('to_date')
        force = data.get('force', False)

        if not to_date_str:
            return jsonify({'error': 'Missing to_date parameter'}), 400

        # Parse the date
        try:
            report_date = datetime.strptime(to_date_str, '%Y-%m-%d')
            report_date = report_date.replace(tzinfo=timezone.utc)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Get current active sprint
        JIRA_BOARD_ID = os.getenv('JIRA_BOARD_ID', '1')
        sprint = get_active_sprint(JIRA_BOARD_ID)
        
        if not sprint:
            return jsonify({'error': 'No active sprint found'}), 404

        # Validate date is within sprint range (unless force=True)
        if not force:
            sprint_start = datetime.fromisoformat(sprint['startDate'].replace('Z', '+00:00'))
            sprint_end = datetime.fromisoformat(sprint['endDate'].replace('Z', '+00:00'))
            
            if report_date < sprint_start:
                return jsonify({
                    'error': f'Date is before sprint start ({sprint_start.strftime("%Y-%m-%d")})'
                }), 400
            
            if report_date > sprint_end:
                return jsonify({
                    'error': f'Date is after sprint end ({sprint_end.strftime("%Y-%m-%d")})'
                }), 400

        sprint_name = sprint.get('name', 'Unknown Sprint')
        sprint_id = str(sprint.get('id', ''))
        
        # Get sprint dates for risk detection
        end_str = sprint.get("endDate")
        start_str = sprint.get("startDate")
        sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        sprint_start = datetime.fromisoformat(start_str.replace("Z", "+00:00")) if start_str else None
        
        # Fetch issues and compute metrics
        issues = get_sprint_issues(JIRA_BOARD_ID, sprint_id)
        if not issues:
            return jsonify({'error': 'No issues found for the sprint'}), 404

        metrics = compute_metrics(issues, sprint_end)
        counts = metrics.get('counts', {})
        completion_pct = metrics.get('completion_pct', 0)
        
        # Calculate enhanced risks and health score
        from mid_sprint_report import detect_risks, calculate_sprint_health_score
        risks = detect_risks(issues, sprint_start, sprint_end)
        health = calculate_sprint_health_score(metrics, risks, sprint_start, sprint_end)

        # Generate HTML report
        report_html = format_html(sprint, metrics, notes="", retro_insights="", issues=issues)

        # Publish to Confluence
        page_title = f"{sprint_name} - Progress Report ({report_date.strftime('%Y-%m-%d')})"
        confluence_url = publish_to_confluence(
            title=page_title,
            html=report_html,
            sprint_data=sprint,
            parent_title="Sprint Progress Reports"
        )

        return jsonify({
            'success': True,
            'message': 'Sprint progress report generated successfully',
            'confluence_url': confluence_url,
            'report_data': {
                'sprint_id': sprint_id,
                'sprint_name': sprint_name,
                'report_date': report_date.strftime('%Y-%m-%d'),
                'health_score': health,
                'metrics': {
                    'total': counts.get('total', 0),
                    'completed': counts.get('done', 0),
                    'in_progress': counts.get('in_progress', 0),
                    'blocked': counts.get('blocked', 0),
                    'at_risk': counts.get('at_risk', 0),
                },
                'completion_percent': round(completion_pct, 1),
            }
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error generating sprint report: {str(e)}", flush=True)
        print(traceback.format_exc(), flush=True)
        return jsonify({'error': f'Failed to generate sprint report: {str(e)}'}), 500


@app.route('/api/sprint-status', methods=['GET'])
def get_sprint_status():
    """Get current sprint status with health score"""
    try:
        from datetime import timezone
        from mid_sprint_report import detect_risks, calculate_sprint_health_score
        
        JIRA_BOARD_ID = os.getenv('JIRA_BOARD_ID', '1')
        sprint = get_active_sprint(JIRA_BOARD_ID)

        if not sprint:
            return jsonify({'error': 'No active sprint found'}), 404

        sprint_id = str(sprint.get('id', ''))
        
        # Get sprint dates for risk detection
        end_str = sprint.get("endDate")
        start_str = sprint.get("startDate")
        sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        sprint_start = datetime.fromisoformat(start_str.replace("Z", "+00:00")) if start_str else None
        
        issues = get_sprint_issues(JIRA_BOARD_ID, sprint_id)
        metrics = compute_metrics(issues, sprint_end)
        counts = metrics.get('counts', {})
        
        # Calculate risks and health score
        risks = detect_risks(issues, sprint_start, sprint_end)
        health = calculate_sprint_health_score(metrics, risks, sprint_start, sprint_end)
        
        # Count risks by category
        risk_summary = {
            'stale_in_progress': len(risks.get('stale_in_progress', [])),
            'unassigned_high_priority': len(risks.get('unassigned_high_priority', [])),
            'large_items_todo': len(risks.get('large_items_todo', [])),
            'sprint_goal_risk': len(risks.get('sprint_goal_risk', [])),
            'blocked_items': len(risks.get('blocked_items', [])),
        }

        return jsonify({
            'sprint_id': sprint_id,
            'sprint_name': sprint.get('name', 'Unknown Sprint'),
            'sprint_state': sprint.get('state', 'unknown'),
            'health_score': health,
            'risks': risk_summary,
            'metrics': {
                'total': counts.get('total', 0),
                'completed': counts.get('done', 0),
                'in_progress': counts.get('in_progress', 0),
                'blocked': counts.get('blocked', 0),
                'at_risk': counts.get('at_risk', 0),
            },
            'start_date': sprint.get('startDate'),
            'end_date': sprint.get('endDate'),
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error fetching sprint status: {str(e)}", flush=True)
        print(traceback.format_exc(), flush=True)
        return jsonify({'error': f'Failed to fetch sprint status: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        "status": "healthy",
        "service": "support-ticket-analyzer"
    }), 200


if __name__ == '__main__':
    print("="*60)
    print("🚀 AutoDev API Server Starting")
    print("="*60)
    print("   📍 URL: http://localhost:5001")
    print("   🔌 Endpoints:")
    print("   ├─ POST /api/analyze-support-ticket")
    print("   ├─ POST /api/analyze-jira-ticket")
    print("   ├─ POST /api/jira-webhook (AUTOMATIC)")
    print("   ├─ GET  /api/get-developer-expertise")
    print("   ├─ POST /api/find-related-commits")
    print("   ├─ GET  /api/support-metrics")
    print("   ├─ GET  /api/analyzed-tickets")
    print("   ├─ POST /api/generate-sprint-report")
    print("   ├─ GET  /api/sprint-status")
    print("   └─ GET  /health")
    print("="*60)
    print("   🔔 Webhook URL: http://YOUR_SERVER:5001/api/jira-webhook")
    print("   📚 Setup Guide: JIRA_WEBHOOK_SETUP.md")
    print("="*60)
    
    # Enable debug mode to catch crashes
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False, threaded=True)
