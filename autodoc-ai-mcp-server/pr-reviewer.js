import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';
import path from 'path';

// --- Environment Variables ---
const REPO_OWNER = process.env.REPO_OWNER || 'shreya-cn';
const REPO_NAME = process.env.REPO_NAME || 'autodev.ai';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Path to your compiled MCP server (Updated to index.js based on your error logs)
const MCP_SERVER_PATH = './dist/index.js'; 

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}
 
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Orchestrates the MCP Server to generate a review via JSON-RPC
 */
async function generateMCPReview(changedFiles) {
  return new Promise((resolve) => {
    console.log('🤖 Orchestrating MCP Review via JSON-RPC...');
    
    // Check if server file exists before spawning
    if (!fs.existsSync(MCP_SERVER_PATH)) {
      resolve(`⚠️ MCP Error: Server file not found at ${MCP_SERVER_PATH}. Did you run npm build?`);
      return;
    }

    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let reviewResult = '';
    let isFinished = false;

    serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[MCP Debug]: ${message.trim()}`); // Helpful for CI logs

      // 1. Detect "Ready" signal. Adjust string if your server prints something else
      if (message.includes('tools registered') || message.includes('ready')) {
        const toolCall = JSON.stringify({
          jsonrpc: '2.0',
          id: 'pr-review-call',
          method: 'tools/call',
          params: {
            name: 'review_code_changes', 
            arguments: {
              files: changedFiles,
              projectPath: './'
            }
          }
        });
        serverProcess.stdin.write(toolCall + '\n');
      }

      // 2. Parse JSON-RPC response
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
      } catch (e) { /* Ignore non-JSON logs */ }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[MCP Server Error]: ${data.toString().trim()}`);
    });

    serverProcess.on('close', () => {
      resolve(reviewResult || '⚠️ MCP Review returned no suggestions.');
    });

    // 2-minute timeout
    setTimeout(() => {
      if (!isFinished) {
        serverProcess.kill();
        resolve('⚠️ MCP Review timed out.');
      }
    }, 120000);
  });
}

// --- Helper Functions ---

async function getChangedFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  // FIX: Strip the directory prefix so ESLint and the MCP server find the files locally
  return data.map(f => f.filename.replace(/^autodoc-ai-mcp-server\//, ''));
}

function runLint(files) {
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  if (jsFiles.length === 0) return 'No JS/TS files to lint.';
  try {
    // Files are now correctly pathed relative to current dir
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
    return 'Audit found vulnerabilities or failed.';
  }
}

function runTestCoverage() {
  try {
    return execSync('npm test -- --coverage', { encoding: 'utf-8' });
  } catch (e) {
    return e.stdout || 'Test coverage execution failed.';
  }
}

async function postPRCommentIfNew(prNumber, body) {
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
  });
  
  const botTag = '### 🤖 **AutoDoc Automated Review**';
  if (comments.some(c => c.body.includes(botTag))) {
    console.log('Bot comment already exists. Skipping...');
    return;
  }

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
}

// --- Main Execution ---

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node pr-reviewer.js <PR_NUMBER>');
    process.exit(1);
  }

  console.log(`🔎 Fetching changes for PR #${prNumber}...`);
  const files = await getChangedFiles(prNumber);
  
  console.log('🛠️ Running local checks (Lint, Build, Audit)...');
  const [lintResult, buildResult, auditResult, testCoverage, mcpReview] = await Promise.all([
    runLint(files),
    runBuildCheck(),
    runAudit(),
    runTestCoverage(),
    generateMCPReview(files)
  ]);

  let summary = 'All checks passed ✅';
  if (/fail|error|⚠️|vulnerabilities/i.test(lintResult + auditResult)) {
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

#### 💡 **MCP AI Review Suggestions**
${mcpReview}

---`;

  await postPRCommentIfNew(prNumber, commentBody);
  console.log('🎉 PR Review process completed.');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});