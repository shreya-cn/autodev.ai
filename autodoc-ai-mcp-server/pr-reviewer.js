import fs from 'fs';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

const REPO_OWNER = process.env.REPO_OWNER || 'your-org';
const REPO_NAME = process.env.REPO_NAME || 'your-repo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Missing GITHUB_TOKEN');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Utility to read MCP-generated documentation safely
function getMcpOutput() {
  try {
    const path = 'mcp-doc-output.txt';
    if (fs.existsSync(path)) {
      return fs.readFileSync(path, 'utf-8');
    }
  } catch (e) {
    console.warn('Could not read MCP output file:', e.message);
  }
  return '';
}

async function getChangedFiles(prNumber) {
  const { data } = await octokit.pulls.listFiles({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    pull_number: prNumber,
  });
  // Adjusting the regex to match your specific subdirectory if needed
  return data.map(f => f.filename.replace(/^autodoc-ai-mcp-server\//, ''));
}

function runLint(files) {
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'));
  if (jsFiles.length === 0) return 'No JS/TS files to lint.';
  try {
    // Note: ensure eslint is in your devDependencies
    const result = execSync(`npx eslint ${jsFiles.join(' ')}`, { encoding: 'utf-8', stdio: 'pipe' });
    return result || 'Lint check passed. No issues found.';
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

function runBuildCheck() {
  try {
    execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
    return 'Build succeeded. ✅';
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

function summarizeAudit(auditJson) {
  try {
    const audit = JSON.parse(auditJson);
    const vulns = audit.vulnerabilities || (audit.metadata && audit.metadata.vulnerabilities);
    
    if (!vulns) return 'No vulnerability data found.';
    
    const total = vulns.total !== undefined ? vulns.total : (vulns.low + vulns.moderate + vulns.high + vulns.critical);
    if (total === 0) return 'No known vulnerabilities 🚦';

    let details = '';
    if (audit.vulnerabilities) {
      Object.entries(audit.vulnerabilities).forEach(([pkg, info]) => {
        details += `- **${pkg}** (${info.severity}): via ${Array.isArray(info.via) ? info.via.map(v => v.title || v).join(', ') : info.via}\n`;
      });
    }

    return `Vulnerabilities found: ${total} ⚠️\n\n${details}`;
  } catch (err) {
    return `Failed to parse audit output.`;
  }
}

function runAudit() {
  try {
    const result = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
    return summarizeAudit(result);
  } catch (e) {
    // npm audit returns exit code 1 if vulnerabilities are found
    if (e.stdout) return summarizeAudit(e.stdout);
    return `Vulnerability check failed: ${e.message}`;
  }
}

function runTestCoverage() {
  try {
    // Adjust command based on your test runner (jest/vitest)
    const result = execSync('npm test -- --coverage --watchAll=false', { encoding: 'utf-8', stdio: 'pipe' });
    return result;
  } catch (e) {
    return e.stdout || e.stderr || e.message;
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

async function isSimilarComment(newBody, existingComments) {
  const botHeader = '### 🤖 **AutoRev Automated Review**';
  const botComments = existingComments.filter(c => c && c.startsWith(botHeader));
  
  const norm = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
  const newNorm = norm(newBody);

  for (const comment of botComments) {
    if (norm(comment) === newNorm) return true;
  }
  return false;
}

async function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node pr-reviewer.js <PR_NUMBER>');
    process.exit(1);
  }

  console.log(`🚀 Starting review for PR #${prNumber}...`);

  const files = await getChangedFiles(prNumber);
  const lintResult = runLint(files);
  const buildResult = runBuildCheck();
  const auditResult = runAudit();
  const testCoverage = runTestCoverage();
  const mcpOutput = getMcpOutput();

  let summary = 'All checks passed ✅';
  const hasFailures = [lintResult, buildResult, testCoverage].some(res => /fail|error|✖/i.test(res));
  const hasVulns = auditResult.includes('⚠️');

  if (hasFailures || hasVulns) {
    summary = 'Some issues found ⚠️';
  }

  const commentBody = [
    `### 🤖 **AutoRev Automated Review**`,
    `**${summary}**`,
    `---`,
    `#### 🧹 **Lint Results**`,
    `\`\`\`\n${lintResult}\n\`\`\``,
    `#### 🏗️ **Build Results**`,
    `\`\`\`\n${buildResult}\n\`\`\``,
    `#### 🧪 **Test Coverage**`,
    `\`\`\`\n${testCoverage.substring(0, 1000)}${testCoverage.length > 1000 ? '...' : ''}\n\`\`\``,
    `#### 🛡️ **Vulnerability Check**`,
    auditResult,
    `---`,
    mcpOutput ? `#### 💡 **MCP Suggestions**\n${mcpOutput}` : '_No MCP documentation generated for this pass._'
  ].join('\n\n');

  const existingComments = await getExistingComments(prNumber);
  if (await isSimilarComment(commentBody, existingComments)) {
    console.log('Skipping: Similar comment already exists.');
  } else {
    await octokit.issues.createComment({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: prNumber,
      body: commentBody,
    });
    console.log('✅ Comment posted successfully.');
  }
}

main().catch(err => {
  console.error('CRITICAL ERROR:', err);
  process.exit(1);
});