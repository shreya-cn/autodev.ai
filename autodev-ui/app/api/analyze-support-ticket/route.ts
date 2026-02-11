import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, description, error_log, ticket_id } = body;

    if (!summary) {
      return NextResponse.json(
        { error: 'Ticket summary is required' },
        { status: 400 }
      );
    }

    // Call Python backend
    const response = await fetch('http://localhost:5001/api/analyze-support-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description: description || '',
        error_log: error_log || '',
        ticket_id: ticket_id || `SUPPORT-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to analyze ticket' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Support ticket analysis error:', error);
    return NextResponse.json(
      {
        error: `Failed to analyze ticket: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}
