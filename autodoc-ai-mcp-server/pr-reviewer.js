import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';

// --- Environment Variables ---
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check which entry point exists after build
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
      resolve(`⚠️ MCP Error: Server not found at ${MCP_SERVER_PATH}. Ensure "npm run build" succeeded.`);
      return;
    }

    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let reviewResult = '';
    let isFinished = false;

    serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[MCP Log]: ${message.trim()}`);

      if (
        message.includes('tools registered') ||
        message.includes('ready') ||
        message.includes('Server')
      ) {
        const toolCall = JSON.stringify({
          jsonrpc: '2.0',
          id: 'pr-review-call',
          method: 'tools/call',
          params: {
            name: 'review_code_changes',
            arguments: {
              files: changedFiles,
              projectPath: './',
            },
          },
        });
        serverProcess.stdin.write(toolCall + '\n');
      }

      try {
        const lines = message.split('\n').filter((l) => l.trim().startsWith('{'));
        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            reviewResult = json.result.content[0].text;
            isFinished = true;
            serverProcess.kill();
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const err = data.toString().trim();
      if (err) console.error(`[MCP Error]: ${err}`);
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

  // Strip subdirectory prefix since workflow already cd's into it
  return data.map((f) =>
    f.filename.startsWith('autodoc-ai-mcp-server/')
      ? f.filename.replace('autodoc-ai-mcp-server/', '')
      : f.filename
  );
}

// ✅ FIXED: lint the workspace, not individual PR files
function runLint() {
  try {
    return execSync('npx eslint .', { encoding: 'utf-8' });
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
    return total === 0
      ? 'No known vulnerabilities 🚦'
      : `Vulnerabilities found: ${total} ⚠️`;
  } catch (e) {
    return e.stdout ? 'Vulnerabilities detected ⚠️' : 'Audit failed to run.';
  }
}

async function postPRCommentIfNew(prNumber, body) {
  const { data: comments } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
  });

  const botTag = '### 🤖 **AutoDoc Automated Review**';
  if (comments.some((c) => c.body.includes(botTag))) return;

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
}

// --- Main ---

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) process.exit(1);

  const files = await getChangedFiles(prNumber);

  const [lint, build, audit, mcp] = await Promise.all([
    runLint(),
    runBuildCheck(),
    runAudit(),
    generateMCPReview(files),
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
#### 🛡️ **Vulnerability Check**
${audit}
#### 💡 **MCP AI Review Suggestions**
${mcp}
---`;

  await postPRCommentIfNew(prNumber, body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
