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

    const { ticketKey, transitionId } = await request.json();

    if (!ticketKey || !transitionId) {
      return NextResponse.json({ 
        error: 'Ticket key and transition ID are required',
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

    // Transition the issue
    const transitionRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${ticketKey}/transitions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transition: {
            id: transitionId
          }
        }),
      }
    );

    if (!transitionRes.ok) {
      const errorText = await transitionRes.text();
      return NextResponse.json({ 
        error: `Failed to transition ticket: ${errorText}`,
      }, { status: transitionRes.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket status updated successfully',
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

// Get available transitions for a ticket
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json({ 
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticketKey = searchParams.get('ticketKey');

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

    // Get available transitions
    const transitionsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${ticketKey}/transitions`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!transitionsRes.ok) {
      const errorText = await transitionsRes.text();
      return NextResponse.json({ 
        error: `Failed to get transitions: ${errorText}`,
      }, { status: transitionsRes.status });
    }

    const data = await transitionsRes.json();

    return NextResponse.json({
      transitions: data.transitions || [],
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
