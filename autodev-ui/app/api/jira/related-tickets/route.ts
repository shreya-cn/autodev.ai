import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ 
        tickets: [],
        currentTicket: ''
      });
    }

    // Get accessible Jira resources
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      throw new Error('Failed to fetch resources');
    }

    const resources = await resourcesRes.json();
    if (!resources || resources.length === 0) {
      throw new Error('No Jira sites found');
    }

    const cloudId = resources[0].id;
    const jiraBaseUrl = resources[0].url;

    // Fetch tickets that are related (e.g., OAuth, authentication, API related)
    const jql = `project = SCRUM AND (summary ~ "OAuth" OR summary ~ "authentication" OR summary ~ "API" OR summary ~ "session" OR summary ~ "token") ORDER BY created DESC`;
    
    const searchRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: 10,
          fields: ['summary', 'status', 'priority', 'description']
        })
      }
    );

    if (!searchRes.ok) {
      throw new Error('Failed to search tickets');
    }

    const searchData = await searchRes.json();
    
    const tickets = (searchData.issues || []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      score: 85, // Mock similarity score
      reason: 'Related to authentication and API work',
    }));

    return NextResponse.json({ 
      tickets,
      currentTicket: tickets.length > 0 ? tickets[0].key : '',
      jiraBaseUrl
    });
  } catch (error) {
    console.error('Error fetching related tickets:', error);
    
    // Return empty on error instead of mock data
    return NextResponse.json({
      tickets: [],
      currentTicket: '',
    });
  }
}
