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
  try {
    const { data } = await octokit.pulls.listFiles({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      pull_number: prNumber,
    });
    return data.map(f => f.filename.replace(/^autodoc-ai-mcp-server\//, ''));
  } catch (err) {
    return [];
  }
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

function runTestCoverage() {
  try {
    const result = execSync('npm test -- --coverage', { encoding: 'utf-8' });
    return result;
  } catch (e) {
    return e.stdout || e.message;
  }
}

function runAudit() {
  try {
    const result = execSync('npm audit --json', { encoding: 'utf-8' });
    const audit = JSON.parse(result);
    return `Vulnerabilities: ${audit.metadata.vulnerabilities.total}`;
  } catch (e) {
    return e.stdout || e.message;
  }
}

async function generateLLMReview(diff) {
  const llmPrompt = `Review the following code diff and provide:\n- A summary of the changes\n- Code review comments (style, bugs, best practices)\n- Refactoring suggestions\n- Accessibility and security notes if relevant\n- A closing statement\n\nDiff:\n${diff}`;
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'user', content: llmPrompt }
    ],
    max_tokens: 500,
  });
  let content = response.choices[0].message.content.trim();
  if (!content.endsWith('.') && !content.endsWith('!') && !content.endsWith('?')) {
    content += '\n\nThank you for your contribution!';
  }
  return content;
}

async function postPRComment(prNumber, body) {
  await octokit.issues.createComment({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: prNumber,
    body,
  });
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
  const testCoverage = runTestCoverage();
  const auditResult = runAudit();

  // Get PR diff
  let diff = '';
  try {
    const { data: pr } = await octokit.pulls.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      pull_number: prNumber,
    });
    diff = pr.diff_url ? execSync(`curl -sL ${pr.diff_url}`, { encoding: 'utf-8' }) : '';
  } catch (err) {
    diff = '';
  }
  const llmReview = await generateLLMReview(diff);

  const commentBody = `### Automated Review\n\n**Lint Results:**\n\n\`\`\`\n${lintResult}\n\`\`\`\n\n**Build Results:**\n\n\`\`\`\n${buildResult}\n\`\`\`\n\n**Test Coverage:**\n\n\`\`\`\n${testCoverage}\n\`\`\`\n\n**Dependency Audit:**\n\n${auditResult}\n\n**LLM Suggestions:**\n\n${llmReview}`;

  await postPRComment(prNumber, commentBody);
  console.log('Posted automated review comment to PR #' + prNumber);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
