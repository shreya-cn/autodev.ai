"""
AI-Powered Support Ticket Analyzer
Analyzes support tickets and suggests code areas and root causes
"""

import os
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import re
from dotenv import load_dotenv
import openai
from jira_client import build_description

load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
client = openai.OpenAI(api_key=OPENAI_API_KEY)

# Severity levels
SEVERITY_CRITICAL = "🔴 Critical"
SEVERITY_HIGH = "🟠 High"
SEVERITY_MEDIUM = "🟡 Medium"
SEVERITY_LOW = "🟢 Low"


class SupportTicketAnalyzer:
    """Analyzes support tickets and provides AI-powered insights"""

    def __init__(self):
        self.client = client

    def analyze_ticket(self, ticket_summary: str, ticket_description: str, error_log: str = "") -> Dict[str, Any]:
        """
        Analyze a support ticket and provide comprehensive insights
        
        Args:
            ticket_summary: Short title of the issue (e.g., "Login page shows blank")
            ticket_description: Full description from user
            error_log: Optional error stack trace
            
        Returns:
            Dictionary with analysis results
        """
        
        print(f"🔍 Analyzing ticket: {ticket_summary}")
        
        # Combine all information
        full_context = f"""
Support Ticket Summary: {ticket_summary}

Description: {ticket_description}

{f'Error Log: {error_log}' if error_log else ''}
"""

        # Get AI analysis
        analysis = self._get_ai_analysis(full_context)
        
        # Parse AI response
        parsed = self._parse_ai_response(analysis)
        
        # Add severity and category
        result = {
            "timestamp": datetime.now().isoformat(),
            "summary": ticket_summary,
            "description": ticket_description,
            "error_log": error_log,
            "analysis": parsed,
            "suggested_code_areas": self._extract_code_areas(parsed),
            "suspected_root_causes": self._extract_root_causes(parsed),
            "severity": self._determine_severity(ticket_summary, ticket_description, error_log),
            "category": parsed.get("category", "Unknown Issue"),
            "confidence": parsed.get("confidence", 0),
            "suggested_developer": parsed.get("suggested_developer", "Unassigned"),
        }
        
        print(f"✅ Analysis complete: {result['severity']} - {result['category']}")
        
        return result

    def _get_ai_analysis(self, context: str) -> str:
        """Use OpenAI to analyze the ticket - works with or without error logs"""
        
        # Detect if we have error logs
        has_error_log = "Error Log:" in context and len(context.split("Error Log:")[-1].strip()) > 20
        
        if not has_error_log:
            # Use enhanced prompt for description-only analysis
            prompt = self._build_description_based_prompt(context)
        else:
            # Use standard prompt when we have error logs
            prompt = self._build_standard_prompt(context)

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert support ticket analyzer with deep knowledge of software engineering, 
                        common bugs, performance issues, and integration problems. 
                        You excel at inferring technical root causes from user descriptions without error logs.
                        Always respond with valid JSON."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ OpenAI error: {e}")
            return json.dumps({
                "category": "Unable to analyze",
                "error": str(e)
            })

    def _build_standard_prompt(self, context: str) -> str:
        """Build prompt for analysis WITH error logs"""
        return f"""You are a senior software engineer analyzing support tickets.

Analyze this support ticket with error logs and provide:
1. Issue Category (Frontend Bug/Backend Bug/Database/Performance/Security/Integration/Infrastructure/UI/Other)
2. Affected Area (Frontend/Backend/Database/API/Infrastructure/DevOps)
3. Suspected Root Causes (2-3 technical causes, ordered by likelihood)
4. Likely Code Areas (specific file patterns to investigate)
5. Severity Assessment (why Critical/High/Medium/Low)
6. Investigation Steps (ordered by priority)
7. Confidence Level (0-100)

SUPPORT TICKET:
{context}

Respond in JSON format:
{{
  "category": "category here",
  "area": "affected area",
  "root_causes": ["cause 1", "cause 2", "cause 3"],
  "code_areas": ["path/file.ts", "path/module.py"],
  "severity_reasoning": "why this severity",
  "investigation_steps": ["step 1", "step 2"],
  "confidence": 90
}}"""

    def _build_description_based_prompt(self, context: str) -> str:
        """Build intelligent prompt for analysis WITHOUT error logs"""
        return f"""You are an expert support ticket analyzer. Based ONLY on the description provided (no error logs available), 
infer the most likely technical root causes and affected code areas.

Analyze this support ticket WITHOUT error logs and intelligently infer:
1. Issue Category (Frontend Bug/Backend Bug/Database/Performance/Security/Integration/Infrastructure/UI/Other)
2. Affected Area (Frontend/Backend/Database/API/Infrastructure)
3. Suspected Root Causes (2-4 technical causes most likely given the description, ordered by probability)
4. Likely Code Areas (specific files/modules that are likely affected based on the description)
5. Why These Root Causes (reasoning for your predictions)
6. Investigation Strategy (what to check first without stack trace)
7. Confidence Level (0-100, lower if description is vague)

KEY INSIGHT: Without error logs, look for patterns like:
- User behavior descriptions suggest UI/form handling issues
- Timing descriptions (slow, intermittent) suggest performance/race conditions
- Data-related descriptions suggest database/API issues
- Integration descriptions suggest third-party API issues
- Feature not working suggests missing implementation or condition bugs

SUPPORT TICKET:
{context}

Be specific about code patterns. For example:
- If describing form submission: "src/components/FormHandler.tsx", "src/api/submit.ts"
- If describing search: "src/services/SearchService.ts", "src/components/SearchBox.tsx"
- If describing data loading: "src/store/reducer.ts", "src/api/fetch.ts"
- If describing authentication: "src/auth/login.ts", "src/middleware/auth.ts"

Respond in JSON format:
{{
  "category": "category here",
  "area": "affected area",
  "root_causes": ["most likely cause", "second most likely", "third possibility"],
  "reasoning": "why these root causes based on description",
  "code_areas": ["src/components/IssueArea.tsx", "src/services/RelatedService.ts"],
  "investigation_strategy": "where to start without error logs",
  "confidence": 75,
  "note": "confidence is lower without error logs, suggest running in browser devtools"
}}"""

    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON response from AI"""
        try:
            # Extract JSON from response
            json_match = response.strip()
            if json_match.startswith("```"):
                json_match = json_match.split("```")[1]
                if json_match.startswith("json"):
                    json_match = json_match[4:]
            
            parsed = json.loads(json_match)
            return parsed
        except json.JSONDecodeError:
            print(f"⚠️ Could not parse AI response as JSON")
            return {
                "category": "Unknown",
                "area": "Unknown",
                "root_causes": ["Unable to determine"],
                "confidence": 0
            }

    def _extract_code_areas(self, analysis: Dict) -> List[str]:
        """Extract code areas from analysis"""
        code_areas = analysis.get("code_areas", [])
        if isinstance(code_areas, str):
            # Parse string format
            return [area.strip() for area in code_areas.split(",")]
        return code_areas if isinstance(code_areas, list) else []

    def _extract_root_causes(self, analysis: Dict) -> List[str]:
        """Extract root causes from analysis"""
        causes = analysis.get("root_causes", [])
        if isinstance(causes, str):
            return [cause.strip() for cause in causes.split(",")]
        return causes if isinstance(causes, list) else []

    def _determine_severity(self, summary: str, description: str, error_log: str) -> str:
        """Determine severity based on keywords and patterns - works without error logs"""
        combined = f"{summary} {description} {error_log}".lower()
        
        # CRITICAL: Immediate system downtime, data loss, security
        critical_keywords = [
            "crash", "down", "outage", "loss of data", "data deleted", 
            "security breach", "breach", "500 error", "database error", 
            "unable to access", "system down", "completely broken",
            "all users affected", "production down", "critical",
            "cannot save", "data corruption"
        ]
        
        # HIGH: Feature broken, many users affected, significant issues
        high_keywords = [
            "fail", "failed", "failing", "error", "cannot", "can't",
            "broken", "unavailable", "timeout", "stuck", "frozen",
            "not working", "doesn't work", "won't", "login fail",
            "payment fail", "lost connection", "disconnect",
            "blocked", "hangs", "stuck", "unresponsive"
        ]
        
        # MEDIUM: Partial issues, workarounds possible, specific users
        medium_keywords = [
            "slow", "lag", "lagging", "sluggish", "issue", "problem",
            "sometimes", "intermittent", "occasional", "specific",
            "some users", "certain conditions", "minor", "glitch",
            "delay", "performance", "quality"
        ]
        
        # Check for impact scope
        high_impact_scope = [
            "all users", "many users", "everyone", "bulk",
            "mass", "widespread", "multiple", "customers",
            "production", "live"
        ]
        
        # Check for severity indicators
        has_high_impact = any(scope in combined for scope in high_impact_scope)
        
        for keyword in critical_keywords:
            if keyword in combined:
                return SEVERITY_CRITICAL
        
        for keyword in high_keywords:
            if keyword in combined:
                # If high keyword + high impact = CRITICAL
                if has_high_impact:
                    return SEVERITY_CRITICAL
                return SEVERITY_HIGH
        
        for keyword in medium_keywords:
            if keyword in combined:
                return SEVERITY_MEDIUM
        
        # If no keywords match but has error log = likely issue
        if error_log and len(error_log) > 50:
            return SEVERITY_HIGH
        
        # Default: something is wrong, but not clear how serious
        return SEVERITY_MEDIUM

    def categorize_ticket(self, summary: str) -> Dict[str, str]:
        """Quick categorization of ticket type"""
        summary_lower = summary.lower()
        
        categories = {
            "Performance": ["slow", "lag", "delay", "hang", "freeze", "timeout"],
            "Authentication": ["login", "auth", "password", "token", "permission", "access"],
            "Database": ["database", "query", "sql", "connection", "data", "record"],
            "API": ["api", "endpoint", "request", "response", "integration"],
            "UI": ["display", "button", "layout", "design", "ui", "frontend", "blank"],
            "Backend": ["server", "backend", "service", "processing", "calculation"],
            "Security": ["security", "breach", "vulnerability", "hack", "unauthorized"],
        }
        
        for category, keywords in categories.items():
            if any(keyword in summary_lower for keyword in keywords):
                return {"category": category, "confidence": "High"}
        
        return {"category": "Other", "confidence": "Low"}

    def _extract_keywords_from_description(self, description: str) -> List[str]:
        """Extract technical keywords from description for better analysis"""
        keywords = []
        
        # UI/Form related keywords
        form_keywords = ["form", "submit", "button", "click", "input", "field", "validation", "blank", "empty"]
        search_keywords = ["search", "filter", "find", "lookup", "query"]
        auth_keywords = ["login", "logout", "auth", "password", "session", "token", "permission"]
        data_keywords = ["data", "load", "fetch", "save", "delete", "update", "record", "list"]
        perf_keywords = ["slow", "lag", "delay", "hang", "freeze", "performance", "timeout"]
        api_keywords = ["api", "endpoint", "request", "response", "call", "sync", "fetch"]
        connection_keywords = ["connection", "network", "offline", "disconnect", "timeout", "retry"]
        
        desc_lower = description.lower()
        
        keyword_maps = {
            "form_handling": form_keywords,
            "search_functionality": search_keywords,
            "authentication": auth_keywords,
            "data_management": data_keywords,
            "performance": perf_keywords,
            "api_integration": api_keywords,
            "connectivity": connection_keywords
        }
        
        detected = []
        for area, words in keyword_maps.items():
            if any(word in desc_lower for word in words):
                detected.append(area)
        
        return detected

    def _infer_code_areas_from_description(self, description: str, category: str) -> List[str]:
        """Intelligently infer code areas based on description"""
        areas = []
        detected_keywords = self._extract_keywords_from_description(description)
        
        # Map descriptions to likely code areas
        description_lower = description.lower()
        
        # Authentication issues
        if "login" in description_lower or "logout" in description_lower:
            areas.extend(["src/auth/login.tsx", "src/services/AuthService.ts", "src/middleware/auth.ts"])
        
        # Form/submission issues
        if any(word in description_lower for word in ["form", "submit", "save", "button"]):
            areas.extend(["src/components/FormHandler.tsx", "src/api/submit.ts", "src/validation/rules.ts"])
        
        # Search/filter issues
        if "search" in description_lower or "filter" in description_lower:
            areas.extend(["src/services/SearchService.ts", "src/components/SearchBox.tsx", "src/api/search.ts"])
        
        # Data loading issues
        if any(word in description_lower for word in ["load", "fetch", "display", "list"]):
            areas.extend(["src/store/reducer.ts", "src/api/fetch.ts", "src/hooks/useData.ts"])
        
        # Performance issues
        if any(word in description_lower for word in ["slow", "lag", "delay", "performance"]):
            areas.extend(["src/utils/cache.ts", "src/components/VirtualList.tsx", "src/hooks/useOptimization.ts"])
        
        # Network/API issues
        if any(word in description_lower for word in ["api", "network", "connection", "timeout"]):
            areas.extend(["src/services/ApiClient.ts", "src/api/endpoints.ts", "src/middleware/requests.ts"])
        
        # UI/Display issues
        if any(word in description_lower for word in ["display", "blank", "missing", "layout", "ui"]):
            areas.extend(["src/components/Layout.tsx", "src/pages/index.tsx", "src/styles/theme.ts"])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_areas = []
        for area in areas:
            if area not in seen:
                seen.add(area)
                unique_areas.append(area)
        
        return unique_areas if unique_areas else ["src/index.ts"]


class DeveloperExpertiseMatcher:
    """Matches support tickets to developers based on expertise"""

    def __init__(self):
        self.expertise_map = {}

    def suggest_developer(
        self, 
        code_areas: List[str], 
        category: str, 
        dev_commit_history: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Suggest best developer for this ticket based on code expertise
        
        Args:
            code_areas: List of code files/areas mentioned
            category: Ticket category
            dev_commit_history: Dict of {developer: [files_they_committed_to]}
            
        Returns:
            Dictionary with suggested developer and confidence
        """
        
        scores = {}
        
        for dev, committed_files in dev_commit_history.items():
            score = 0
            matches = 0
            
            # Score based on file matches
            for code_area in code_areas:
                for committed_file in committed_files:
                    if code_area.lower() in committed_file.lower() or \
                       committed_file.lower() in code_area.lower():
                        score += 10
                        matches += 1
            
            # Bonus for recent changes
            if matches > 0:
                score += 20  # Bonus for any matches
            
            scores[dev] = {
                "score": score,
                "matches": matches,
                "files": committed_files[:5]  # Top 5 files
            }
        
        if not scores or all(s["score"] == 0 for s in scores.values()):
            return {
                "suggested_developer": "Unassigned",
                "confidence": 0,
                "reason": "No matching expertise found"
            }
        
        # Get developer with highest score
        best_dev = max(scores.items(), key=lambda x: x[1]["score"])
        confidence = min(100, best_dev[1]["score"])
        
        return {
            "suggested_developer": best_dev[0],
            "confidence": confidence,
            "matching_files": best_dev[1]["files"],
            "reason": f"Committed to {best_dev[1]['matches']} related files"
        }


