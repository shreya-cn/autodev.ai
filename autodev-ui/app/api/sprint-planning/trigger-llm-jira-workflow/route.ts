import { NextResponse } from 'next/server';

export async function POST() {
  const owner = process.env.GITHUB_REPO_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  const workflow_id = 'llm-jira-requirement-scheduled.yml';
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'Missing GitHub token' }, { status: 500 });
  }

  // 1. Trigger the workflow
  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`;
  const dispatchRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });

  if (!dispatchRes.ok) {
    let errorText = await dispatchRes.text();
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorText);
    } catch {}
    return NextResponse.json({ error: errorJson || errorText }, { status: dispatchRes.status });
  }

  // 2. Wait briefly for the workflow run to be created
  await new Promise((res) => setTimeout(res, 3000)); // 3 seconds

  // 3. Fetch the latest workflow run for this workflow
  const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs?branch=main&per_page=1`;
  const runsRes = await fetch(runsUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!runsRes.ok) {
    return NextResponse.json({ error: 'Workflow triggered but could not fetch runId.' }, { status: 500 });
  }

  const runsData = await runsRes.json();
  const runId = runsData.workflow_runs && runsData.workflow_runs.length > 0 ? runsData.workflow_runs[0].id : null;

  if (!runId) {
    return NextResponse.json({ error: 'Workflow triggered but no runId found.' }, { status: 500 });
  }

  return NextResponse.json({ runId });
}