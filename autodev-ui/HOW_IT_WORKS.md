# How to Get Neat, Easily Understandable Ticket Descriptions with References

## The Solution: Smart Prompt Engineering + Project Context

Your ticket generator gets high-quality descriptions through a multi-layered approach:

## 1. **Automatic Project Context Fetching**

The system automatically gathers context about your project:
- **Microservices**: identityprovider, enrollment, usermanagement, vehiclemanagement
- **Available Documentation**: Pulls from your documentation API
- **Project Structure**: Understanding of your tech stack

This context is injected into the LLM prompt so generated tickets reference **your actual project components**.

## 2. **Structured Prompt Engineering**

The system prompt instructs the LLM to create tickets with:

### ✅ **Neatness**
- Organized sections (Background → Problem → Expected Outcome)
- Consistent formatting
- Professional language
- Logical information flow

### ✅ **Easy Understanding**
- Clear problem statements
- No unnecessary jargon
- Context for both technical and non-technical stakeholders
- Step-by-step breakdown of complex issues

### ✅ **References Around the Problem**

The LLM is instructed to include:

#### a) **Related Components Section**
```typescript
"relatedComponents": [
  "identityprovider",      // From your actual microservices
  "usermanagement",
  "OAuth Service"
]
```

#### b) **Technical Notes with References**
```
Technical Notes:
- Reference to affected API endpoints
- Similar issues or documentation links
- Architecture patterns to use
- Performance/security considerations
- Testing requirements
- Implementation hints
```

#### c) **Contextual Description**
The description includes:
- **Background**: Historical context and why this matters
- **Current State**: What's happening now (with specific examples)
- **Impact**: Who/what is affected
- **Expected Outcome**: Clear success criteria
- **References to related work**: Similar tickets, docs, or features

## 3. **Quality Through Acceptance Criteria**

Each ticket includes specific, measurable acceptance criteria:
```typescript
"acceptanceCriteria": [
  "Users can upload files up to 50MB successfully",
  "Clear error message shown when limit exceeded",
  "Upload progress visible for large files",
  "All existing file types remain supported"
]
```

These criteria serve as:
- ✓ Definition of done
- ✓ Testing checklist  
- ✓ Reference for developers
- ✓ Clear success metrics

## 4. **Smart Type and Priority Detection**

The LLM analyzes your input to:
- **Classify correctly**: Bug vs Story vs Task
- **Prioritize appropriately**: Based on user impact, urgency, business value
- **Suggest relevant labels**: Based on affected components

## Example: From Brief Input to Comprehensive Ticket

### Your Input:
```
Login is slow and sometimes fails. Users wait 10-15 seconds 
and 30% of logins fail even with correct credentials.
```

### Generated Ticket:

**Summary**: "Optimize login authentication performance and fix intermittent failures"

**Description**:
```
Background:
The authentication service in the identityprovider microservice is experiencing 
performance degradation. This issue emerged after the recent OAuth integration 
and is significantly impacting user experience.

Problem Statement:
- Login attempts take 10-15 seconds (baseline: 1-2 seconds)
- 30% of authentication requests fail despite valid credentials
- Issue affects all users across web and mobile platforms
- Database connection pool may be exhausted during peak times

Current Behavior:
Users enter valid credentials → System shows loading spinner → Long delay 
→ Random failures with "Authentication failed" message

Expected Behavior:
Users enter valid credentials → Quick validation (< 2 seconds) → Successful 
login 99.9% of the time with proper error messages for actual failures

Impact:
- User frustration and abandonment
- Increased support tickets
- Potential revenue loss
- Damage to brand reputation
```

**Acceptance Criteria**:
1. ✅ Login completes within 2 seconds for 95th percentile
2. ✅ Authentication success rate above 99.5%
3. ✅ Proper error messages for actual credential failures
4. ✅ Database connection pooling optimized
5. ✅ Monitoring alerts added for slow logins
6. ✅ Load testing validates performance under peak load

**Related Components**:
- `identityprovider` microservice
- `usermanagement` microservice  
- OAuth Service
- Database connection pool
- Frontend authentication module

**Technical Notes**:
```
Investigation Areas:
1. Database Query Performance
   - Check for missing indexes on users table
   - Review connection pool configuration
   - Analyze slow query logs

2. OAuth Integration
   - Token validation may be timing out
   - Check external OAuth provider response times
   - Implement caching for token validation

3. Implementation Suggestions
   - Add database connection pooling (HikariCP recommended)
   - Implement Redis caching for session tokens
   - Add circuit breaker for OAuth provider calls
   - Use async/await for non-blocking authentication

4. Monitoring & Testing
   - Add APM tracing for login flow
   - Set up alerts for >3 second login times
   - Load test with 1000 concurrent users
   - Monitor database connection metrics

5. Related Documentation
   - See docs/architecture/authentication-flow.md
   - OAuth integration guide: docs/oauth-setup.md
   - Performance baseline: docs/metrics/authentication.md
```

**Priority**: High (user-facing, high impact)
**Type**: Bug

## Why This Approach Works

### 1. **Context-Aware**
Uses YOUR project structure, YOUR components, YOUR documentation

### 2. **Comprehensive**
Covers all angles: what, why, how, impact, solution

### 3. **Actionable**
Developers know exactly what to do and how to verify success

### 4. **Stakeholder-Friendly**
Non-technical people understand the impact and priority

### 5. **Reference-Rich**
Points to relevant code, docs, services, and similar issues

## Key Prompt Engineering Techniques Used

```typescript
// In the system prompt:
{
  "context_injection": "Project microservices, documentation",
  "structured_format": "JSON with specific sections",
  "quality_guidelines": [
    "Professional language",
    "Specific examples",
    "Measurable criteria",
    "Technical depth without jargon"
  ],
  "reference_requirements": [
    "Identify affected components",
    "Suggest implementation approaches",
    "Link to related work",
    "Include testing considerations"
  ]
}
```

## The Secret: Structured Output + Context

The LLM uses:
1. **Your project context** → Relevant component references
2. **Structured JSON output** → Consistent, organized format
3. **Explicit instructions** → Quality guidelines for descriptions
4. **Temperature 0.7** → Balance between creativity and consistency

## How Users Get Great Results

Users simply need to provide:
- **What** is the problem or enhancement
- **Why** it matters (impact)
- **Any technical details** they know

The AI handles:
- ✓ Structuring it professionally
- ✓ Adding relevant references
- ✓ Creating acceptance criteria
- ✓ Identifying components
- ✓ Suggesting implementation notes
- ✓ Formatting for easy reading

## Result

Every generated ticket is:
- 📋 **Neat**: Well-organized, professional structure
- 🎯 **Clear**: Easy to understand for all stakeholders  
- 🔗 **Referenced**: Links to your actual components and technical considerations
- ✅ **Actionable**: Clear acceptance criteria and implementation guidance
- 🚀 **Ready**: Can be created in Jira immediately

---

**The magic is in combining smart prompt engineering with automatic project context fetching to create tickets that feel like they were written by an experienced technical project manager who knows your codebase.**
