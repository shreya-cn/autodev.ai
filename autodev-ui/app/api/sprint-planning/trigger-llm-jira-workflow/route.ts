import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const owner = process.env.GITHUB_REPO_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  const token = process.env.GITHUB_TOKEN;
  const workflowFileName = 'llm-jira-requirement-scheduled.yml'; // or your workflow file name

  if (!token) {
    return NextResponse.json({ error: 'Missing GitHub token' }, { status: 400 });
  }

  // Trigger the workflow_dispatch event
  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFileName}/dispatches`;
  const dispatchRes = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ ref: 'main' }), // or your default branch
  });

  if (!dispatchRes.ok) {
    const err = await dispatchRes.text();
    return NextResponse.json({ error: 'Could not trigger workflow', details: err }, { status: 500 });
  }

  // Wait a moment for the workflow run to be created, then fetch the latest run
  await new Promise(res => setTimeout(res, 3000));
  const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFileName}/runs?branch=main&event=workflow_dispatch&per_page=1`;
  const runsRes = await fetch(runsUrl, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!runsRes.ok) {
    const err = await runsRes.text();
    return NextResponse.json({ error: 'Could not fetch workflow runs', details: err }, { status: 500 });
  }

  const runsData = await runsRes.json();
  const run = runsData.workflow_runs && runsData.workflow_runs[0];
  if (!run) {
    return NextResponse.json({ error: 'No workflow run found after dispatch' }, { status: 500 });
  }

  return NextResponse.json({ runId: run.id });
}