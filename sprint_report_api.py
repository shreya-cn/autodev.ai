#!/usr/bin/env python3
"""
Flask API for on-demand sprint progress reports.
Run: python3 sprint_report_api.py
Access: http://localhost:5000
"""

from flask import Flask, jsonify, render_template_string
from datetime import datetime
import sys
import traceback

from mid_sprint_report import (
    get_current_or_recent_sprint,
    get_sprint_issues,
    compute_metrics,
    maybe_ai_notes,
    format_html,
    publish_to_confluence,
    BOARD_ID
)

app = Flask(__name__)

# Simple HTML UI
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Sprint Progress Report Generator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #2196F3;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 12px 30px;
            font-size: 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
        }
        button:hover {
            background-color: #45a049;
        }
        button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            display: none;
        }
        .status.success {
            background-color: #c8e6c9;
            color: #2e7d32;
            border: 1px solid #2e7d32;
            display: block;
        }
        .status.error {
            background-color: #ffcdd2;
            color: #c62828;
            border: 1px solid #c62828;
            display: block;
        }
        .loading {
            text-align: center;
            display: none;
            margin-top: 20px;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .link {
            color: #2196F3;
            text-decoration: none;
            font-weight: bold;
        }
        .link:hover {
            text-decoration: underline;
        }
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s;
        }
        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideIn 0.3s;
        }
        .modal-content.success {
            border-top: 5px solid #4CAF50;
        }
        .modal-content.error {
            border-top: 5px solid #f44336;
        }
        .modal-header {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            text-align: center;
        }
        .modal-header.success {
            color: #4CAF50;
        }
        .modal-header.error {
            color: #f44336;
        }
        .modal-body {
            text-align: center;
            margin: 20px 0;
        }
        .modal-link {
            display: inline-block;
            background-color: #2196F3;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 15px;
            font-weight: bold;
        }
        .modal-link:hover {
            background-color: #1976D2;
        }
        .close-btn {
            background-color: #ddd;
            color: #333;
            padding: 10px 25px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 15px;
        }
        .close-btn:hover {
            background-color: #ccc;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Sprint Progress Report</h1>
        <div class="info">
            <strong>Current Date:</strong> <span id="currentDate"></span><br>
            <strong>This will generate a progress report for the current sprint up to today.</strong>
        </div>
        
        <button id="generateBtn" onclick="generateReport()">
            Generate Progress Report
        </button>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Generating report... (this may take 30-60 seconds)</p>
        </div>
    </div>

    <!-- Success/Error Modal -->
    <div id="modal" class="modal">
        <div id="modalContent" class="modal-content">
            <div id="modalHeader" class="modal-header"></div>
            <div id="modalBody" class="modal-body"></div>
        </div>
    </div>

    <script>
        // Show current date
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        function showModal(isSuccess, message, confluenceUrl = null) {
            const modal = document.getElementById('modal');
            const modalContent = document.getElementById('modalContent');
            const modalHeader = document.getElementById('modalHeader');
            const modalBody = document.getElementById('modalBody');
            
            // Reset classes
            modalContent.className = 'modal-content';
            modalHeader.className = 'modal-header';
            
            if (isSuccess) {
                modalContent.classList.add('success');
                modalHeader.classList.add('success');
                modalHeader.textContent = '✅ Report Generated!';
                modalBody.innerHTML = `
                    <p>${message}</p>
                    <a href="${confluenceUrl}" class="modal-link" target="_blank">
                        View Report in Confluence →
                    </a>
                    <br>
                    <button class="close-btn" onclick="closeModal()">Close</button>
                `;
            } else {
                modalContent.classList.add('error');
                modalHeader.classList.add('error');
                modalHeader.textContent = '❌ Error';
                modalBody.innerHTML = `
                    <p>There was an error generating the report.</p>
                    <p>Please try again later.</p>
                    <button class="close-btn" onclick="closeModal()">Close</button>
                `;
            }
            
            modal.style.display = 'block';
        }

        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('modal');
            if (event.target === modal) {
                closeModal();
            }
        }

        function generateReport() {
            const btn = document.getElementById('generateBtn');
            const loading = document.getElementById('loading');
            
            btn.disabled = true;
            loading.style.display = 'block';
            
            fetch('/api/generate-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                loading.style.display = 'none';
                btn.disabled = false;
                
                if (data.success) {
                    const message = `Sprint: ${data.sprint_name}<br>Completion: ${data.completion_pct}%<br>Issues: ${data.done}/${data.total} completed`;
                    showModal(true, message, data.confluence_url);
                } else {
                    showModal(false);
                }
            })
            .catch(error => {
                loading.style.display = 'none';
                btn.disabled = false;
                showModal(false);
            });
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    """Serve the UI"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """Generate sprint progress report for today"""
    try:
        # Get current sprint
        sprint = get_current_or_recent_sprint(BOARD_ID)
        if not sprint:
            return jsonify({
                'success': False,
                'error': 'No active or recent sprint found'
            }), 404
        
        # Get issues and metrics
        issues = get_sprint_issues(BOARD_ID, sprint["id"])
        end_str = sprint.get("endDate")
        sprint_end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        metrics = compute_metrics(issues, sprint_end)
        
        # Generate report (with today's progress, not necessarily at midpoint/end)
        ai_note = maybe_ai_notes(sprint, metrics)
        html = format_html(sprint, metrics, ai_note)
        
        # Create title with today's date
        today = datetime.now().strftime("%Y-%m-%d")
        title = f"{sprint.get('name')} - Progress Report ({today})"
        
        # Publish to Confluence and get the page URL
        confluence_url = publish_to_confluence(title, html, sprint)
        
        # Return success response with the actual Confluence page URL
        return jsonify({
            'success': True,
            'sprint_name': sprint.get('name'),
            'completion_pct': metrics['completion_pct'],
            'done': metrics['counts']['done'],
            'total': metrics['counts']['total'],
            'done_points': metrics['points']['done'],
            'total_points': metrics['points']['total'],
            'confluence_url': confluence_url,
            'message': f'Report generated successfully for {sprint.get("name")}'
        })
    
    except Exception as e:
        print(f"Error generating report: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    print("=" * 60)
    print("Sprint Report API Server")
    print("=" * 60)
    print("🚀 Starting server on http://localhost:5000")
    print("📊 Open in browser to generate sprint reports on-demand")
    print("=" * 60)
    app.run(debug=True, port=5000)
