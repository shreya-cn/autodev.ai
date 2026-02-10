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

const MCP_SERVER_PATH = fs.existsSync('./dist/index.js') ? './dist/index.js' : './dist/mcp-server.js';
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ---------------- GitHub helpers ----------------

async function getPRFiles(prNumber: number) {
  const { data } = await octokit.pulls.listFiles({ owner: REPO_OWNER, repo: REPO_NAME, pull_number: prNumber });
  return data.map(f => f.filename);
}

async function getPRDiff(prNumber: number) {
  const { data } = await octokit.pulls.get({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  return data;
}

// ---------------- MCP review ----------------

async function generateMCPReview(prNumber: number) {
  if (!fs.existsSync(MCP_SERVER_PATH)) return '⚠️ MCP server not found.';

  const diff = await getPRDiff(prNumber);
  const files = await getPRFiles(prNumber);

  return new Promise(resolve => {
    const server = spawn('node', [MCP_SERVER_PATH], { env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let finished = false;

    const handleOutput = (data: Buffer) => {
      try {
        const lines = data.toString().split('\n').filter(l => l.trim().startsWith('{'));
        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            finished = true;
            server.kill();
            resolve(json.result.content?.[0]?.text || 'No suggestions.');
          }
        }
      } catch { }
    };

    server.stdout.on('data', handleOutput);
    server.stderr.on('data', handleOutput);

    // Fire tool call
    setTimeout(() => {
      server.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 'pr-review-call',
        method: 'tools/call',
        params: { name: 'review_code_changes', arguments: { diff, files } },
      }) + '\n');
    }, 500);

    // Timeout fallback
    setTimeout(() => { if (!finished) { server.kill(); resolve('⚠️ MCP review timed out.'); } }, 120_000);
  });
}

// ---------------- Local checks ----------------

function runLint() {
  try { return execSync('npx eslint .', { encoding: 'utf-8' }); } catch (e) { return e.stdout || e.message; }
}

function runBuildCheck() {
  try { execSync('npm run build', { encoding: 'utf-8' }); return 'Build succeeded ✅'; } catch (e) { return e.stdout || e.message; }
}

function runAudit() {
  try {
    const audit = JSON.parse(execSync('npm audit --json', { encoding: 'utf-8' }));
    const total = Object.keys(audit.vulnerabilities || {}).length;
    return total === 0 ? 'No known vulnerabilities 🚦' : `Vulnerabilities found: ${total} ⚠️`;
  } catch { return 'Vulnerabilities detected ⚠️'; }
}

// ---------------- PR comments ----------------

async function postPRCommentIfNew(prNumber: number, body: string) {
  const { data: comments } = await octokit.issues.listComments({ owner: REPO_OWNER, repo: REPO_NAME, issue_number: prNumber });
  if (comments.some(c => c.body.includes('### 🤖 **AutoDoc Automated Review**'))) return;

  await octokit.issues.createComment({ owner: REPO_OWNER, repo: REPO_NAME, issue_number: prNumber, body });
}

// ---------------- Main ----------------

async function main() {
  const prNumber = Number(process.argv[2]);
  if (!prNumber) process.exit(1);

  const [lint, build, audit, mcp] = await Promise.all([runLint(), runBuildCheck(), runAudit(), generateMCPReview(prNumber)]);

  const summary = /fail|error|⚠️|vulnerabilities/i.test(lint + audit) ? 'Some issues found ⚠️' : 'All checks passed ✅';

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

#### 💡 MCP AI PR Review
${mcp}
---
`;

  await postPRCommentIfNew(prNumber, body);
}

main().catch(err => { console.error(err); process.exit(1); });
