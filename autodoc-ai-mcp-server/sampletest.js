// TODO: Add more test cases for subtraction
// TODO: Add edge case tests for addition
// TODO: Refactor testAddition to use a test framework

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