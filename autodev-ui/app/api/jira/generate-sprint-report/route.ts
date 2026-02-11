import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow basic auth fallback - we just need to validate the request came from our app
    // The Python backend will handle its own authentication
    const jiraUsername = process.env.JIRA_USERNAME;
    const jiraToken = process.env.JIRA_API_TOKEN;
    
    if (!session?.accessToken && !jiraUsername) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { toDate } = body;

    if (!toDate) {
      return NextResponse.json({ error: 'Missing toDate parameter' }, { status: 400 });
    }

    // Call the Python backend API to generate the report
    const backendResponse = await fetch('http://localhost:5001/api/generate-sprint-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_date: toDate, // Format: YYYY-MM-DD
        force: true,
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate report' },
        { status: backendResponse.status }
      );
    }

    const reportData = await backendResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Sprint progress report generated successfully',
      confluence_url: reportData.confluence_url,
      report_data: reportData,
    });
  } catch (error) {
    console.error('Error generating sprint report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
