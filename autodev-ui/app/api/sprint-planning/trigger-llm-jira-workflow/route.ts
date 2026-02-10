import { NextResponse } from 'next/server';

export async function POST() {
  // Replace these values with your actual repo info
  const owner = process.env.GITHUB_REPO_OWNER || 'your-org';
  const repo = process.env.GITHUB_REPO_NAME || 'your-repo';
  const workflow_id = 'llm-jira-requirement-scheduled.yml';
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'Missing GitHub token' }, { status: 500 });
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }), // or your branch name
  });

  if (res.ok) {
    return NextResponse.json({ success: true });
  } else {
    let errorText = await res.text();
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorText);
    } catch {}
    return NextResponse.json({ error: errorJson || errorText }, { status: res.status });
  }
}
