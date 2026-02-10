import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';

// --- Environment Variables ---
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Determine MCP server entrypoint
const MCP_SERVER_PATH = fs.existsSync('./dist/index.js')
  ? './dist/index.js'
  : './dist/mcp-server.js';

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('❌ Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Orchestrate MCP review via JSON-RPC
 */
async function generateMCPReview() {
  return new Promise((resolve) => {
    console.log('🤖 Orchestrating MCP Review via JSON-RPC...');

    if (!fs.existsSync(MCP_SERVER_PATH)) {
      resolve(`⚠️ MCP server not found at ${MCP_SERVER_PATH}`);
      return;
    }

    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let reviewResult = '';
    let toolSent = false;
    let finished = false;

    serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`[MCP Log]: ${message.trim()}`);

      // 🔐 Send tool call ONCE when tools are registered
      if (!toolSent && message.includes('tools registered')) {
        toolSent = true;

        const toolCall = JSON.stringify({
          jsonrpc: '2.0',
          id: 'pr-review-call',
          method: 'tools/call',
          params: {
            name: 'full_pipeline',
            arguments: {
              projectPath: './',
            },
          },
        });

        serverProcess.stdin.write(toolCall + '\n');
      }

      // Parse JSON-RPC response
      try {
        const lines = message
          .split('\n')
          .filter((l) => l.trim().startsWith('{'));

        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            reviewResult = json.result.content?.[0]?.text || '';
            finished = true;
            serverProcess.kill();
          }
        }
      } catch {
        // ignore partial logs
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[MCP Error]: ${data.toString().trim()}`);
    });

    serverProcess.on('close', () => {
      resolve(reviewResult || '⚠️ MCP review returned no suggestions.');
    });

    setTimeout(() => {
      if (!finished) {
        serverProcess.kill();
        resolve('⚠️ MCP review timed out.');
      }
    }, 120_000);
  });
}

// --- Helper checks ---

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
    return 'Build succeeded ✅';
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
  } catch {
    return 'Vulnerabilities detected ⚠️';
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

  const [lint, build, audit, mcp] = await Promise.all([
    runLint(),
    runBuildCheck(),
    runAudit(),
    generateMCPReview(),
  ]);

  const summary = /fail|error|⚠️|vulnerabilities/i.test(lint + audit)
    ? 'Some issues found ⚠️'
    : 'All checks passed ✅';

  const body = `### 🤖 **AutoDoc Automated Review**

**${summary}**

---
#### 🧹 Lint Results
\`\`\`
${lint}
\`\`\`

#### 🏗️ Build Results
\`\`\`
${build}
\`\`\`

#### 🛡️ Vulnerability Check
${audit}

#### 💡 MCP AI Review Suggestions
${mcp}
---
`;

  await postPRCommentIfNew(prNumber, body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
