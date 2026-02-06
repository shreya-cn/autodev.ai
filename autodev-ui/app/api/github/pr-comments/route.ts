import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    // If GitHub is not configured, return empty object
    if (!githubToken || !repoOwner || !repoName) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    // Fetch user's assigned tickets from Jira
    const jiraResponse = await fetch(`${process.env.JIRA_URL}/rest/api/3/search?jql=assignee=currentUser()`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!jiraResponse.ok) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    const jiraData = await jiraResponse.json();
    const userTicketKeys = new Set(jiraData.issues?.map((issue: any) => issue.key) || []);

    if (userTicketKeys.size === 0) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    const octokit = new Octokit({ auth: githubToken });

    // Fetch all open PRs
    const { data: pulls } = await octokit.pulls.list({
      owner: repoOwner,
      repo: repoName,
      state: 'open',
      per_page: 50,
    });

    const commentsByTicket: Record<string, any[]> = {};

    // Fetch comments for each PR and group by ticket
    for (const pr of pulls) {
      // Extract ticket key from PR title (e.g., "SCRUM-8: Feature title")
      const ticketMatch = pr.title.match(/^([A-Z]+-\d+)/);
      if (!ticketMatch) continue;

      const ticketKey = ticketMatch[1];
      
      // Only include PRs for user's assigned tickets
      if (!userTicketKeys.has(ticketKey)) continue;

      const { data: comments } = await octokit.issues.listComments({
        owner: repoOwner,
        repo: repoName,
        issue_number: pr.number,
      });

      // Filter for AutoRev bot comments or all comments
      const prComments = comments
        .filter(comment => 
          comment.body?.includes('**AutoRev Automated Review**') || 
          !comment.body?.startsWith('<!-- ')
        )
        .map(comment => ({
          id: comment.id.toString(),
          prNumber: pr.number,
          prTitle: pr.title,
          ticketKey: ticketKey,
          comment: comment.body || '',
          author: comment.user?.login || 'Unknown',
          createdAt: comment.created_at,
          url: comment.html_url,
        }));

      if (prComments.length > 0) {
        if (!commentsByTicket[ticketKey]) {
          commentsByTicket[ticketKey] = [];
        }
        commentsByTicket[ticketKey].push(...prComments);
      }
    }

    // Sort comments within each ticket by creation date (newest first)
    Object.keys(commentsByTicket).forEach(ticketKey => {
      commentsByTicket[ticketKey].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return NextResponse.json({ commentsByTicket });
  } catch (error) {
    return NextResponse.json({ commentsByTicket: {} });
  }
}
