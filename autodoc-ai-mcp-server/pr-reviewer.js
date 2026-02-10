import fs from 'fs';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

// Environment Variables
const REPO_OWNER = process.env.REPO_OWNER || 'your-org';
const REPO_NAME = process.env.REPO_NAME || 'your-repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
 
if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}
 
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// --- Helper Functions ---

async function getChangedFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  return data.map(f => f.filename.replace(/^autodoc-ai-mcp-server\//, ''));
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

function summarizeAudit(auditJson) {
  try {
    const audit = JSON.parse(auditJson);
    if (audit.vulnerabilities) {
      const vulns = audit.vulnerabilities;
      const names = Object.keys(vulns);
      if (names.length === 0) return 'No known vulnerabilities 🚦';
      
      let total = 0;
      let details = '';
      const severityCount = { low: 0, moderate: 0, high: 0, critical: 0 };

      for (const name of names) {
        const v = vulns[name];
        total++;
        if (v.severity && severityCount[v.severity] !== undefined) {
          severityCount[v.severity]++;
        }
        if (v.via && Array.isArray(v.via)) {
          v.via.forEach((issue) => {
            details += `- ${name} (${v.severity}): ${issue.title || issue.source || 'No title'}\n`;
          });
        }
      }
      return `Vulnerabilities found: ${total} ⚠️\nSeverity: ${Object.entries(severityCount).map(([s, c]) => `${s}: ${c}`).join(', ')}\n\nDetails:\n${details}`;
    }
    return 'Vulnerability check: No standard format detected.';
  } catch (err) {
    return `Vulnerability check failed to parse.`;
  }
}

function runAudit() {
  try {
    const result = execSync('npm audit --json', { encoding: 'utf-8' });
    return summarizeAudit(result);
  } catch (e) {
    return e.stdout ? summarizeAudit(e.stdout) : `Audit failed: ${e.message}`;
  }
}

function runTestCoverage() {
  try {
    return execSync('npm test -- --coverage', { encoding: 'utf-8' });
  } catch (e) {
    return e.stdout || e.message;
  }
  return content;
}
 
async function getExistingComments(prNumber) {
  const { data } = await octokit.issues.listComments({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    per_page: 100
  });
  return data.map(c => c.body);
}
 
async function isSimilarComment(a, b) {
  const norm = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  
  let match = 0;
  const minLen = Math.min(na.length, nb.length);
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) match++;
  }
  return (match / minLen) > 0.9;
}
 
async function postPRCommentIfNew(prNumber, body) {
  const existingComments = await getExistingComments(prNumber);
  const botComments = existingComments.filter(c => c && c.startsWith('### 🤖 **AutoDoc Automated Review**'));
  
  for (const c of botComments) {
    if (await isSimilarComment(c, body)) {
      console.log('No new review comment needed.');
      return;
    }
  }
  
  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
  console.log('Posted automated review comment to PR #' + prNumber);
}

// Helper to get changed file diffs
async function getChangedFilesWithDiffs(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  return data.map(f => ({ filename: f.filename.replace(/^autodoc-ai-mcp-server\//, ''), diff: f.patch || '' }));
}

// AI review based on diffs
async function generateAIReviewWithDiffs(prNumber) {
  try {
    const filesWithDiffs = await getChangedFilesWithDiffs(prNumber);
    const diffs = filesWithDiffs.map(f => `File: ${f.filename}\n${f.diff}`).join('\n\n');
    if (!OPENAI_API_KEY) return 'No AI review: missing API key.';
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const aiResponse = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert code reviewer. Review the following code diffs and provide suggestions.' },
        { role: 'user', content: diffs }
      ],
      max_tokens: 500
    });
    return aiResponse.choices[0].message.content.trim();
  } catch (e) {
    console.error(e);
    return 'AI review generation failed.';
  }
}

// --- Main Logic ---

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node pr-reviewer.js <PR_NUMBER>');
    process.exit(1);
  }

  // Load MCP Output
  let mcpOutput = '';
  try {
    mcpOutput = fs.readFileSync('mcp-doc-output.txt', 'utf-8');
  } catch (e) {
    mcpOutput = 'No MCP documentation available.';
  }

  const files = await getChangedFiles(prNumber);
  const lintResult = runLint(files);
  const buildResult = runBuildCheck();
  const auditResult = runAudit();
  const testCoverage = runTestCoverage();
  // AI review based on diffs
  const aiReview = await generateAIReviewWithDiffs(prNumber);

  // Summary logic
  let summary = 'All checks passed ✅';
  const issueKeywords = /fail|error|✖|problems?|Vulnerabilities found: [1-9]|not covered/i;
  
  if (issueKeywords.test(lintResult) || issueKeywords.test(buildResult) || issueKeywords.test(auditResult) || issueKeywords.test(testCoverage)) {
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

#### 💡 **MCP Suggestions**
${mcpOutput}

#### 🤖 **AI Review Suggestions (Diff-based)**
${aiReview}

---`;

  await postPRCommentIfNew(prNumber, commentBody);
}
 
main().catch(err => {
  console.error(err);
  process.exit(1);
});