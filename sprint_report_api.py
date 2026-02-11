"""
Sprint Report API
Provides endpoints for generating sprint progress reports
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timezone
import sys
import os
import base64
import tempfile
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
CORS(app)  # Enable CORS for all routes

# Configuration
JIRA_URL = os.getenv('JIRA_URL')
JIRA_BOARD_ID = os.getenv('JIRA_BOARD_ID', '1')
CONFLUENCE_URL = os.getenv('CONFLUENCE_URL')


@app.route('/api/generate-sprint-report', methods=['POST'])
def generate_sprint_report():
    """
    Generate a sprint progress report up to a specific date
    
    Request body:
    {
        "to_date": "YYYY-MM-DD",  # Report date (required)
        "force": true             # Force generation even if already exists (optional)
    }
    """
    try:
        data = request.get_json()
        to_date_str = data.get('to_date')
        force = data.get('force', False)

        if not to_date_str:
            return jsonify({'error': 'Missing to_date parameter'}), 400

        # Parse the date
        try:
            report_date = datetime.strptime(to_date_str, '%Y-%m-%d')
            # Make timezone-aware
            report_date = report_date.replace(tzinfo=timezone.utc)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Get current active sprint
        sprint = get_active_sprint(JIRA_BOARD_ID)
        
        if not sprint:
            return jsonify({'error': 'No active sprint found'}), 404

        sprint_name = sprint.get('name', 'Unknown Sprint')
        sprint_id = str(sprint.get('id', ''))
        
        # Validate date is within sprint bounds
        sprint_start = sprint.get('startDate')
        sprint_end = sprint.get('endDate')
        
        if sprint_start:
            try:
                start_date = datetime.fromisoformat(sprint_start.replace('Z', '+00:00'))
                if report_date < start_date:
                    return jsonify({
                        'error': f'Selected date is before sprint start date ({start_date.strftime("%Y-%m-%d")})'
                    }), 400
            except Exception as e:
                print(f"⚠️ Could not parse sprint start date: {e}")
        
        if sprint_end:
            try:
                end_date = datetime.fromisoformat(sprint_end.replace('Z', '+00:00'))
                if report_date > end_date:
                    return jsonify({
                        'error': f'Selected date is after sprint end date ({end_date.strftime("%Y-%m-%d")})'
                    }), 400
            except Exception as e:
                print(f"⚠️ Could not parse sprint end date: {e}")

        print(f"📊 Generating report for sprint: {sprint_name} (ID: {sprint_id})")

        # Fetch issues for the sprint
        issues = get_sprint_issues(JIRA_BOARD_ID, sprint_id)

        if not issues:
            return jsonify({'error': 'No issues found for the sprint'}), 404

        print(f"✓ Found {len(issues)} issues")

        # Compute metrics
        metrics = compute_metrics(issues, report_date)
        
        counts = metrics.get('counts', {})
        completion_pct = metrics.get('completion_pct', 0)

        print(f"✓ Metrics computed: {counts.get('done', 0)}/{counts.get('total', 0)} completed ({completion_pct:.1f}%)")

        # Generate HTML report
        report_html = format_html(sprint, metrics, notes="", retro_insights="")

        # Publish to Confluence
        page_title = f"{sprint_name} - Progress Report ({report_date.strftime('%Y-%m-%d')})"
        
        print(f"📤 Publishing to Confluence: {page_title}")
        
        confluence_url = publish_to_confluence(
            title=page_title,
            html=report_html,
            sprint_data=sprint,
            parent_title="Sprint Progress Reports"
        )

        print(f"✅ Report published: {confluence_url}")

        return jsonify({
            'success': True,
            'message': 'Sprint progress report generated successfully',
            'confluence_url': confluence_url,
            'report_data': {
                'sprint_id': sprint_id,
                'sprint_name': sprint_name,
                'report_date': report_date.strftime('%Y-%m-%d'),
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
        print(f"❌ Error generating sprint report: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Failed to generate sprint report: {str(e)}'
        }), 500


@app.route('/api/sprint-status', methods=['GET'])
def get_sprint_status():
    """Get current sprint status"""
    try:
        sprint = get_active_sprint(JIRA_BOARD_ID)

        if not sprint:
            return jsonify({'error': 'No active sprint found'}), 404

        sprint_id = str(sprint.get('id', ''))
        issues = get_sprint_issues(JIRA_BOARD_ID, sprint_id)

        metrics = compute_metrics(issues)
        counts = metrics.get('counts', {})

        return jsonify({
            'sprint_id': sprint_id,
            'sprint_name': sprint.get('name', 'Unknown Sprint'),
            'sprint_state': sprint.get('state', 'unknown'),
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
        print(f"Error fetching sprint status: {str(e)}", file=sys.stderr)
        return jsonify({
            'error': f'Failed to fetch sprint status: {str(e)}'
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'sprint-report-api'}), 200


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Sprint Report API Starting")
    print("=" * 60)
    print(f"   📍 URL: http://localhost:5002")
    print(f"   🔌 Endpoints:")
    print(f"      - POST /api/generate-sprint-report")
    print(f"      - GET  /api/sprint-status")
    print(f"      - GET  /health")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5002, debug=False)
