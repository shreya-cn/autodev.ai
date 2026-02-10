# AI Ticket Generator - Guide to Getting High-Quality Ticket Descriptions

## Overview

The AI Ticket Generator uses OpenAI's language models to transform brief problem descriptions into comprehensive, professional Jira tickets. This guide explains how the system works and how to maximize the quality of generated tickets.

## How It Works

### 1. **Context Gathering**
The system automatically fetches project context including:
- Available microservices in your project
- Existing documentation
- Project structure and components

This context is sent to the LLM to ensure generated tickets are relevant to your specific project.

### 2. **Intelligent Prompt Engineering**
The LLM receives a carefully crafted system prompt that instructs it to:
- Analyze the user's brief description
- Extract key information about the problem/enhancement
- Structure the ticket according to best practices
- Provide comprehensive details that make implementation clear

### 3. **Structured Output Generation**
The LLM generates a JSON response with:
- **Summary**: Concise, action-oriented title
- **Description**: Detailed, multi-paragraph explanation with:
  - Background/Context
  - Problem Statement or Enhancement Goal
  - Current vs Expected Behavior
  - Impact Analysis
- **Acceptance Criteria**: Specific, measurable success criteria
- **Suggested Type**: Story, Bug, or Task classification
- **Suggested Priority**: Priority level based on impact
- **Related Components**: Affected services/modules
- **Technical Notes**: Implementation guidance and references

## How to Get Appropriate Descriptions and Summaries

### Best Practices for Input

#### ✅ Good Input Examples:

**Example 1 - Bug Report:**
```
The login page is slow and sometimes fails to authenticate users. When users enter 
correct credentials, they see a spinning loader for 10-15 seconds, and about 30% 
of the time, it shows "Authentication failed" even though credentials are correct. 
This is affecting user satisfaction and causing support tickets.
```

**Example 2 - Enhancement:**
```
We need to add a dashboard analytics view that shows key metrics for team 
performance. Users should be able to see sprint velocity, burndown charts, and 
ticket completion rates. This will help managers track team progress and make 
data-driven decisions.
```

**Example 3 - Technical Task:**
```
Our current OAuth implementation doesn't handle token refresh properly. When 
access tokens expire after 1 hour, users are forced to log in again. We need 
to implement automatic token refresh using refresh tokens to maintain seamless 
user experience.
```

#### ❌ Poor Input Examples:

```
❌ "Fix login bug"
   - Too vague, lacks context
   
❌ "Make it faster"
   - No specific details about what or why
   
❌ "Add feature"
   - Doesn't describe the feature or its purpose
```

### Input Guidelines

To get the best results, include these elements in your input:

1. **Context**: What part of the system is affected?
2. **Problem/Goal**: What's wrong or what do you want to achieve?
3. **Impact**: Who is affected and how?
4. **Details**: Specific behaviors, error messages, or requirements
5. **Expected Outcome**: What should happen instead?

### Structure of Generated Tickets

The AI structures tickets to be:

#### 1. **Neat and Organized**
```
Summary: [Action-oriented, concise title]

Description:
┌─────────────────────────────────┐
│ Background/Context              │
│ - Why this is needed            │
│ - Current situation             │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Problem Statement               │
│ - Clear description of issue    │
│ - Observable symptoms           │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Expected Outcome                │
│ - Desired behavior              │
│ - Success metrics               │
└─────────────────────────────────┘
```

#### 2. **Easily Understandable**
- Uses clear, professional language
- Avoids unnecessary jargon
- Provides context for both technical and non-technical readers
- Structures information logically
- Breaks down complex concepts

#### 3. **With References**
The AI includes:
- **Related Components**: Links to affected microservices or modules
- **Technical Notes**: References to:
  - Relevant APIs or endpoints
  - Design patterns to consider
  - Similar tickets or documentation
  - Performance implications
  - Security considerations
  - Testing requirements

### Example Generated Ticket

**Input:**
```
Users can't upload files larger than 5MB. The upload fails silently without any 
error message. We need to support files up to 50MB and show proper error messages.
```

