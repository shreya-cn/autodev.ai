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
