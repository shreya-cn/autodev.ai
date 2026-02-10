import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Helper function to detect Jira ticket IDs in text (e.g., SCRUM-19, PROJ-123)
function extractTicketIds(text: string): string[] {
  const ticketPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  const matches = text.match(ticketPattern);
  return matches ? [...new Set(matches)] : [];
}

// Helper function to fetch Jira ticket details
async function fetchJiraTicket(ticketId: string, accessToken: string): Promise<any> {
  try {
    // Get Jira resources
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      return null;
    }

    const resources = await resourcesRes.json();
    if (!resources || resources.length === 0) {
      return null;
    }

    const cloudId = resources[0].id;

    // Fetch the ticket
    const ticketRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${ticketId}?fields=summary,description,issuetype,status,priority,assignee,labels,components,customfield_10016`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!ticketRes.ok) {
      return null;
    }

    return await ticketRes.json();
  } catch (error) {
    return null;
  }
}

// Helper function to format Jira ticket for context
function formatTicketContext(ticket: any): string {
  if (!ticket) return '';

  const description = ticket.fields?.description?.content
    ? ticket.fields.description.content
        .map((block: any) => 
          block.content?.map((item: any) => item.text || '').join('') || ''
        )
        .join('\n')
    : 'No description';

  return `
--- Jira Ticket: ${ticket.key} ---
Summary: ${ticket.fields?.summary || 'N/A'}
Type: ${ticket.fields?.issuetype?.name || 'N/A'}
Status: ${ticket.fields?.status?.name || 'N/A'}
Priority: ${ticket.fields?.priority?.name || 'N/A'}
Story Points: ${ticket.fields?.customfield_10016 || 'Not estimated'}
Assignee: ${ticket.fields?.assignee?.displayName || 'Unassigned'}
Labels: ${ticket.fields?.labels?.join(', ') || 'None'}
Components: ${ticket.fields?.components?.map((c: any) => c.name).join(', ') || 'None'}

Description:
${description}
`;
}

export async function POST(request: Request) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Detect Jira ticket IDs in the question
    const ticketIds = extractTicketIds(question);
    let jiraContext = '';

    // If ticket IDs are found, fetch their details
    if (ticketIds.length > 0) {
      const session = await getServerSession(authOptions);
      
      if (session?.accessToken) {
        for (const ticketId of ticketIds) {
          const ticket = await fetchJiraTicket(ticketId, session.accessToken);
          if (ticket) {
            jiraContext += formatTicketContext(ticket);
          }
        }
      }
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey || openaiApiKey === 'mock') {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get project documentation context
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    let knowledgeBaseContext = '';
    
    try {
      // Read documentation from microservices
      const services = ['identityprovider', 'enrollment', 'usermanagement', 'vehiclemanagement'];
      
      for (const service of services) {
        const docPath = path.join(workspaceRoot, service, 'documentation');
        if (fs.existsSync(docPath)) {
          const files = fs.readdirSync(docPath);
          for (const file of files) {
            if (file.endsWith('.adoc')) {
              const content = fs.readFileSync(path.join(docPath, file), 'utf-8');
              // Take first 2000 chars of each doc to avoid token limits
              knowledgeBaseContext += `\n\n--- ${service}/${file} ---\n${content.substring(0, 2000)}`;
            }
          }
        }
      }

      // Add README files
      const readmePath = path.join(workspaceRoot, 'README.md');
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf-8');
        knowledgeBaseContext += `\n\n--- README.md ---\n${content}`;
      }

      const projectOverviewPath = path.join(workspaceRoot, 'PROJECT_OVERVIEW.md');
      if (fs.existsSync(projectOverviewPath)) {
        const content = fs.readFileSync(projectOverviewPath, 'utf-8');
        knowledgeBaseContext += `\n\n--- PROJECT_OVERVIEW.md ---\n${content}`;
      }
    } catch (error) {
      // Continue without context
    }

    if (!knowledgeBaseContext) {
      return NextResponse.json({
        answer: 'No documentation found in the knowledge base. Please make sure your project has documentation files.',
        sources: [],
        confidence: 'low'
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Create prompt for OpenAI
    let contextSections = [];
    
    if (jiraContext) {
      contextSections.push(`JIRA TICKET INFORMATION:\n${jiraContext}`);
    }
    
    if (knowledgeBaseContext) {
      contextSections.push(`PROJECT DOCUMENTATION:\n${knowledgeBaseContext}`);
    }

    const systemPrompt = `You are a helpful AI assistant that answers questions about the AutoDev.ai project, including Jira tickets and codebase documentation.

Your task is to:
1. If the question is about a specific Jira ticket, analyze the ticket details and suggest what changes should be made based on the ticket description, acceptance criteria, and type
2. Use the project documentation to provide technical guidance on how to implement those changes
3. Be specific about files, services, or components that should be modified
4. Cite the Jira ticket details and relevant documentation
5. Provide actionable, step-by-step guidance when possible
6. If information is missing, clearly state what's unclear

FORMATTING REQUIREMENTS:
- Use markdown formatting for better readability
- Use ### for step headers
- Use **bold** for file names and important terms
- Use \`code\` for inline code elements like class names, methods, and variables
- Use \`\`\`language for code blocks
- Use numbered lists for step-by-step instructions
- Use bullet points for feature lists or requirements
- Keep paragraphs concise and well-spaced
- Add blank lines between sections for better readability

${contextSections.join('\n\n---\n\n')}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const answer = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate an answer.';

    // Extract sources mentioned in the answer
    const sources: Array<{ file: string; type: string; relevance: number }> = [];
    
    // Add Jira tickets as sources
    if (ticketIds.length > 0) {
      ticketIds.forEach(ticketId => {
        sources.push({
          file: ticketId,
          type: 'jira-ticket',
          relevance: 1.0
        });
      });
    }
    
    // Add documentation sources
    const services = ['identityprovider', 'enrollment', 'usermanagement', 'vehiclemanagement'];
    services.forEach(service => {
      if (answer.toLowerCase().includes(service.toLowerCase())) {
        sources.push({
          file: `${service}/documentation`,
          type: 'documentation',
          relevance: 0.8
        });
      }
    });

    return NextResponse.json({
      answer,
      sources,
      confidence: answer.includes('not found') || answer.includes('don\'t have') || answer.includes('unclear') ? 'medium' : 'high',
      suggestedFollowUps: ticketIds.length > 0 ? [
        'What testing should I do for this ticket?',
        'Are there any dependencies I should be aware of?',
        'What documentation should I update?'
      ] : []
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to query knowledge base',
        answer: 'Sorry, an error occurred while processing your question.'
      },
      { status: 500 }
    );
  }
}
