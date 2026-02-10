import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { Octokit } from '@octokit/rest';

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('❌ Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}

// Determine MCP server entrypoint
const MCP_SERVER_PATH = fs.existsSync('./dist/index.js')
  ? './dist/index.js'
  : './dist/mcp-server.js';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function getPRDiff(prNumber) {
  const { data } = await octokit.pulls.get({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  return data;
}

async function getPRFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  return data.map(f => f.filename);
}

async function generateMCPReview(prNumber) {
  return new Promise(async (resolve) => {
    console.log('🤖 Orchestrating MCP PR Review via JSON-RPC...');

    if (!fs.existsSync(MCP_SERVER_PATH)) {
      resolve(`⚠️ MCP server not found at ${MCP_SERVER_PATH}`);
      return;
    }

    const diff = await getPRDiff(prNumber);
    const files = await getPRFiles(prNumber);

    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let finished = false;
    let reviewResult = '';

    function handleMCPOutput(data) {
      const message = data.toString();
      console.log(`[MCP]: ${message.trim()}`);

      try {
        const lines = message
          .split('\n')
          .filter(l => l.trim().startsWith('{'));

        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            reviewResult = json.result.content?.[0]?.text || '';
            finished = true;
            serverProcess.kill();
          }
        }
      } catch {
      
      }
    }

    serverProcess.stdout.on('data', handleMCPOutput);
    serverProcess.stderr.on('data', handleMCPOutput);

    setTimeout(() => {
      const toolCall = JSON.stringify({
        jsonrpc: '2.0',
        id: 'pr-review-call',
        method: 'tools/call',
        params: {
          name: 'review_code_changes',
          arguments: {
            diff,
            files,
          },
        },
      });

      serverProcess.stdin.write(toolCall + '\n');
    }, 500);

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
  if (comments.some(c => c.body.includes(botTag))) return;

  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
}

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) process.exit(1);

  const [lint, build, audit, mcp] = await Promise.all([
    runLint(),
    runBuildCheck(),
    runAudit(),
    generateMCPReview(prNumber),
  ]);

  const summary = /fail|error|⚠️|vulnerabilities/i.test(lint + audit)
    ? 'Some issues found ⚠️'
    : 'All checks passed ✅';

    // Show full audit details if vulnerabilities detected
  let auditSection = audit;
  if (/Vulnerabilities detected|Vulnerabilities found|vulnerabilities/i.test(audit)) {
    try {
      const auditRaw = execSync('npm audit', { encoding: 'utf-8' });
      auditSection = `Vulnerabilities detected ⚠️\n\n\`\`\`\n${auditRaw}\n\`\`\``;
    } catch (e) {
      auditSection = `Vulnerabilities detected ⚠️\n\n\`\`\`\n${e.stdout || e.message}\n\`\`\``;
    }
  }

  const body = `### 🤖 **AutoDoc Automated Review**

\`\`\`
${summary}
\`\`\`

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

#### 💡 MCP AI PR Review
${mcp}
---
`;

  await postPRCommentIfNew(prNumber, body);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
