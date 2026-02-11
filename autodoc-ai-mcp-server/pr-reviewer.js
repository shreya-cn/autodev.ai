
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

const MCP_SERVER_PATH = fs.existsSync('./dist/index.js')
    ? './dist/index.js'
    : './dist/mcp-server.js';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/* -------------------------------------------------------------------------- */
/*                               GitHub Helpers                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                             MCP AI Code Review                             */
/* -------------------------------------------------------------------------- */

async function generateMCPReview(prNumber) {
  return new Promise(async (resolve) => {
    console.log('🤖 Running MCP AI PR Review...');

    if (!fs.existsSync(MCP_SERVER_PATH)) {
      resolve('⚠️ MCP server not found.');
      return;
    }

    const diff = await getPRDiff(prNumber);
    const files = await getPRFiles(prNumber);

    const serverProcess = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, EXIT_ON_TOOL_COMPLETE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let reviewResult = '';
    let resolved = false;

    function cleanup(result) {
      if (!resolved) {
        resolved = true;
        try { serverProcess.kill(); } catch {}
        resolve(result);
      }
    }

    function handleOutput(data) {
      const lines = data.toString().split('\n');

      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue;

        try {
          const json = JSON.parse(line);
          if (json.id === 'pr-review-call' && json.result) {
            reviewResult =
                json.result?.content?.[0]?.text ||
                '⚠️ MCP returned empty review.';
            cleanup(reviewResult);
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    serverProcess.stdout.on('data', handleOutput);
    serverProcess.stderr.on('data', handleOutput);

    setTimeout(() => {
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: 'pr-review-call',
        method: 'tools/call',
        params: {
          name: 'review_code_changes',
          arguments: { diff, files },
        },
      });

      serverProcess.stdin.write(payload + '\n');
    }, 500);

    setTimeout(() => {
      cleanup('⚠️ MCP review timed out.');
    }, 120_000);
  });
}

/* -------------------------------------------------------------------------- */
/*                                Lint Check                                  */
/* -------------------------------------------------------------------------- */

function runLint() {
  try {
    return execSync('npx eslint .', { encoding: 'utf-8' });
  } catch (e) {
    return e.stdout || e.message;
  }
}

/* -------------------------------------------------------------------------- */
/*                                Build Check                                 */
/* -------------------------------------------------------------------------- */

function runBuildCheck() {
  try {
    execSync('npm run build', { encoding: 'utf-8' });
    return 'Build succeeded ✅';
  } catch (e) {
    return e.stdout || e.message;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Vulnerability Audit                             */
/* -------------------------------------------------------------------------- */

function runAudit() {
  try {
    const result = execSync('npm audit --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseAudit(result);
  } catch (e) {
    if (e.stdout) {
      return parseAudit(e.stdout);
    }
    return {
      summary: '⚠️ Unable to parse npm audit results.',
      details: 'Audit command failed unexpectedly.',
      hasIssues: true,
    };
  }
}

function parseAudit(raw) {
  try {
    const audit = JSON.parse(raw);

    const vulnerabilities = audit.vulnerabilities || {};
    const total = Object.keys(vulnerabilities).length;

    if (total === 0) {
      return {
        summary: 'No known vulnerabilities 🚦',
        details: 'All dependencies are secure.',
        hasIssues: false,
      };
    }

    let details = '';
    for (const [pkg, info] of Object.entries(vulnerabilities)) {
      details += `• ${pkg}\n`;
      details += `  Severity: ${info.severity}\n`;
      details += `  Range: ${info.range}\n`;
      details += `  Fix Available: ${info.fixAvailable ? 'Yes' : 'No'}\n\n`;
    }

    return {
      summary: `Vulnerabilities found: ${total} ⚠️`,
      details,
      hasIssues: true,
    };
  } catch {
    return {
      summary: '⚠️ Failed to parse audit JSON.',
      details: raw,
      hasIssues: true,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                         Post Comment If Not Exists                         */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) process.exit(1);

  const [lint, build, auditResult, mcp] = await Promise.all([
    runLint(),
    runBuildCheck(),
    runAudit(),
    generateMCPReview(prNumber),
  ]);

  const combinedText = lint + build + auditResult.summary + mcp;

  const hasIssues =
      auditResult.hasIssues ||
      /fail|error|⚠️|vulnerab|recommend|issue|fix|improve/i.test(combinedText);

  const summary = hasIssues
      ? 'Some issues found ⚠️'
      : 'All checks passed ✅';

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
**${auditResult.summary}**

\`\`\`
${auditResult.details}
\`\`\`

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
