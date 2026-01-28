require('dotenv').config();
const https = require('https');

const JIRA_URL = process.env.JIRA_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'SA';

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

const testTickets = [
  {
    summary: "Add email validation to user-details form",
    description: "Implement email validation in the user-details table form. Should validate email format and check for duplicates in the database.",
    issueType: "Task"
  },
  {
    summary: "Create user-details table pagination",
    description: "Add pagination functionality to the user-details table. Display 20 records per page with next/previous controls.",
    issueType: "Task"
  },
  {
    summary: "Fix user-details table sorting bug",
    description: "The user-details table sorting is broken. Clicking on column headers doesn't sort the data properly. Need to fix the sort logic.",
    issueType: "Bug"
  },
  {
    summary: "Add export functionality to user-details",
    description: "Users should be able to export user-details table data to CSV and Excel formats. Include all visible columns.",
    issueType: "Story"
  },
  {
    summary: "Implement search in user-details table",
    description: "Add search functionality to filter user-details table by name, email, and other fields. Should support partial matches.",
    issueType: "Task"
  },
  {
    summary: "Create login page with authentication",
    description: "Build a login page with username and password fields. Implement JWT-based authentication and session management.",
    issueType: "Story"
  },
  {
    summary: "Add forgot password feature",
    description: "Create a forgot password flow that sends password reset emails to users. Should generate secure reset tokens.",
    issueType: "Task"
  },
  {
    summary: "Implement OAuth integration",
    description: "Add OAuth 2.0 support for Google and Microsoft login. Users should be able to sign in with their corporate accounts.",
    issueType: "Story"
  },
  {
    summary: "Add two-factor authentication",
    description: "Implement 2FA using TOTP (Time-based One-Time Password). Users can enable 2FA in their profile settings.",
    issueType: "Task"
  },
  {
    summary: "Create dashboard with analytics",
    description: "Build a main dashboard showing key metrics: active users, login statistics, and system health indicators.",
    issueType: "Story"
  }
];

async function createTicket(ticket) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      fields: {
        project: {
          key: PROJECT_KEY
        },
        summary: ticket.summary,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: ticket.description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: ticket.issueType
        }
      }
    });

    const options = {
      hostname: new URL(JIRA_URL).hostname,
      port: 443,
      path: '/rest/api/3/issue',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(responseBody);
            console.log(`✅ Created ${result.key}: ${ticket.summary}`);
            resolve(result.key);
          } catch (error) {
            console.error(`Failed to parse response for "${ticket.summary}"`);
            resolve(null);
          }
        } else {
          console.error(`Failed to create ticket "${ticket.summary}": ${res.statusCode} - ${responseBody}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error creating ticket "${ticket.summary}":`, error.message);
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

async function createAllTickets() {
  console.log('Creating test tickets in Jira...\n');
  
  for (const ticket of testTickets) {
    await createTicket(ticket);
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ All tickets created! They are unassigned and in the backlog.');
  console.log('You can now assign some to yourself and test the suggestion feature.');
}

createAllTickets();
