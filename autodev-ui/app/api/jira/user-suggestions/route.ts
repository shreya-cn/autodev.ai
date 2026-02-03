import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Get accessible Jira resources
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      if (resourcesRes.status === 401) {
        return NextResponse.json({ error: 'Session expired', logout: true }, { status: 401 });
      }
      throw new Error('Failed to fetch accessible resources');
    }

    const resources = await resourcesRes.json();
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({ error: 'No Jira sites found' }, { status: 404 });
    }

    const cloudId = resources[0].id;

    // Fetch user's current tickets (assigned to them)
    const userTicketsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: `project = SCRUM AND assignee = currentUser() AND status != Done ORDER BY updated DESC`,
          maxResults: 50,
          fields: ['summary', 'description', 'status', 'issuetype', 'sprint']
        })
      }
    );

    if (!userTicketsRes.ok) {
      throw new Error('Failed to fetch user tickets');
    }

    const userTicketsData = await userTicketsRes.json();
    const userTickets = userTicketsData.issues || [];

    // Fetch unassigned tickets from current sprint and backlog
    const unassignedTicketsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: `project = SCRUM AND assignee is EMPTY AND status != Done ORDER BY updated DESC`,
          maxResults: 100,
          fields: ['summary', 'description', 'status', 'issuetype', 'sprint', 'created', 'customfield_10020']
        })
      }
    );

    const unassignedTicketsData = unassignedTicketsRes.ok ? (await unassignedTicketsRes.json()).issues || [] : [];

    // Helper function to extract description text from Jira's ADF format or plain text
    const extractDescription = (descriptionField: any): string => {
      if (!descriptionField) return '';
      
      // Handle Atlassian Document Format (ADF)
      if (descriptionField.content && Array.isArray(descriptionField.content)) {
        return descriptionField.content
          .map((node: any) => {
            if (node.type === 'paragraph' && node.content) {
              return node.content.map((c: any) => c.text || '').join(' ');
            }
            return '';
          })
          .join(' ');
      }
      
      // Handle plain text
      return String(descriptionField);
    };

    // Process each user ticket to find relevant unassigned tickets
    const suggestions = await Promise.all(
      userTickets.map(async (userTicket: any) => {
        const currentTicketSummary = userTicket.fields.summary || '';
        const currentTicketDescription = extractDescription(userTicket.fields.description) || 'No description';

        // Categorize unassigned tickets
        const categorizedTickets = unassignedTicketsData.map((ticket: any) => {
          // Sprint can be in different fields depending on Jira configuration
          const sprints = ticket.fields.sprint || ticket.fields.customfield_10020 || [];
          
          // Check if ticket is in an active sprint (not future or closed)
          let category: 'current-sprint' | 'backlog' = 'backlog';
          
          // Handle both single sprint object and array of sprints
          const sprintArray = Array.isArray(sprints) ? sprints : (sprints ? [sprints] : []);
          
          if (sprintArray.length > 0) {
            // Check if any sprint is active
            const hasActiveSprint = sprintArray.some((sprint: any) => 
              sprint && sprint.state === 'active'
            );
            if (hasActiveSprint) {
              category = 'current-sprint';
            }
          }
          
          return {
            ...ticket,
            category
          };
        });

        // Prepare tickets for LLM analysis
        const ticketsForAnalysis = categorizedTickets.map((ticket: any) => ({
          key: ticket.key,
          summary: ticket.fields.summary,
          description: extractDescription(ticket.fields.description) || 'No description',
          category: ticket.category,
          status: ticket.fields.status?.name
        }));

        if (ticketsForAnalysis.length === 0) {
          return {
            ticketKey: userTicket.key,
            title: currentTicketSummary,
            suggestions: [],
            confidence: 0,
            lastUpdated: new Date().toISOString(),
          };
        }

        // Use OpenAI to analyze relevance
        const prompt = `You are an expert software development project manager analyzing Jira tickets for relevance.

CURRENT TICKET (that the developer is working on):
Key: ${userTicket.key}
Summary: ${currentTicketSummary}
Description: ${currentTicketDescription}

TASK: Analyze the following unassigned tickets and identify which ones are HIGHLY relevant to the current ticket. Look for:
1. Similar technical components (e.g., same database tables, UI components, APIs)
2. Related features or functionality
3. Shared domain concepts or business logic
4. Dependencies or prerequisite work
5. Common technical challenges

Only return tickets with 60% or higher relevance.

UNASSIGNED TICKETS TO ANALYZE:
${ticketsForAnalysis.map((t, i) => `
${i + 1}. ${t.key} [${t.category === 'current-sprint' ? 'CURRENT SPRINT' : 'BACKLOG'}]
   Summary: ${t.summary}
   Description: ${t.description}
   Status: ${t.status}
`).join('\n')}

RESPONSE FORMAT (JSON only, no markdown):
{
  "relevant_tickets": [
    {
      "key": "ticket-key",
      "relevance_score": 85,
      "reasoning": "brief explanation of why this ticket is relevant",
      "category": "current-sprint" or "backlog"
    }
  ]
}

Only include tickets with relevance_score >= 30. Return empty array if no tickets meet the threshold.`;

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a technical project manager expert at analyzing software development tickets. Respond only with valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0,
            max_tokens: 2000,
          });

          const responseText = completion.choices[0]?.message?.content || '{}';
          console.log(`OpenAI response for ${userTicket.key}:`, responseText);
          
          // Parse the response
          const llmResponse = JSON.parse(responseText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
          const relevantTickets = llmResponse.relevant_tickets || [];
          console.log(`Found ${relevantTickets.length} relevant tickets for ${userTicket.key}`);

          // Map the results
          const mappedTickets = relevantTickets.map((item: any) => {
            const originalTicket = categorizedTickets.find(t => t.key === item.key);
            return {
              key: item.key,
              summary: originalTicket?.fields.summary || '',
              status: originalTicket?.fields.status?.name || 'Unknown',
              relevance: item.relevance_score,
              category: item.category,
              assignee: 'Unassigned',
              reasoning: item.reasoning
            };
          });

          return {
            ticketKey: userTicket.key,
            title: currentTicketSummary,
            suggestions: mappedTickets,
            confidence: mappedTickets.length > 0 ? Math.min(mappedTickets[0].relevance / 100, 0.95) : 0,
            lastUpdated: new Date().toISOString(),
          };

        } catch (error: any) {
          console.error(`Error calling OpenAI for ${userTicket.key}:`, error.message);
          console.error(`Full error:`, error);
          return {
            ticketKey: userTicket.key,
            title: currentTicketSummary,
            suggestions: [],
            confidence: 0,
            lastUpdated: new Date().toISOString(),
          };
        }
      })
    );

    // Filter out tickets with no suggestions
    const validSuggestions = suggestions.filter(s => s.suggestions.length > 0);

    console.log('Total user tickets:', userTickets.length);
    console.log('Total unassigned tickets:', unassignedTicketsData.length);
    console.log('Suggestions with results:', validSuggestions.length);
    console.log('All suggestions:', suggestions);

    return NextResponse.json({ suggestions: validSuggestions });

  } catch (error: any) {
    console.error('Error in user-suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
