import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to fetch analyzed tickets from the backend
 * This proxies requests to the Python Flask API running on port 5001
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API Route] GET /api/analyzed-tickets called');
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    
    console.log(`[API Route] Fetching from backend: ${backendUrl}/api/analyzed-tickets`);
    
    const response = await fetch(`${backendUrl}/api/analyzed-tickets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log(`[API Route] Backend response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[API Route] Backend error: ${response.status} ${response.statusText}`);
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[API Route] Error body: ${errorText.substring(0, 200)}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText.substring(0, 500) },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API Route] Successfully got ${data.total} tickets from backend`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Route] Caught exception:', error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to backend API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
