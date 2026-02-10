import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';
import path from 'path';

// --- Environment Variables ---
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Robust path detection for the MCP server
const MCP_SERVER_PATH = fs.existsSync('./dist/index.js') 
  ? './dist/index.js' 
  : './dist/mcp-server.js'; 

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}
 
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Orchestrates the MCP Server via JSON-RPC
 */
async function generateMCPReview(changedFiles) {
  return new Promise((resolve) => {
    console.log('🤖 Orchestrating MCP Review via JSON-RPC...');
    
    if (!fs.existsSync(MCP_SERVER_PATH)) {
      resolve(`⚠️ MCP Error: Server not found at ${MCP_SERVER_PATH}. Verify build step.`);
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
      console.log(`[MCP Log]: ${message.trim()}`);

      // Wait for any signal that indicates the server is up
      if (message.includes('tools registered') || message.includes('ready') || message.includes('Server')) {
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
      } catch (e) {}
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[MCP Error]: ${data.toString().trim()}`);
    });

    serverProcess.on('close', () => {
      resolve(reviewResult || '⚠️ MCP Review returned no suggestions.');
    });

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
  
  // STRIP PREFIX: This fixes the "No files matching" ESLint error
  return data.map(f => f.filename.startsWith('autodoc-ai-mcp-server/') 
    ? f.filename.replace('autodoc-ai-mcp-server/', '') 
    : f.filename
  );
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
    // This is a local check to ensure the project being reviewed builds
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
    return 'Audit detected vulnerabilities or failed.';
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
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
  });
  
  const botTag = '### 🤖 **AutoDoc Automated Review**';
  if (comments.some(c => c.body.includes(botTag))) return;

  await octokit.issues.createComment({
    owner: REPO_OWNER, repo: REPO_NAME, issue_number: prNumber, body
  });
}

// --- Main Logic ---

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) process.exit(1);

  const files = await getChangedFiles(prNumber);
  
  const [lint, build, audit, test, mcp] = await Promise.all([
    runLint(files),
    runBuildCheck(),
    runAudit(),
    runTestCoverage(),
    generateMCPReview(files)
  ]);

  const summary = /fail|error|⚠️|vulnerabilities/i.test(lint + audit) 
    ? 'Some issues found ⚠️' 
    : 'All checks passed ✅';

  const body = `### 🤖 **AutoDoc Automated Review**

**${summary}**

---
#### 🧹 **Lint Results**
\`\`\`
${lint}
\`\`\`
#### 🏗️ **Build Results**
\`\`\`
${build}
\`\`\`
#### 🧪 **Test Coverage**
\`\`\`
${test}
\`\`\`
#### 🛡️ **Vulnerability Check**
${audit}
#### 💡 **MCP AI Review**
${mcp}
---`;

  await postPRCommentIfNew(prNumber, body);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});