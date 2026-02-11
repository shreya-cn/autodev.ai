import { NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import OpenAI from 'openai';

export async function GET() {
  console.log('--- 🚀 STARTING SYNC ---');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    if (!process.env.REPO_OWNER || !process.env.REPO_NAME) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // 🧠 AI summary function
    async function summarizeWithAI(text: string) {
      if (!text || text.length < 20) return text;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'Summarize the following GitHub PR comment in 2-3 concise lines. Preserve technical meaning. Do not add explanations.',
            },
            { role: 'user', content: text },
          ],
          max_tokens: 120,
          temperature: 0.3,
        });

        return response.choices[0].message.content?.trim() || text;
      } catch (err) {
        console.error('AI summary failed:', err);
        return text;
      }
    }

    // 1️⃣ Get Jira Cloud ID
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );

    const resources = await resourcesRes.json();
    if (!resources || resources.length === 0)
      throw new Error('No Jira resources found');

    const cloudId = resources[0].id;

    // 2️⃣ Fetch Assigned Tickets
    const userTicketsRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: `assignee = currentUser() AND status != Done`,
          fields: ['key', 'summary', 'status'],
        }),
      }
    );

    const userTicketsData = await userTicketsRes.json();
    const issues = userTicketsData.issues || [];
    const assignedKeys = issues.map((issue: any) => issue.key);

    if (assignedKeys.length === 0) {
      return NextResponse.json({ commentsByTicket: {} });
    }

    // 3️⃣ Search GitHub PRs
    const jiraQueryPart =
      assignedKeys.length > 1
        ? `(${assignedKeys.join(' OR ')})`
        : assignedKeys[0];

    const searchQuery = `repo:${process.env.REPO_OWNER}/${process.env.REPO_NAME} is:pr is:open ${jiraQueryPart}`;

    const { data: searchResults } =
      await octokit.search.issuesAndPullRequests({ q: searchQuery });

    const commentsByTicket: Record<string, any[]> = {};

    for (const pr of searchResults.items) {
      const matchedKeys = assignedKeys.filter((key) =>
        pr.title.toUpperCase().includes(key.toUpperCase())
      );

      if (matchedKeys.length === 0) continue;

      const { data: comments } = await octokit.issues.listComments({
        owner: process.env.REPO_OWNER!,
        repo: process.env.REPO_NAME!,
        issue_number: pr.number,
      });

      for (const comment of comments) {
        const originalText = comment.body || '';
        const summary = await summarizeWithAI(originalText);

        for (const key of matchedKeys) {
          if (!commentsByTicket[key]) {
            commentsByTicket[key] = [];
          }

          commentsByTicket[key].push({
            id: comment.id.toString(),
            prNumber: pr.number,
            prTitle: pr.title,
            ticketKey: key,
            comment: originalText,
            summary,
            author: comment.user?.login || 'Unknown',
            createdAt: comment.created_at,
            url: comment.html_url,
          });
        }
      }
    }

    return NextResponse.json({ commentsByTicket });
  } catch (error: any) {
    console.error('API ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
