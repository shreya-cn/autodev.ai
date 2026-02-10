// sampletest.js
// Simple test case: fails intentionally for PR review

function testAddition() {
  const result = 2 + 2;
  if (result !== 5) {
    console.error('Test failed: 2 + 2 should equal 5 (intentional fail)');
    process.exitCode = 1;
  } else {
    console.log('Test passed!');
  }
}

testAddition();
