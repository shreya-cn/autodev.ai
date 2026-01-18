import fs from 'fs';
import { Octokit } from '@octokit/rest';

const REPO_OWNER = process.env.REPO_OWNER || 'your-org';
const REPO_NAME = process.env.REPO_NAME || 'your-repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Missing GITHUB_TOKEN');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Read MCP-generated documentation or analysis (adjust the path as needed)
let mcpOutput = '';
try {
  mcpOutput = fs.readFileSync('mcp-doc-output.txt', 'utf-8'); // Change filename as needed
} catch (e) {
  mcpOutput = '';
}

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
    const result = require('child_process').execSync(`npx eslint ${jsFiles.join(' ')}`, { encoding: 'utf-8' });
    return result;
  } catch (e) {
    return e.stdout || e.message;
  }
}

function runBuildCheck() {
  try {
    require('child_process').execSync('npm run build', { encoding: 'utf-8' });
    return 'Build succeeded.';
  } catch (e) {
    return e.stdout || e.message;
  }
}

function runAudit() {
  try {
    const result = require('child_process').execSync('npm audit --json', { encoding: 'utf-8' });
    return summarizeAudit(result);
  } catch (e) {
    // Try to parse and summarize audit output even on error
    if (e.stdout) {
      return summarizeAudit(e.stdout);
    }
    return `Vulnerability check failed. Error: ${e.message}`;
  }
}

function summarizeAudit(auditJson) {
  try {
    const audit = JSON.parse(auditJson);
    // New npm audit format (npm v7+)
    if (audit.vulnerabilities) {
      const vulns = audit.vulnerabilities;
      const names = Object.keys(vulns);
      if (names.length === 0) return 'No known vulnerabilities 🚦';
      let summary = '';
      let total = 0;
      const severityCount = { low: 0, moderate: 0, high: 0, critical: 0 };
      for (const name of names) {
        const v = vulns[name];
        total++;
        if (v.severity && severityCount[v.severity] !== undefined) {
          severityCount[v.severity]++;
        }
      }
      summary += `Vulnerabilities found: ${total} ⚠️\n`;
      summary += `Severity: ` + Object.entries(severityCount).map(([sev, count]) => `${sev}: ${count}`).join(', ');
      return summary;
    }
    // Old npm audit format
    if (audit.metadata && audit.metadata.vulnerabilities) {
      const meta = audit.metadata.vulnerabilities;
      const total = meta.total || (meta.low + meta.moderate + meta.high + meta.critical);
      if (total === 0) return 'No known vulnerabilities 🚦';
      return `Vulnerabilities found: ${total} ⚠️\nSeverity: low: ${meta.low}, moderate: ${meta.moderate}, high: ${meta.high}, critical: ${meta.critical}`;
    }
    // If error field present
    if (audit.error) {
      return `Vulnerability check failed: ${audit.error.summary || audit.error}`;
    }
    return `Vulnerability check: Unrecognized audit output. Raw: ${auditJson}`;
  } catch (err) {
    return `Vulnerability check failed. Could not parse audit output. Raw: ${auditJson}`;
  }
}

function runTestCoverage() {
  try {
    const result = require('child_process').execSync('npm test -- --coverage', { encoding: 'utf-8' });
    return result;
  } catch (e) {
    return e.stdout || e.message;
  }
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
  // Normalize: remove whitespace, collapse newlines, lowercase
  const norm = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  // Simple similarity: percent of matching chars in the shorter string
  const minLen = Math.min(na.length, nb.length);
  let match = 0;
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) match++;
  }
  const similarity = match / minLen;
  return similarity > 0.9; // 90%+ similar
}

async function postPRCommentIfNew(prNumber, body) {
  const existingComments = await getExistingComments(prNumber);
  // Only compare to previous bot comments
  const botComments = existingComments.filter(c => c && c.startsWith('### 🤖 **AutoDoc Automated Review**'));
  for (const c of botComments) {
    if (await isSimilarComment(c, body)) {
      console.log('No new review comment needed (duplicate or near-duplicate detected).');
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

async function generateMCPReview() {
  if (!mcpOutput) {
    return 'No MCP documentation or analysis available.';
  }
  return `#### 💡 **MCP Suggestions & Refactoring**\n${mcpOutput}`;
}

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node pr-reviewer.js <PR_NUMBER>');
    process.exit(1);
  }

  const files = await getChangedFiles(prNumber);
  const lintResult = runLint(files);
  const buildResult = runBuildCheck();
  const auditResult = runAudit();
  const testCoverage = runTestCoverage();
  const mcpReview = await generateMCPReview();

  // High-level summary logic
  let summary = 'All checks passed ✅';
  if (
    (lintResult && !/^No JS\/TS files to lint\./.test(lintResult) && /error|fail|✖|problems?/i.test(lintResult)) ||
    /fail|error|✖/i.test(buildResult) ||
    /Vulnerabilities found: [1-9]/.test(auditResult) ||
    /No MCP documentation|error|fail|problem|issue/i.test(mcpReview) ||
    /FAIL|error|problem|issue|not\s*covered|\b0%\b/i.test(testCoverage)
  ) {
    summary = 'Some issues found ⚠️';
  }

  // Try to extract accessibility/security notes from MCP output
  let accessibilityNotes = '';
  let securityNotes = '';
  if (mcpReview.includes('Accessibility Notes:')) {
    accessibilityNotes = mcpReview.split('Accessibility Notes:')[1].split(/\n|Security Notes:/)[0].trim();
  }
  if (mcpReview.includes('Security Notes:')) {
    securityNotes = mcpReview.split('Security Notes:')[1].split(/\n|$/)[0].trim();
  }

  const commentBody = `### 🤖 **AutoDoc Automated Review**\n\n**${summary}**\n\n---\n\n#### 🧹 **Lint Results**\n\`\`\`\n${lintResult}\n\`\`\`\n\n#### 🏗️ **Build Results**\n\`\`\`\n${buildResult}\n\`\`\`\n\n#### 🧪 **Test Coverage**\n\`\`\`\n${testCoverage}\n\`\`\`\n\n#### 🛡️ **Vulnerability Check**\n${auditResult}\n\n${mcpReview}\n\n${accessibilityNotes ? '#### ♿ **Accessibility Notes**\n' + accessibilityNotes + '\n' : ''}${securityNotes ? '#### 🔒 **Security Notes**\n' + securityNotes + '\n' : ''}---`;

  await postPRCommentIfNew(prNumber, commentBody);
}

main().catch(err => {
  console.error('Error in PR reviewer:', err);
  process.exit(1);
});