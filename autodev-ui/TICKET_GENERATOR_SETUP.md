# Ticket Generator - Quick Setup & Usage

## 🚀 Quick Start

### 1. Environment Setup

Add to your `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4-turbo  # Optional, defaults to gpt-4-turbo
```

### 2. Access the Ticket Generator

Navigate to: `http://localhost:3000/ticket-generator`

### 3. Create Your First Ticket

1. **Describe the issue or enhancement** in the text area
2. Click **"Generate Ticket"**
3. Review the AI-generated ticket
4. Click **"Create Ticket in Jira"** to add it to your backlog

## 📝 Example Inputs

### Bug Report
```
The login page is slow and sometimes fails to authenticate users. 
When users enter correct credentials, they see a spinning loader 
for 10-15 seconds, and about 30% of the time it shows "Authentication 
failed" even though credentials are correct.
```

### Feature Enhancement  
```
We need a dashboard analytics view showing team performance metrics. 
Users should see sprint velocity, burndown charts, and completion rates 
to help managers track progress and make data-driven decisions.
```

### Technical Task
```
Our OAuth implementation doesn't handle token refresh. When access 
tokens expire after 1 hour, users must log in again. Need automatic 
token refresh for seamless experience.
```

## 🎯 What You Get

Each generated ticket includes:

- ✅ **Summary**: Concise, action-oriented title
- 📄 **Description**: Comprehensive with background, problem, and expected outcome
- ✓ **Acceptance Criteria**: Specific, measurable success criteria  
- 🏷️ **Type**: Bug, Story, or Task
- ⚡ **Priority**: Automatically suggested based on impact
- 🔧 **Related Components**: Your actual microservices
- 💡 **Technical Notes**: Implementation guidance and references

## 🔑 How to Get Quality Results

### Good Input ✅
- Be specific about the problem
- Include context (what, where, when, why)
- Mention user/business impact
- Add any technical details you know

### Poor Input ❌
- "Fix bug" (too vague)
- "Make faster" (no specifics)
- "Add feature" (no description)

## 📚 Files Created

1. **Page**: [app/ticket-generator/page.tsx](app/ticket-generator/page.tsx)
   - User interface with text editor and preview

2. **API - Generate**: [app/api/jira/generate-ticket/route.ts](app/api/jira/generate-ticket/route.ts)
   - Calls OpenAI to generate ticket from user input

3. **API - Create**: [app/api/jira/create-ticket/route.ts](app/api/jira/create-ticket/route.ts)
   - Creates the ticket in Jira

4. **Guides**:
   - [TICKET_GENERATOR_GUIDE.md](TICKET_GENERATOR_GUIDE.md) - Comprehensive guide
   - [HOW_IT_WORKS.md](HOW_IT_WORKS.md) - How descriptions are generated

## 🛠️ Customization

### Change Project Key
Edit `app/api/jira/create-ticket/route.ts`:
```typescript
project: {
  key: 'YOUR_PROJECT_KEY'  // Change from 'SCRUM' to your project
}
```

### Adjust AI Model
In `.env.local`:
```bash
OPENAI_MODEL=gpt-4o  # Use GPT-4o
# or
OPENAI_MODEL=gpt-3.5-turbo  # Faster, cheaper
```

### Add Custom Components
The AI automatically detects components from your documentation API. To add more:

Edit `app/api/jira/generate-ticket/route.ts` to include additional context in the system prompt.

## 🔍 How It Gets Quality Descriptions

The system achieves high-quality, well-referenced tickets through:

### 1. **Project Context Injection**
```typescript
// Automatically fetches:
- Your microservices (identityprovider, enrollment, etc.)
- Available documentation
- Project structure
```

### 2. **Smart Prompt Engineering**
```typescript
// System prompt instructs LLM to:
- Structure information clearly (Background → Problem → Solution)
- Use professional language
- Include specific acceptance criteria
- Reference relevant components
- Add technical implementation notes
```

### 3. **Structured JSON Output**
```json
{
  "summary": "Clear, concise title",
  "description": "Multi-section detailed description",
  "acceptanceCriteria": ["Measurable criteria"],
  "relatedComponents": ["Your actual services"],
  "technicalNotes": "Implementation guidance"
}
```

## 💡 Pro Tips

1. **Be Detailed**: More context = better tickets
2. **Include Impact**: Helps AI set correct priority
3. **Mention Components**: If you know which service is affected
4. **Add Technical Details**: Error messages, logs, specific behaviors
5. **Review Before Creating**: You can always refine the generated ticket

## 🐛 Troubleshooting

### "OpenAI API key not configured"
- Add `OPENAI_API_KEY` to `.env.local`
- Restart your development server

### Poor Quality Output
- Provide more context in your input
- Be more specific about the problem
- Include user/business impact

### Wrong Priority/Type
- Be explicit about urgency and impact
- Clearly state if it's a bug or enhancement

## 🎨 UI Features

- **Real-time Generation**: See AI generate your ticket
- **Live Preview**: Review all sections before creating
- **Edit Before Create**: Modify any section if needed
- **Type & Priority Badges**: Visual indicators
- **Component Tags**: See related services at a glance
- **Success Feedback**: Confirmation with ticket key

## 📊 Example Generated Ticket

**Input**: "Login is slow, takes 15 seconds and fails 30% of the time"

**Output**:
```
Summary: Optimize login authentication performance and fix failures

Type: Bug | Priority: High

Description:
[Comprehensive multi-paragraph description with background, 
problem statement, impact, and expected outcome]

Acceptance Criteria:
✓ Login completes within 2 seconds
✓ Success rate above 99.5%
✓ Proper error messages
✓ Load testing validates performance

Related Components:
• identityprovider
• usermanagement  
• OAuth Service

Technical Notes:
[Implementation suggestions, monitoring requirements, 
testing approach, and references to relevant docs]
```

## 🚦 Next Steps

1. Try the ticket generator at `/ticket-generator`
2. Read [HOW_IT_WORKS.md](HOW_IT_WORKS.md) to understand the magic
3. Check [TICKET_GENERATOR_GUIDE.md](TICKET_GENERATOR_GUIDE.md) for best practices
4. Start creating high-quality tickets! 🎉

---

**Questions?** Check the comprehensive guides or review the API code to customize for your needs.
