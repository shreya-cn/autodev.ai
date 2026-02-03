import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ 
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const { ticketKey, accountId } = await request.json();

    if (!ticketKey) {
      return NextResponse.json({ 
        error: 'Ticket key is required',
      }, { status: 400 });
    }

    // Get Jira cloud ID
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch Jira resources',
      }, { status: resourcesRes.status });
    }

    const resources = await resourcesRes.json();
    
    if (!resources || resources.length === 0) {
      return NextResponse.json({ 
        error: 'No Jira sites found',
      }, { status: 404 });
    }

    const cloudId = resources[0].id;

    // Update assignee
    const assignBody = accountId 
      ? { accountId } 
      : { accountId: null }; // null to unassign

    const assignRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${ticketKey}/assignee`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignBody),
      }
    );

    if (!assignRes.ok) {
      const errorText = await assignRes.text();
      return NextResponse.json({ 
        error: `Failed to assign ticket: ${errorText}`,
      }, { status: assignRes.status });
    }

    return NextResponse.json({
      success: true,
      message: accountId ? 'Ticket assigned successfully' : 'Ticket unassigned successfully',
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
