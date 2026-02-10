const fs = require('fs');

const changedFiles = process.argv.slice(2);

if (changedFiles.length === 0) {
  console.log('MCP: No files changed in this PR.');
  process.exit(0);
}

console.log('MCP Suggestions:');
changedFiles.forEach(file => {
  // Try to read file content (optional, for more advanced suggestions)
  let suggestion = `- Review ${file} for improvements.`;
  try {
    const content = fs.readFileSync(file, 'utf-8');
    if (/TODO|FIXME/i.test(content)) {
      suggestion += ' Contains TODO/FIXME comments.';
    }
    if (/console\.log/i.test(content)) {
      suggestion += ' Contains console.log statements.';
    }
  } catch (err) {
    suggestion += ' (Could not read file contents)';
  }
  console.log(suggestion);
});
