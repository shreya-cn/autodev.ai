function testFail() {
  if (1 + 1 !== 3) {
    throw new Error('Test failed: 1 + 1 should equal 3 (intentional fail)');
  }
}
testFail();