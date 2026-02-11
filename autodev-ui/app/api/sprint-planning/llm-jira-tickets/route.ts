import { NextRequest, NextResponse } from 'next/server';

// Helper to extract tickets from workflow logs
function extractTicketsFromLogs(logs: string): string[] {
  const start = logs.indexOf('CREATED_TICKETS_JSON_START');
  const end = logs.indexOf('CREATED_TICKETS_JSON_END');
  if (start === -1 || end === -1 || end <= start) return [];
  const jsonBlock = logs.substring(start + 26, end).trim();
  try {
    // The JSON is a dict of pageId -> [ticketKeys]
    const parsed = JSON.parse(jsonBlock);
    // Flatten all ticket arrays
    return ([] as string[]).concat(...(Object.values(parsed) as string[][]));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  const owner = process.env.GITHUB_REPO_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  const token = process.env.GITHUB_TOKEN;

  if (!runId || !token) {
    return NextResponse.json({ error: 'Missing runId or GitHub token' }, { status: 400 });
  }

  // 1. Get workflow run jobs
  const jobsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`;
  const jobsRes = await fetch(jobsUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (!jobsRes.ok) {
    const err = await jobsRes.text();
    return NextResponse.json({ error: 'Could not fetch workflow jobs', details: err }, { status: 500 });
  }
  const jobsData = await jobsRes.json();
  const job = jobsData.jobs && jobsData.jobs[0];
  if (!job) {
    return NextResponse.json({ error: 'No jobs found for workflow run' }, { status: 404 });
  }

  // 2. Get logs for the job
  const logsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`;
  const logsRes = await fetch(logsUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (!logsRes.ok) {
    const err = await logsRes.text();
    return NextResponse.json({ error: 'Could not fetch job logs', details: err }, { status: 500 });
  }
  const logs = await logsRes.text();
  const tickets = extractTicketsFromLogs(logs);
  return NextResponse.json({ tickets });
}