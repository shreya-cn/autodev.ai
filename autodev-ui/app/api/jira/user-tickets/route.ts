import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  priority: string;
  type?: string;
  updated?: string;
  created?: string;
}

interface Column {
  id: string;
  name: string;
  tickets: JiraTicket[];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session:', session ? 'exists' : 'null');
    console.log('Access Token:', session?.accessToken ? 'exists' : 'missing');
    
    if (!session?.accessToken) {
      console.error('No access token in session');
      return NextResponse.json({ 
        error: 'Unauthorized - Please sign in again',
        columns: [
          { id: 'todo', name: 'To Do', tickets: [] },
          { id: 'inprogress', name: 'In Progress', tickets: [] },
          { id: 'review', name: 'Review', tickets: [] },
          { id: 'done', name: 'Done', tickets: [] },
        ]
      }, { status: 401 });
    }

    // First, get accessible Jira resources
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
          columns: [
            { id: 'todo', name: 'To Do', tickets: [] },
            { id: 'inprogress', name: 'In Progress', tickets: [] },
            { id: 'review', name: 'Review', tickets: [] },
            { id: 'done', name: 'Done', tickets: [] },
          ]
        }, { status: 401 });
      }
      console.error('Failed to fetch accessible resources:', resourcesRes.status);
      return NextResponse.json({ 
        error: 'Failed to fetch Jira resources',
        columns: [
          { id: 'todo', name: 'To Do', tickets: [] },
          { id: 'inprogress', name: 'In Progress', tickets: [] },
          { id: 'review', name: 'Review', tickets: [] },
          { id: 'done', name: 'Done', tickets: [] },
        ]
      }, { status: resourcesRes.status });
    }

    if (!resourcesRes.ok) {
      console.error('Failed to fetch resources:', resourcesRes.status, resourcesRes.statusText);
      throw new Error(`Failed to fetch accessible resources: ${resourcesRes.status}`);
    }

    const resources = await resourcesRes.json();
    console.log('Found resources:', resources.length);
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        error: 'No Jira sites found for your account',
        columns: [
          { id: 'todo', name: 'To Do', tickets: [] },
          { id: 'inprogress', name: 'In Progress', tickets: [] },
          { id: 'review', name: 'Review', tickets: [] },
          { id: 'done', name: 'Done', tickets: [] },
        ]
      }, { status: 404 });
    }

    const cloudId = resources[0].id;

    // Get current user info
    const userRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch user info');
    }

    const currentUser = await userRes.json();

    // Fetch all tickets from the SA project (ScrumAutoDev board)
    const jql = `project = SA ORDER BY updated DESC`;
    
    console.log('Fetching tickets with JQL:', jql);
    
    const ticketsRes = await fetch(
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
          fields: ['summary', 'status', 'assignee', 'priority', 'issuetype', 'updated', 'created']
        })
      }
    );

    console.log('Tickets response status:', ticketsRes.status);
    
    if (!ticketsRes.ok) {
      const errorText = await ticketsRes.text();
      console.error('Tickets API error:', errorText);
      throw new Error(`Failed to fetch tickets: ${ticketsRes.status} - ${errorText}`);
    }

    const ticketsData = await ticketsRes.json();
    console.log('Tickets fetched:', ticketsData.issues?.length || 0);

    // Transform Jira issues to our format
    const tickets: JiraTicket[] = (ticketsData.issues || []).map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      priority: issue.fields.priority?.name || 'Medium',
      type: issue.fields.issuetype?.name || 'Task',
      updated: issue.fields.updated,
      created: issue.fields.created,
    }));

    // Organize tickets by status
    const columns: Column[] = [
      { id: 'todo', name: 'To Do', tickets: [] },
      { id: 'inprogress', name: 'In Progress', tickets: [] },
      { id: 'review', name: 'Review', tickets: [] },
      { id: 'done', name: 'Done', tickets: [] },
    ];

    tickets.forEach((ticket) => {
      const status = ticket.status?.toLowerCase() || '';
      
      if (status.includes('to do') || status.includes('todo') || status.includes('backlog')) {
        columns[0].tickets.push(ticket);
      } else if (status.includes('in progress') || status.includes('progress')) {
        columns[1].tickets.push(ticket);
      } else if (status.includes('review') || status.includes('code review')) {
        columns[2].tickets.push(ticket);
      } else if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
        columns[3].tickets.push(ticket);
      } else {
        columns[0].tickets.push(ticket);
      }
    });

    return NextResponse.json({ 
      columns,
      user: {
        accountId: currentUser.accountId,
        displayName: currentUser.displayName,
        emailAddress: currentUser.emailAddress,
      },
      site: {
        name: resources[0].name,
        url: resources[0].url,
      },
      jiraBaseUrl: resources[0].url
    });

  } catch (error: any) {
    console.error('Error fetching user Jira tickets:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { 
        error: `Failed to fetch Jira tickets: ${error.message}`,
        columns: [
          { id: 'todo', name: 'To Do', tickets: [] },
          { id: 'inprogress', name: 'In Progress', tickets: [] },
          { id: 'review', name: 'Review', tickets: [] },
          { id: 'done', name: 'Done', tickets: [] },
        ]
      },
      { status: 500 }
    );
  }
}