def format_analysis_for_jira(analysis: Dict[str, Any]) -> str:
    """Format analysis results as JIRA comment HTML"""
    
    html = f"""
<h2>🤖 AI Support Ticket Analysis</h2>

<h3>📊 Summary</h3>
<ul>
    <li><strong>Category:</strong> {analysis.get('category', 'Unknown')}</li>
    <li><strong>Severity:</strong> {analysis.get('severity', 'Unknown')}</li>
    <li><strong>Confidence:</strong> {analysis.get('confidence', 0)}%</li>
    <li><strong>Suggested Developer:</strong> {analysis.get('suggested_developer', 'Unassigned')}</li>
</ul>

<h3>🔍 Code Areas to Check</h3>
<ul>
"""
    
    for area in analysis.get('suggested_code_areas', []):
        html += f"    <li><code>{area}</code></li>\n"
    
    html += """
</ul>

<h3>⚠️ Suspected Root Causes</h3>
<ol>
"""
    
    for cause in analysis.get('suspected_root_causes', []):
        html += f"    <li>{cause}</li>\n"
    
    html += """
</ol>

<h3>💡 Recommended Actions</h3>
<ol>
    <li>Review the suggested code areas above</li>
    <li>Check recent commits to those files</li>
    <li>Run tests for the affected area</li>
    <li>Compare with similar past issues (if linked)</li>
</ol>

<p><em>Analysis generated at {}</em></p>
""".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    return html


# Example usage
if __name__ == "__main__":
    analyzer = SupportTicketAnalyzer()
    
    # Example ticket
    result = analyzer.analyze_ticket(
        summary="Dashboard is loading very slowly",
        description="Users report that the dashboard takes 30+ seconds to load after authentication. This affects all users.",
        error_log="No specific error in logs, just slow response times"
    )
    
    print("\n" + "="*60)
    print("ANALYSIS RESULT:")
    print("="*60)
    print(json.dumps(result, indent=2))
    
    # Format for JIRA
    jira_comment = format_analysis_for_jira(result)
    print("\n" + "="*60)
    print("JIRA COMMENT FORMAT:")
    print("="*60)
    print(jira_comment)
