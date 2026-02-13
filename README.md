# AutoDoc.ai Project

## Quick Setup (For Developers)

**New users must run this first to install dependencies and fix CORS errors:**

```bash
chmod +x setup.sh start-stack.sh
./setup.sh
```
Or
Manual command - python3 -m pip install -r requirements.txt

Then start the services:
- **Full Stack (One Command)**: `./start-stack.sh`
- **Backend**: `python3 support_ticket_api.py` (port 5000)
- **Frontend**: `cd autodev-ui && npm run dev` (port 3000)

**Documentation:**
- [Quick Start Guide](./QUICK_START.md) - Get running in 5 minutes
- [Backend Setup](./BACKEND_SETUP.md) - Full configuration & troubleshooting
- [Microservices Docs](./documentation/) - Architecture details

---

## Overview

AutoDoc.ai is an AI-powered development automation platform that streamlines Jira ticket management, meeting documentation, and developer productivity. It combines OpenAI's GPT models with Jira integration to automate ticket generation, suggest assignees, and recommend related work—helping teams move faster from meetings to execution.

---

## Core Features

### AI Ticket Generation
- **Text Editor**: Describe your requirements in plain text, and GPT-4-turbo generates structured Jira tickets with summary, detailed description, and acceptance criteria
- **Meeting Transcription (MOM)**: Upload meeting recordings (.vtt), transcripts (.txt), or documents (.docx) to automatically extract action items as tickets
- **Smart Classification**: AI determines issue type (Task/Bug/Story/Epic) and priority (Low/Medium/High/Highest) based on context
- **Relationship Detection**: Two-phase keyword-based analysis groups related tickets by shared components, dependencies, or themes

### AI Assignee Suggestion
- **Historical Analysis**: Analyzes the last 50 "Done" tickets from your Jira project to build team member expertise profiles
- **Intelligent Matching**: GPT-4o-mini matches new tickets to the best assignee based on past work history, issue types, and technical context
- **Transparent Recommendations**: Shows suggested assignee with confidence level (High/Medium/Low), reasoning, and 2 alternative options via hover tooltip
- **Project-Specific**: Each team member configures their own Jira project to see suggestions from their actual team

### Related Ticket Suggestions
- **Context-Aware Matching**: For tickets you're currently working on, AI identifies unassigned tickets with 30%+ relevance based on technical components, features, and dependencies
- **Smart Prioritization**: Ranks suggestions by relevance score with AI-generated reasoning to help you pick related work that fits your context
- **Sprint-Aware**: Categorizes suggestions by current-sprint vs. backlog to help you prioritize immediate vs. future work

### Jira Integration
- **Interactive Kanban Board**: Visualize tickets across To Do, In Progress, Review, and Done columns with drag-and-drop support
- **Seamless Ticket Creation**: Generated tickets are automatically created in Jira with custom fields like "Recommended Assignee"
- **Bulk Operations**: Create multiple tickets from a single meeting transcript with parallel assignee fetching for speed
- **OAuth Authentication**: Secure Atlassian OAuth integration for accessing your Jira workspace

### Auto PR Review
- **AI-Powered Code Analysis**: GitHub Actions workflow automatically reviews pull requests using GPT-4 within 30 seconds
- **Comprehensive Checks**: Identifies security vulnerabilities, performance issues, bugs, best practices violations, and missing tests
- **Inline Comments**: Posts intelligent, context-aware suggestions directly on code lines with severity ratings
- **Quality Metrics**: Generates summary reports with issue categorization and overall assessment to streamline human review

### Knowledge Base Q&A
- **Natural Language Search**: Ask questions about your codebase in plain English and get instant answers with file references
- **Code Structure Analysis**: Indexes TypeScript/React projects extracting metadata (classes, functions, types) without exposing raw code
- **Privacy-Safe**: Uses only code structure metadata for AI analysis, keeping implementation details private on your server
- **Smart Context**: Answers with specific file paths, line numbers, and architectural guidance based on your project structure

### Support & Analytics
- **AI Ticket Analysis**: Automatically analyzes support tickets to identify root causes, suggest code areas to investigate, and recommend developers
- **GitHub Integration**: Scans recent commits and developer expertise to match tickets with team members who've worked on related code
- **Analytics Dashboard**: Real-time metrics showing ticket volume, priority distribution, resolution rates, and team performance
- **Insight Generation**: Tracks patterns in support issues, identifies high-priority unassigned tickets, and provides actionable recommendations

### Documentation Generation
- **AI-Enhanced Docs**: Uses OpenAI's GPT models to generate detailed documentation for microservices automatically
  - `architectureDesign.adoc`: High-level system architecture overview
  - `detailedDesign.adoc`: In-depth implementation details with class diagrams
  - `OpenApiSpecification.adoc`: API documentation in OpenAPI standard format
- **Multi-Protocol Support**: Documents REST, gRPC, and SOME/IP communication protocols

---

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, React, TailwindCSS
- **Backend**: Next.js API Routes (Node.js runtime)
- **AI Models**: GPT-4-turbo (ticket generation, MOM), GPT-4o-mini (assignee matching), Whisper (audio transcription)
- **Integrations**: Jira API v3, Atlassian OAuth
- **File Processing**: mammoth (`.docx` parsing), native FileReader (`.txt`/`.vtt`)

---

## Microservices

The project includes microservices for demonstration purposes, each with AI-generated documentation:

- **Identity Provider** (`identityprovider/`) - Authentication and authorization
- **Enrollment** (`enrollment/`) - User enrollment processes
- **User Management** (`usermanagement/`) - User profile management
- **Vehicle Management** (`vehiclemanagement/`) - Vehicle data operations
- **AutoDoc.ai MCP Server** (`autodoc-ai-mcp-server/`) - Central documentation generation server

---

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/shreya-cn/autodev.ai
   ```

2. Follow the setup instructions in the respective microservice folders to run individual services.

3. For the MCP server, navigate to the `autodoc-ai-mcp-server` folder and follow the setup instructions in its README.

---

## Quick Links

- [Frontend Setup Guide](./autodev-ui/SETUP_GUIDE.md) - Environment configuration for new team members
- [Backend Setup](./BACKEND_SETUP.md) - Full configuration & troubleshooting
- [Quick Start Guide](./QUICK_START.md) - Get running in 5 minutes
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)

---

## Contributing

We welcome contributions! Please follow the structured workflows and best practices outlined in the respective service folders.
