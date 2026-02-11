import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket_id, update_jira } = body;

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      );
    }

    // Call Python backend
    const response = await fetch('http://localhost:5001/api/analyze-jira-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket_id,
        update_jira: update_jira !== undefined ? update_jira : true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to analyze JIRA ticket' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('JIRA ticket analysis error:', error);
    return NextResponse.json(
      {
        error: `Failed to analyze JIRA ticket: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
