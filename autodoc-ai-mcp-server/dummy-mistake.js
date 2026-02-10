// This is a dummy file for PR review workflow testing

function add(a, b) {
    return a + b // missing semicolon (lint error)
}

// TODO: This function needs error handling

function subtract(a, b) {
    return a - b;
}

// FIXME: This function is not covered by tests
function multiply(a, b) {
    // Intentional bug: should be a * b
    return a + b;
}

// SECURITY: This is a dummy security note for MCP extraction test
// ACCESSIBILITY: This is a dummy accessibility note for MCP extraction test
// Unused variable (lint issue)
const unusedVar = 123;

// SECURITY: Use of eval is dangerous
function runUserCode(code) {
    return eval(code); // SECURITY: Do not use eval
}

// ACCESSIBILITY: Input missing label
function renderInput() {
    return "<input type='text'>"; // Accessibility issue: no label
}

// Lint issue: double quotes instead of single
console.log("This should use single quotes");

// Function with missing return (logic/coverage issue)
function divide(a, b) {
    if (b === 0) {
        // TODO: handle division by zero
    }
    // Missing return statement
}
function divideTest(a, b) {
    if (b === 0) {
        // TODO: handle division by zero
    }
    // Missing return statement
}

function addTest(a, b) {
    return a + b // missing semicolon (lint error)
}

// TODO: This function needs error handling

function subtractTest(a, b) {
    return a - b;
}

// FIXME: This function is not covered by tests
function multiplyTest(a, b) {
    // Intentional bug: should be a * b
    return a + b;
}