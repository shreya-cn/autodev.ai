// pr-reviewer.js
// Script to auto-generate PR review comments and refactoring suggestions
// Usage: node pr-reviewer.js <PR_NUMBER>

const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');
const openai = require('openai');
const fs = require('fs');

// Load config (replace with your repo and OpenAI details)
const REPO_OWNER = process.env.REPO_OWNER || 'your-org';
const REPO_NAME = process.env.REPO_NAME || 'your-repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!GITHUB_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing GITHUB_TOKEN or OPENAI_API_KEY');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
openai.apiKey = OPENAI_API_KEY;

async function getChangedFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  return data.map(f => f.filename);
}

function runLint(files) {
  try {
    const result = execSync(`npx eslint ${files.join(' ')}`, { encoding: 'utf-8' });
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

async function generateLLMReview(diff) {
  // Replace with your OpenAI LLM call
  const response = await openai.Completion.create({
    model: 'gpt-4',
    prompt: `Review the following code diff and provide review comments and refactoring suggestions.\n${diff}`,
    max_tokens: 300,
  });
  return response.choices[0].text.trim();
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

  // Get PR diff
  const { data: pr } = await octokit.pulls.get({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  const diff = pr.diff_url ? execSync(`curl -sL ${pr.diff_url}`, { encoding: 'utf-8' }) : '';
  const llmReview = await generateLLMReview(diff);

  const commentBody = `### Automated Review\n\n**Lint Results:**\n\n\`\`\`\n${lintResult}\n\`\`\`\n\n**Build Results:**\n\n\`\`\`\n${buildResult}\n\`\`\`\n\n**LLM Suggestions:**\n\n${llmReview}`;

  await postPRComment(prNumber, commentBody);
  console.log('Posted automated review comment to PR #' + prNumber);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
