import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';
import { OpenAI } from 'openai';
import path from 'path';

// Environment Variables
const REPO_OWNER = process.env.REPO_OWNER || 'your-org';
const REPO_NAME = process.env.REPO_NAME || 'your-repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
// Path to your compiled MCP server
const MCP_SERVER_PATH = './dist/mcp-server.js'; 

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}
 
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * NEW: Orchestrates the MCP Server to generate a review
 */
async function generateMCPReview(changedFiles) {
  return new Promise((resolve) => {
    console.log('🤖 Orchestrating MCP Review via JSON-RPC...');
    
    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { 
        ...process.env, 
        EXIT_ON_TOOL_COMPLETE: 'true' 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let reviewResult = '';
    let isFinished = false;

    serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      
      // 1. Detect if tools are registered (the "Ready" signal)
      if (message.includes('tools registered')) {
        const toolCall = JSON.stringify({
          jsonrpc: '2.0',
          id: 'pr-review-call',
          method: 'tools/call',
          params: {
            name: 'review_code_changes', // Ensure this tool name matches your server.js
            arguments: {
              files: changedFiles,
              projectPath: process.env.MICROSERVICE_PATH || './'
            }
          }
        });
        serverProcess.stdin.write(toolCall + '\n');
      }

      // 2. Parse the result from the JSON-RPC response
      try {
        const lines = message.split('\n').filter(l => l.trim().startsWith('{'));
        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            reviewResult = json.result.content[0].text;
            isFinished = true;
            serverProcess.kill();
          }
        }
      } catch (e) { /* Non-JSON log line */ }
    });

    serverProcess.stderr.on('data', (data) => {
      const err = data.toString();
      if (err.includes('Error')) console.error(`[MCP Server]: ${err.trim()}`);
    });

    serverProcess.on('close', () => {
      resolve(reviewResult || '⚠️ MCP Review returned no suggestions.');
    });

    // Timeout safety
    setTimeout(() => {
      if (!isFinished) {
        serverProcess.kill();
        resolve('⚠️ MCP Review timed out.');
      }
    }, 120000);
  });
}

// --- Original Helper Functions ---

async function getChangedFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  return data.map(f => f.filename);
}

function runLint(files) {
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  if (jsFiles.length === 0) return 'No JS/TS files to lint.';
  try {
    return execSync(`npx eslint ${jsFiles.join(' ')}`, { encoding: 'utf-8' });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function runBuildCheck() {
  try {
    execSync('npm run build', { encoding: 'utf-8' });
    return 'Build succeeded.';
  } catch (e) {
    return e.stdout || e.message;
  }
}

function runAudit() {
  try {
    const result = execSync('npm audit --json', { encoding: 'utf-8' });
    const audit = JSON.parse(result);
    const total = Object.keys(audit.vulnerabilities || {}).length;
    return total === 0 ? 'No known vulnerabilities 🚦' : `Vulnerabilities found: ${total} ⚠️`;
  } catch (e) {
    return 'Audit failed or vulnerabilities detected.';
  }
}

function runTestCoverage() {
  try {
    return execSync('npm test -- --coverage', { encoding: 'utf-8' });
  } catch (e) {
    return e.stdout || 'Test coverage failed.';
  }
}

async function postPRCommentIfNew(prNumber, body) {
  // Logic to prevent duplicate comments
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
  });
  
  const alreadyPosted = comments.some(c => c.body.includes('### 🤖 **AutoDoc Automated Review**'));
  if (alreadyPosted) {
    console.log('Comment already exists.');
    return;
  }

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
}

// --- Main Logic ---

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node pr-reviewer.js <PR_NUMBER>');
    process.exit(1);
  }

  const files = await getChangedFiles(prNumber);
  
  // Parallel execution for speed
  const [lintResult, buildResult, auditResult, testCoverage, mcpReview] = await Promise.all([
    runLint(files),
    runBuildCheck(),
    runAudit(),
    runTestCoverage(),
    generateMCPReview(files) // Now using the orchestrated tool call
  ]);

  let summary = 'All checks passed ✅';
  if (/fail|error|⚠️|vulnerabilities/i.test(lintResult + buildResult + auditResult)) {
    summary = 'Some issues found ⚠️';
  }

  const commentBody = `### 🤖 **AutoDoc Automated Review**

**${summary}**

---

#### 🧹 **Lint Results**
\`\`\`
${lintResult}
\`\`\`

#### 🏗️ **Build Results**
\`\`\`
${buildResult}
\`\`\`

#### 🧪 **Test Coverage**
\`\`\`
${testCoverage}
\`\`\`

#### 🛡️ **Vulnerability Check**
${auditResult}

#### 💡 **MCP Orchestrated Suggestions**
${mcpReview}

---`;

  await postPRCommentIfNew(prNumber, commentBody);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});