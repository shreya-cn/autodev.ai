// Test OpenAI API Key
// Run: node test-openai-key.js

const https = require('https');

// Read from environment variable (NEVER hardcode keys!)
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY environment variable not set');
  console.log('\nSet it with: export OPENAI_API_KEY="your-key-here"');
  process.exit(1);
}

// Test API call
const data = JSON.stringify({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Say hello" }],
  max_tokens: 10
});

const options = {
  hostname: 'api.openai.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': data.length
  }
};

console.log('🔍 Testing OpenAI API key...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API Key is VALID and working!');
      console.log('\nResponse:', JSON.parse(responseData).choices[0].message.content);
    } else if (res.statusCode === 401) {
      console.log('❌ API Key is INVALID or expired');
      console.log('\nError:', JSON.parse(responseData).error.message);
    } else if (res.statusCode === 429) {
      console.log('⚠️  API Key is valid but rate limit exceeded');
      console.log('\nError:', JSON.parse(responseData).error.message);
    } else {
      console.log(`❌ Error: HTTP ${res.statusCode}`);
      console.log('\nResponse:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Network error:', error.message);
});

req.write(data);
req.end();
