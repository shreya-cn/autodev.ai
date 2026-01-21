require('dotenv').config();
const https = require('https');

const JIRA_URL = process.env.JIRA_URL || 'https://autodev-ai.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'SA';

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

// First get the account ID
async function getAccountId() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'autodev-ai.atlassian.net',
      port: 443,
      path: '/rest/api/3/myself',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
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
            console.log(`✅ Found account ID: ${result.accountId} (${result.displayName})`);
            resolve(result.accountId);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Failed to get account ID: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Assign ticket to user
async function assignTicket(ticketKey, accountId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      accountId: accountId
    });

    const options = {
      hostname: 'autodev-ai.atlassian.net',
      port: 443,
      path: `/rest/api/3/issue/${ticketKey}/assignee`,
      method: 'PUT',
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
          console.log(`✅ Assigned ${ticketKey} to you`);
          resolve(true);
        } else {
          console.error(`Failed to assign ${ticketKey}: ${res.statusCode} - ${responseBody}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error assigning ${ticketKey}:`, error.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function assignTickets() {
  console.log('Assigning tickets...\n');
  
  try {
    const accountId = await getAccountId();
    
    // Assign SA-6 (user-details email validation) and SA-8 (user-details table sorting)
    // Both relate to user-details table, so other user-details tickets should show up
    // This will test the duplicate flag feature
    const ticketsToAssign = ['SA-6', 'SA-8'];
    
    for (const ticket of ticketsToAssign) {
      await assignTicket(ticket, accountId);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✨ Done!');
    console.log('Assigned tickets:');
    console.log('  - Task-3: Add user email column in user-details table');
    console.log('  - SA-8: Fix user-details table sorting bug');
    console.log('\nBoth are related to user-details table, so you should see:');
    console.log('  - SA-6: Email validation (relevant to both)');
    console.log('  - SA-7: Pagination (relevant to both)');
    console.log('  - SA-9: Export functionality (relevant to both)');
    console.log('  - SA-10: Search functionality (relevant to both)');
    console.log('\nTickets appearing for both Task-3 and SA-8 will show the orange flag! 🚩');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

assignTickets();
