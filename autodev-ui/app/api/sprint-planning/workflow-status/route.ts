import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');
  const owner = process.env.GITHUB_REPO_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  const token = process.env.GITHUB_TOKEN;

  if (!runId || !token) {
    return NextResponse.json({ error: 'Missing runId or GitHub token' }, { status: 400 });
  }

  // Get workflow run status from GitHub API
  const runUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
  const runRes = await fetch(runUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!runRes.ok) {
    const err = await runRes.text();
    return NextResponse.json({ error: 'Could not fetch workflow run', details: err }, { status: 500 });
  }

  const runData = await runRes.json();
  // status: "completed" | "in_progress" | "queued"
  // conclusion: "success" | "failure" | "cancelled" | null
  return NextResponse.json({ status: runData.status, conclusion: runData.conclusion });
}