**Generated Output:**
```json
{
  "summary": "Increase file upload limit to 50MB and add error handling",
  "description": "Background:
Currently, users attempting to upload files larger than 5MB experience silent 
failures with no feedback, leading to confusion and frustration. This limitation 
was implemented as a temporary measure but is now blocking legitimate use cases.

Problem Statement:
- File uploads fail silently when size exceeds 5MB
- No error message is displayed to users
- Users cannot upload necessary documents (reports, presentations, etc.)
- Support team receiving complaints about missing uploads

Expected Outcome:
- Users can successfully upload files up to 50MB
- Clear error messages when upload fails
- Progress indicator during upload
- Proper validation and user feedback",
  
  "acceptanceCriteria": [
    "Users can upload files up to 50MB successfully",
    "Files larger than 50MB show clear error: 'File size exceeds 50MB limit'",
    "Upload progress is visible for files larger than 1MB",
    "All file types currently supported remain functional",
    "Upload errors are logged for debugging"
  ],
  
  "suggestedType": "Story",
  "suggestedPriority": "High",
  
  "relatedComponents": [
    "File Upload Service",
    "Frontend - Upload Component",
    "API Gateway",
    "Storage Service"
  ],
  
  "technicalNotes": "Implementation Considerations:
- Update nginx/API gateway configuration for max body size
- Implement chunked upload for large files
- Add client-side validation before upload begins
- Update backend file size validation
- Configure CDN/storage service limits
- Add comprehensive error handling and user feedback
- Consider implementing retry mechanism for failed uploads
- Update file storage quota calculations
- Add monitoring for large file uploads
- Test with various file types and sizes"
}
```

## Advanced Features

### Context-Aware Generation

The AI uses your project's documentation to:
- Suggest relevant components from your microservices
- Reference existing architecture patterns
- Align with your project's terminology
- Consider your tech stack

### Adaptive Priority and Type

The AI analyzes your input to determine:
- **Bug**: Issues affecting existing functionality
- **Story**: New features or enhancements
- **Task**: Technical work or improvements

Priority is based on:
- User impact (how many users affected?)
- Business impact (revenue, reputation)
- Urgency (security, data loss, system down)
- Effort vs. value

### Comprehensive Acceptance Criteria

Generated criteria are:
- **Specific**: Clear, unambiguous requirements
- **Measurable**: Can be tested and verified
- **Achievable**: Realistic and implementable
- **Relevant**: Directly tied to the ticket goal
- **Testable**: Can be validated through testing

## Tips for Best Results

### 1. Provide Rich Context
```
Good: "The checkout process in the e-commerce module fails when users apply 
discount codes. The error occurs at the payment gateway integration step and 
affects about 15% of transactions during sales."

Better: Includes what, where, frequency, and impact
```

### 2. Mention Technical Details When Known
```
Good: "API response times are slow"

Better: "The /api/users endpoint takes 3-5 seconds to respond when fetching 
user lists with more than 100 records. The database query is not optimized 
and missing indexes."
```

### 3. Include User Impact
```
Good: "Search doesn't work"

Better: "The search feature returns no results for partial matches. Users 
expect to find products by typing partial names (e.g., 'Mac' for 'MacBook'), 
but currently only exact matches work. This is causing 40% drop in search usage."
```

### 4. Specify Desired Outcomes
```
Good: "Improve performance"

Better: "Reduce page load time from current 4 seconds to under 1 second. 
Implement lazy loading for images and optimize JavaScript bundle size. 
Target: 90+ Lighthouse performance score."
```

## Quality Assurance

The AI-generated tickets undergo automatic validation:
- ✓ Summary length (concise, under 100 chars)
- ✓ Description completeness (multiple sections)
- ✓ Acceptance criteria presence
- ✓ Technical notes relevance
- ✓ Component identification
- ✓ JSON structure integrity

## Review and Refine

After generation:
1. **Review** the generated ticket
2. **Edit** any sections if needed (directly in UI)
3. **Verify** acceptance criteria are complete
4. **Confirm** priority and type are appropriate
5. **Create** the ticket in Jira

## Environment Variables

Ensure these are configured in your `.env.local`:

```bash
OPENAI_API_KEY=sk-proj-...          # Required for AI generation
OPENAI_MODEL=gpt-4-turbo            # Optional, defaults to gpt-4-turbo
NEXTAUTH_URL=http://localhost:3000   # Your app URL
```

## Troubleshooting

### Low Quality Output?
- Provide more context in your input
- Include specific details about the problem
- Mention affected components or services
- Describe the expected outcome clearly

### Wrong Type/Priority?
- Be more explicit about impact and urgency
- Mention if it's a bug, enhancement, or technical task
- Describe business/user impact clearly

### Missing Technical Details?
- Include technical context in your input
- Mention specific technologies or APIs affected
- Reference error messages or logs if available

## Best Practices Summary

✅ **Do:**
- Be specific and detailed
- Include context and impact
- Mention affected users/systems
- Describe expected outcomes
- Include any technical details you know

❌ **Don't:**
- Use vague descriptions
- Skip important context
- Forget to mention user impact
- Leave out expected behavior
- Use overly technical jargon without explanation

---

**Result**: Professional, comprehensive tickets that development teams can implement confidently, with clear acceptance criteria and all necessary context for successful delivery.
