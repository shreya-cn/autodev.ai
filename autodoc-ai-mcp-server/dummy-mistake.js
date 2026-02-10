// This is a dummy file with intentional mistakes for PR review testing

function add(a, b) {
  // mistake: missing return statement
  const sum = a + b
}

const unusedVar = 42 // mistake: unused variable

if (true) {
  // mistake: block with no effect
}

// mistake: inconsistent quotes
console.log("Hello world!');

// mistake: missing semicolon
console.log('This line is missing a semicolon')

// mistake: function never used
function neverUsed() {
  return 'I am never called';
}
