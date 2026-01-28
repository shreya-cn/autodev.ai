import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

interface BacklogTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  type?: string;
  created?: string;
}

// Add POST method as well to bypass caching
export async function POST() {
  return GET();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ 
        error: 'Unauthorized - Please sign in again',
        tickets: []
      }, { status: 401 });
    }

    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      if (resourcesRes.status === 401) {
        return NextResponse.json({ 
          error: 'Session expired',
          logout: true,
          tickets: []
        }, { status: 401 });
      }
      return NextResponse.json({ 
        error: 'Failed to fetch Jira resources',
        tickets: []
      }, { status: resourcesRes.status });
    }

    const resources = await resourcesRes.json();
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        error: 'No Jira sites found for your account',
        tickets: []
      }, { status: 404 });
    }

    const cloudId = resources[0].id;
    const jiraBaseUrl = resources[0].url;

    const userRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch user information',
        tickets: []
      }, { status: userRes.status });
    }

    const currentUser = await userRes.json();

    const jql = `project = SCRUM AND sprint is EMPTY ORDER BY created DESC`;
    
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
          maxResults: 100,
          fields: ['summary', 'status', 'assignee', 'priority', 'issuetype', 'created']
        })
      }
    );

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      return NextResponse.json({ 
        error: `Failed to fetch backlog tickets (${searchRes.status})`,
        details: errorText,
        tickets: []
      }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    
    const tickets: BacklogTicket[] = (searchData.issues || []).map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      assigneeAccountId: issue.fields.assignee?.accountId || null,
      priority: issue.fields.priority?.name || 'Medium',
      type: issue.fields.issuetype?.name || 'Task',
      created: issue.fields.created,
    }));

    return NextResponse.json({
      tickets,
      jiraBaseUrl,
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        tickets: []
      },
      { status: 500 }
    );
  }
}
