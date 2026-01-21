# AutoDoc.ai Project

## Overview

The AutoDoc.ai project is a prototype designed to automate the generation of documentation for microservices. It leverages AI models, such as OpenAI's GPT, and integrates with tools like Jira to streamline the documentation process. The project includes multiple microservices, each serving a specific purpose, and a central MCP (Model Context Protocol) server to coordinate the documentation generation.

---

## Microservices

### 1. Identity Provider

- **Purpose**: Handles authentication and authorization.
- **Documentation**: Located in the `identityprovider/documentation` folder.

### 2. Enrollment

- **Purpose**: Manages user enrollment processes.
- **Documentation**: Located in the `enrollment/documentation` folder.

### 3. User Management

- **Purpose**: Manages user profiles and related operations.
- **Documentation**: Located in the `usermanagement/documentation` folder.

### 4. Vehicle Management

- **Purpose**: Handles vehicle-related data and operations.
- **Documentation**: Located in the `vehiclemanagement/documentation` folder.

### 5. AutoDoc.ai MCP Server

- **Purpose**: Central server for generating AI-enhanced documentation and release notes.
- **Documentation**: Located in the `autodoc-ai-mcp-server` folder.

## 6. **Mid-Sprint & Sprint End Report Generator**

Automatically generates and publishes sprint reports to Confluence:

- **Mid-Sprint Review** (at sprint midpoint): Progress tracking, at-risk items, high-priority work
- **Sprint End Report** (on sprint last day): Final velocity, spillover items, retrospective
- Visual progress charts (donut charts with completion %)
- AI-powered insights and recommendations
- Automatic scheduling with GitHub Actions (daily checks)

### Setup

**Option 1: Automatic (GitHub Actions - Recommended)**

1. Push code to GitHub:
```bash
git add .
git commit -m "Add sprint reports"
git push
```

2. Add secrets in GitHub (Repo Settings → Secrets and variables → Actions):
   - `CONFLUENCE_URL`
   - `CONFLUENCE_USER`
   - `CONFLUENCE_API_TOKEN`
   - `SPACE_KEY`
   - `JIRA_BOARD_ID`
   - `CONFLUENCE_PROJECT_KEY`
   - `JIRA_STORY_POINTS_FIELD`
   - `OPENAI_API_KEY` (optional)

3. Done! Workflow runs daily at 09:00 UTC and generates reports when needed.

**Option 2: Manual Testing**

```bash
# Test both report types immediately
python3 test_reports.py both

# Only midpoint report
python3 test_reports.py midpoint

# Only end-of-sprint report
python3 test_reports.py end

# Check what will run (automatic date checking)
python3 run_midpoint_check.py
```

---

## Features

1. **AI-Enhanced Documentation**: Uses OpenAI's GPT models to generate detailed and structured documentation.

2. **Individual Documentation Files**:

   - **architectureDesign.adoc**: Provides a high-level overview of the system's architecture, including components, interactions, and design principles.
   - **detailedDesign.adoc**: Offers an in-depth explanation of the system's implementation, including class diagrams and run-time views.
   - **OpenApiSpecification.adoc**: Documents the API endpoints, request/response formats, and other details in compliance with the OpenAPI standard.

3. **Release Notes Generation**:

   - Extracts Jira ticket information from commit messages to create release notes.
   - Generates a summary in AsciiDoc format (`release-notes.adoc`) and individual text files for each release note.
   - Links Jira tickets directly to their respective descriptions for easy navigation.

4. **Multi-Protocol Support**: Supports various communication protocols like REST, gRPC, and SOME/IP.

5. **Open Source Workflow**: Encourages contributions through structured workflows and best practices.

---

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/Dinesh-s95/AutoDoc.ai.git
   ```

2. Follow the setup instructions in the respective microservice folders to run individual services.

3. For the MCP server, navigate to the `autodoc-ai-mcp-server` folder and follow the setup instructions in its README.

---

## References

- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Node.js Documentation](https://nodejs.org/en/docs/)
