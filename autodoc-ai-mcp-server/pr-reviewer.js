// pr-reviewer.js
// Script to auto-generate PR review comments and refactoring suggestions
// Usage: node pr-reviewer.js <PR_NUMBER>
 
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import fs from 'fs';
 
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
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
 
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
    const result = execSync(`npx eslint ${jsFiles.join(' ')}`, { encoding: 'utf-8' });
    return result;
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
    const total = audit.metadata.vulnerabilities.total;
    if (total === 0) return 'No known vulnerabilities 🚦';
    return `Vulnerabilities found: ${total} ⚠️`;
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
      let details = '';
      for (const name of names) {
        const v = vulns[name];
        total++;
        if (v.severity && severityCount[v.severity] !== undefined) {
          severityCount[v.severity]++;
        }
        // List each vulnerability for this package
        if (v.via && Array.isArray(v.via)) {
          v.via.forEach((issue) => {
            if (typeof issue === 'object') {
              details += `- ${name} (${v.severity}): ${issue.title || issue.source || 'No title'}\n`;
            } else {
              details += `- ${name} (${v.severity}): ${issue}\n`;
            }
          });
        } else if (v.via) {
          details += `- ${name} (${v.severity}): ${v.via}\n`;
        }
      }
      summary += `Vulnerabilities found: ${total} ⚠️\n`;
      summary += `Severity: ` + Object.entries(severityCount).map(([sev, count]) => `${sev}: ${count}`).join(', ') + '\n';
      summary += `\nVulnerable packages/details:\n${details}`;
      return summary;
    }
    // Old npm audit format
    if (audit.metadata && audit.metadata.vulnerabilities) {
      const meta = audit.metadata.vulnerabilities;
      const total = meta.total || (meta.low + meta.moderate + meta.high + meta.critical);
      if (total === 0) return 'No known vulnerabilities 🚦';
      let details = '';
      if (audit.advisories) {
        for (const id in audit.advisories) {
          const adv = audit.advisories[id];
          details += `- ${adv.module_name} (${adv.severity}): ${adv.title}\n`;
        }
      }
      return `Vulnerabilities found: ${total} ⚠️\nSeverity: low: ${meta.low}, moderate: ${meta.moderate}, high: ${meta.high}, critical: ${meta.critical}\n\nVulnerable packages/details:\n${details}`;
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
 
async function generateLLMReview(diff) {
  const llmPrompt = `You are an expert code reviewer. Please provide:\n- A concise summary of the changes\n- Constructive code review comments (style, bugs, best practices)\n- Refactoring suggestions\n- Accessibility and security notes if relevant\n- A friendly closing statement\n\nDiff:\n${diff}`;
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'user', content: llmPrompt }
    ],
    max_tokens: 500,
  });
  let content = response.choices[0].message.content.trim();
  if (!content.endsWith('.') && !content.endsWith('!') && !content.endsWith('?')) {
    content += '\n\nThank you for your contribution! 🚀';
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
 
  // Get PR diff
  const { data: pr } = await octokit.pulls.get({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  const diff = pr.diff_url ? execSync(`curl -sL ${pr.diff_url}`, { encoding: 'utf-8' }) : '';
  const llmReview = await generateLLMReview(diff);
 
  const commentBody = `### 🤖 **AutoDoc Automated Review**
 
---
 
#### 🧹 **Lint Results**
\`\`\`
${lintResult}
\`\`\`
 
#### 🏗️ **Build Results**
\`\`\`
${buildResult}
\`\`\`
 
#### 🛡️ **Vulnerability Check**
${auditResult}
 
#### 💡 **AI Suggestions & Refactoring**
${llmReview}
 
---`;
 
  await postPRCommentIfNew(prNumber, commentBody);
}
 
main().catch(err => {
  console.error(err);
  process.exit(1);
});