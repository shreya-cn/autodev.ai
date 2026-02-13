export const runtime = "nodejs";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const JIRA_BASE = process.env.JIRA_URL!;
const JIRA_EMAIL = process.env.JIRA_USER!;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN!;
const JIRA_PROJECT = process.env.JIRA_PROJECT || 'SCRUM';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* =========================
   JIRA HELPERS
========================= */

async function fetchDoneIssueKeys(limit = 50) {
  const jql = `
    project = ${JIRA_PROJECT}
    AND status = "Done"
    ORDER BY resolved DESC
  `;

  const res = await fetch(`${JIRA_BASE}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64"),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      maxResults: limit,
      fields: ["summary", "description", "issuetype", "assignee"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("========== JIRA ERROR ==========");
    console.error("Status:", res.status);
    console.error("Response:", text);
    console.error("================================");
    throw new Error(`Jira fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return data.issues.map((issue: any) => issue.key);
}

async function fetchIssue(issueKey: string) {
  const res = await fetch(
    `${JIRA_BASE}/rest/api/3/issue/${issueKey}?expand=changelog`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64"),
        Accept: "application/json",
      },
    },
  );

  return res.json();
}

function extractAssignees(issue: any) {
  const assignees = new Set<string>();

  const current = issue.fields?.assignee;
  if (current) assignees.add(current.displayName);

  for (const history of issue.changelog?.histories || []) {
    for (const item of history.items) {
      if (item.field === "assignee" && item.toString) {
        assignees.add(item.toString);
      }
    }
  }

  return assignees;
}

async function buildProfiles(issueKeys: string[]) {
  const profiles: Record<string, any> = {};

  for (const key of issueKeys) {
    const issue = await fetchIssue(key);

    const summary = issue.fields.summary;
    const description = issue.fields.description || "";
    const issueType = issue.fields.issuetype.name;

    const context = `${summary} ${description}`.toLowerCase();
    const assignees = extractAssignees(issue);

    for (const name of assignees) {
      if (!profiles[name]) {
        profiles[name] = {
          issues_worked: 0,
          issue_types: new Set<string>(),
          context: [],
        };
      }

      profiles[name].issues_worked++;
      profiles[name].issue_types.add(issueType);
      profiles[name].context.push(context);
    }
  }

  // convert Set → Array
  for (const name in profiles) {
    profiles[name].issue_types = Array.from(profiles[name].issue_types);
  }

  return profiles;
}

/* =========================
   AI RANKING
========================= */

async function suggestAssignee(newIssue: any, profiles: any) {
  const prompt = `
You are a Jira expert.

Suggest the best assignees for the issue based on their experience.
Return a JSON object with the top recommended assignee and a detailed explanation.

Issue Details:
Summary: ${newIssue.summary}
Description: ${newIssue.description}
Issue Type: ${newIssue.issueType}

Assignee Profiles:
${JSON.stringify(profiles, null, 2)}

Return JSON in this exact format:
{
  "topAssignee": "Name of best match",
  "matchLevel": "High" or "Medium" or "Low",
  "reason": "Brief explanation of why this person is the best match",
  "alternatives": [
    {"name": "Alternative 1", "matchLevel": "High/Medium/Low", "reason": "Brief reason"},
    {"name": "Alternative 2", "matchLevel": "High/Medium/Low", "reason": "Brief reason"}
  ]
}

If no good match exists, set topAssignee to "Unassigned" with matchLevel "Low".
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return result;
}

/* =========================
   API ROUTE
========================= */

export async function POST(req: Request) {
  try {
    // Validate environment variables
    if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN || !OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: "Missing environment variables. Please configure JIRA_URL, JIRA_USER, JIRA_API_TOKEN, and OPENAI_API_KEY in your .env.local file.",
          recommendedAssignee: "Unassigned",
          matchLevel: "Low",
          reason: "Unable to suggest assignee - environment not configured",
          alternatives: []
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const doneIssueKeys = await fetchDoneIssueKeys();
    const profiles = await buildProfiles(doneIssueKeys);

    const result = await suggestAssignee(body, profiles);

    // Return structured response
    return NextResponse.json({
      recommendedAssignee: result.topAssignee || "Unassigned",
      matchLevel: result.matchLevel || "Low",
      reason: result.reason || "No specific match found",
      alternatives: result.alternatives || []
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
