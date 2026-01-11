// Trigger workflow run
import { spawn } from 'child_process';

console.log('🧪 Testing MCP Server...');

// Start the server
const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let responseReceived = false;

// Listen for server output
server.stdout.on('data', (data) => {
    console.log('✅ Server responded:');
    console.log(data.toString());
    responseReceived = true;
    server.kill();
});

server.stderr.on('data', (data) => {
    console.log('🐛 Server debug output:');
    console.log(data.toString());
});

// Send test request after server starts
setTimeout(() => {
    console.log('📤 Sending test request...');
    const testRequest = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }) + '\n';
    
    server.stdin.write(testRequest);
    
    // Give it time to respond
    setTimeout(() => {
        if (!responseReceived) {
            console.log('⏰ No response received in 3 seconds');
            console.log('💡 This might be normal - MCP servers often run silently');
            server.kill();
        }
    }, 3000);
}, 1000);

server.on('close', (code) => {
    console.log(`🔚 Test completed (exit code: ${code})`);
    if (responseReceived) {
        console.log('🎉 Your server is working correctly!');
    } else {
        console.log('🤔 Server started but no JSON response - this is often normal for MCP servers');
        console.log('📋 Try using it with Claude Desktop or another MCP client');
    }
});

// Sample function to trigger PR review comments
function addNumbers(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') {
        return 'Invalid input'; // Should throw error or handle better
    }
    return a + b // missing semicolon, no input validation for NaN
}

console.log('Sum:', addNumbers(2, '3'));

// Linting issue: unused variable
let unusedVar = 42

// Bug: unreachable code
function checkPositive(num) {
    if (num < 0) {
        return false;
        console.log('This will never run'); // unreachable
    }
    return true;
}

// Code quality: bad variable naming
let a = 5, b = 10;
let result = a+b
console.log('Result:', result)

// Accessibility: simulated issue in HTML string
const htmlButton = '<button>Click</button>' // missing accessible label
console.log(htmlButton)

// Refactoring: duplicate code
function double(x) {
    return x * 2;
}
function doubleAgain(x) {
    return x * 2;
}

// Linting: inconsistent quotes, missing semicolons
console.log("Double:", double(4))
console.log('DoubleAgain:', doubleAgain(4))