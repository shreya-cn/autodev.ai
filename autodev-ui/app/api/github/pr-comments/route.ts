import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  console.log('--- 🚀 STARTING SYNC ---');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check for required environment variables
    if (!process.env.GITHUB_TOKEN) {
      console.error('❌ GITHUB_TOKEN not configured');
      return NextResponse.json({ commentsByTicket: {}, error: 'GitHub integration not configured' }, { status: 200 });
    }
    if (!process.env.REPO_OWNER || !process.env.REPO_NAME) {
      console.error('❌ REPO_OWNER or REPO_NAME not configured');
      return NextResponse.json({ commentsByTicket: {}, error: 'Repository not configured' }, { status: 200 });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // 1. Get Jira Identity
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { 'Authorization': `Bearer ${session.accessToken}` },
    });
    const resources = await resourcesRes.json();
    if (!resources || resources.length === 0) throw new Error("No Jira resources found");
    const cloudId = resources[0].id;

    // 2. Fetch Assigned Tickets
    const userTicketsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Broadened search: all assigned items that aren't closed
          jql: `assignee = currentUser() AND status != Done`,
          fields: ['key', 'summary', 'status'],
        })
      }
    );

    const userTicketsData = await userTicketsRes.json();
    const issues = userTicketsData.issues || [];

    console.log('==========================================');
    console.log('🔍 JIRA TICKETS FOUND');
    issues.forEach((issue: any) => {
      console.log(`- ${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`);
    });
    console.log('==========================================');

    const assignedKeys = issues.map((issue: any) => issue.key);

    if (assignedKeys.length === 0) {
      console.log('🛑 No assigned tickets. Ending.');
      return NextResponse.json({ commentsByTicket: {} });
    }

    // 3. GitHub Search - FIXED for multiple tickets
    // We use (KEY-1 OR KEY-2) syntax so it finds PRs matching ANY of your tickets
    const jiraQueryPart = assignedKeys.length > 1 
      ? `(${assignedKeys.join(' OR ')})` 
      : assignedKeys[0];

    const searchQuery = `repo:${process.env.REPO_OWNER}/${process.env.REPO_NAME} is:pr is:open ${jiraQueryPart}`;
    console.log(`📡 GITHUB SEARCH: ${searchQuery}`);

    const { data: searchResults } = await octokit.search.issuesAndPullRequests({ q: searchQuery });
    console.log(`✅ MATCHING PRS FOUND: ${searchResults.items.length}`);

    const commentsByTicket: Record<string, any[]> = {};

    for (const pr of searchResults.items) {
      // Find which key(s) belong to this PR title
      const matchedKeys = assignedKeys.filter(key => 
        pr.title.toUpperCase().includes(key.toUpperCase())
      );

      if (matchedKeys.length === 0) continue;

      // Fetch comments for the matched PR
      const { data: comments } = await octokit.issues.listComments({
        owner: process.env.REPO_OWNER!,
        repo: process.env.REPO_NAME!,
        issue_number: pr.number,
      });

      const filtered = comments
        .filter(c => {
          const body = c.body || '';
          // Flexible bot detection
          return body.includes('AutoRev') || body.includes('🤖') || c.user?.login.includes('github-actions');
        })
        .map(c => ({
          id: c.id.toString(),
          prNumber: pr.number,
          prTitle: pr.title,
          comment: c.body,
          author: c.user?.login,
          createdAt: c.created_at,
          url: c.html_url
        }));

      if (filtered.length > 0) {
        // Map the comments to every Jira key found in the PR title
        matchedKeys.forEach(key => {
          commentsByTicket[key] = filtered;
        });
      }
    }

    console.log(`📦 RETURNING DATA FOR: ${Object.keys(commentsByTicket).join(', ')}`);
    return NextResponse.json({ commentsByTicket });

  } catch (error: any) {
    console.error('❌ API ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}