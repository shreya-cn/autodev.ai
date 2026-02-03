#!/usr/bin/env node

require('dotenv').config({ path: '.env' });

const JIRA_URL = process.env.JIRA_URL;
const JIRA_USER = process.env.CONFLUENCE_USER || process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || process.env.JIRA_API_TOKEN;

const auth = Buffer.from(`${JIRA_USER}:${JIRA_API_TOKEN}`).toString('base64');

const sprintTickets = [
  {
    summary: 'Implement OAuth authentication for Atlassian integration',
    description: 'Add OAuth 2.0 authentication to enable users to connect their Atlassian accounts securely. This will allow access to Jira and Confluence APIs.',
    type: 'Story',
    priority: 'High',
  },
  {
    summary: 'Fix user session timeout issues',
    description: 'Users are experiencing unexpected logouts. Need to implement proper session refresh mechanism and handle token expiration gracefully.',
    type: 'Bug',
    priority: 'Highest',
  },
  {
    summary: 'Create API endpoint for backlog tickets',
    description: 'Develop REST API endpoint to fetch tickets that are not assigned to any sprint. Should support filtering and pagination.',
    type: 'Task',
    priority: 'High',
  },
  {
    summary: 'Update UI theme to Positivus design',
    description: 'Apply the Positivus color scheme with lime green (#B9FF66) primary color and dark backgrounds to match the design specifications.',
    type: 'Story',
    priority: 'Medium',
  },
  {
    summary: 'Add refresh token handling in OAuth flow',
    description: 'Implement automatic token refresh when access token expires to maintain seamless user experience without requiring re-authentication.',
    type: 'Task',
    priority: 'High',
  },
];

const backlogTickets = [
  {
    summary: 'Implement real-time ticket updates using WebSocket',
    description: 'Add WebSocket connection to receive real-time updates when Jira tickets change status or are updated by other users.',
    type: 'Story',
    priority: 'Medium',
  },
  {
    summary: 'Add dark mode toggle to user preferences',
    description: 'Allow users to switch between light and dark themes. Preference should be saved in localStorage and persist across sessions.',
    type: 'Story',
    priority: 'Low',
  },
  {
    summary: 'Create comprehensive API documentation',
    description: 'Document all API endpoints, request/response formats, and authentication methods. Use Swagger/OpenAPI specification.',
    type: 'Task',
    priority: 'Medium',
  },
  {
    summary: 'Optimize Jira API response caching',
    description: 'Implement caching strategy for Jira API responses to reduce API calls and improve application performance.',
    type: 'Improvement',
    priority: 'Low',
  },
  {
    summary: 'Add ticket filtering by assignee and status',
    description: 'Enable users to filter tickets in the board view by assignee, status, priority, and other custom fields.',
    type: 'Story',
    priority: 'Medium',
  },
  {
    summary: 'Fix OAuth callback URL configuration',
    description: 'OAuth callback is failing with 403 error. Need to verify callback URL matches exactly with OAuth app configuration in Atlassian.',
    type: 'Bug',
    priority: 'Medium',
  },
];

async function createTicket(ticketData, inSprint = false) {
  try {
    const issuePayload = {
      fields: {
        project: {
          key: 'SCRUM'
        },
        summary: ticketData.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: ticketData.description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: ticketData.type
        },
        priority: {
          name: ticketData.priority
        }
      }
    };

    const response = await fetch(`${JIRA_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issuePayload)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to create ticket: ${ticketData.summary}`);
      console.error('Error:', error);
      return null;
    }

    const issue = await response.json();
    console.log(`✅ Created: ${issue.key} - ${ticketData.summary}`);
    
    // If this should be in a sprint, we'd need to add it to a sprint here
    // For now, tickets without sprint assignment will automatically be in backlog
    
    return issue;
  } catch (error) {
    console.error(`Error creating ticket: ${ticketData.summary}`, error.message);
    return null;
  }
}

async function getActiveSprint() {
  try {
    // First, get the board ID
    const boardsResponse = await fetch(`${JIRA_URL}/rest/agile/1.0/board?projectKeyOrId=SCRUM`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    if (!boardsResponse.ok) {
      console.error('Failed to fetch boards');
      return null;
    }

    const boardsData = await boardsResponse.json();
    if (!boardsData.values || boardsData.values.length === 0) {
      console.error('No boards found');
      return null;
    }

    const boardId = boardsData.values[0].id;

    // Get active sprint for this board
    const sprintsResponse = await fetch(`${JIRA_URL}/rest/agile/1.0/board/${boardId}/sprint?state=active`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      }
    });

    if (!sprintsResponse.ok) {
      console.error('Failed to fetch sprints');
      return null;
    }

    const sprintsData = await sprintsResponse.json();
    if (!sprintsData.values || sprintsData.values.length === 0) {
      console.log('No active sprint found');
      return null;
    }

    return sprintsData.values[0];
  } catch (error) {
    console.error('Error getting active sprint:', error.message);
    return null;
  }
}

async function addTicketToSprint(issueKey, sprintId) {
  try {
    const response = await fetch(`${JIRA_URL}/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        issues: [issueKey]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to add ${issueKey} to sprint:`, error);
      return false;
    }

    console.log(`  ➡️  Added ${issueKey} to sprint`);
    return true;
  } catch (error) {
    console.error(`Error adding ticket to sprint:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Creating Jira tickets...\n');

  // Get active sprint
  const activeSprint = await getActiveSprint();
  if (activeSprint) {
    console.log(`📌 Active Sprint: ${activeSprint.name} (ID: ${activeSprint.id})\n`);
  } else {
    console.log('⚠️  No active sprint found. All tickets will be in backlog.\n');
  }

  // Create sprint tickets
  console.log('📝 Creating Current Sprint tickets...');
  const createdSprintTickets = [];
  for (const ticket of sprintTickets) {
    const issue = await createTicket(ticket, true);
    if (issue && activeSprint) {
      createdSprintTickets.push(issue.key);
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }

  // Add tickets to active sprint
  if (activeSprint && createdSprintTickets.length > 0) {
    console.log('\n🔗 Adding tickets to active sprint...');
    for (const issueKey of createdSprintTickets) {
      await addTicketToSprint(issueKey, activeSprint.id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Create backlog tickets
  console.log('\n📋 Creating Backlog tickets...');
  for (const ticket of backlogTickets) {
    await createTicket(ticket, false);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Done! Tickets created successfully.');
  console.log('\n💡 Refresh your AutoDev.ai dashboard to see the new tickets!');
}

main().catch(console.error);
