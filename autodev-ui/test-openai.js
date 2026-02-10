const OpenAI = require('openai');
require('dotenv').config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY is not set');
  process.exit(1);
}

console.log('🔍 Testing OpenAI API Key...');
console.log(`API Key (first 20 chars): ${apiKey.substring(0, 20)}...`);

const openai = new OpenAI({
  apiKey: apiKey,
});

(async () => {
  try {
    console.log('\n📤 Sending test request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "Say 'API is working' and nothing else."
        }
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const response = completion.choices[0]?.message?.content || '';
    console.log('\n✅ SUCCESS! OpenAI API is working correctly');
    console.log(`📝 Response: "${response}"`);
    console.log(`🔢 Tokens used: ${completion.usage?.total_tokens}`);
    console.log(`📊 Model: ${completion.model}`);
    
  } catch (error) {
    console.error('\n❌ FAILED! OpenAI API Error:');
    if (error.status === 401) {
      console.error('   Status: 401 Unauthorized');
      console.error('   Issue: Invalid or expired API key');
      console.error('   Solution: Generate a new API key at https://platform.openai.com/account/api-keys');
    } else if (error.status === 429) {
      console.error('   Status: 429 Too Many Requests');
      console.error('   Issue: Rate limit exceeded or insufficient credits');
    } else if (error.status === 500) {
      console.error('   Status: 500 Server Error');
      console.error('   Issue: OpenAI service is experiencing issues');
    } else {
      console.error(`   Status: ${error.status}`);
      console.error(`   Message: ${error.message}`);
    }
    
    if (error.error?.message) {
      console.error(`   Details: ${error.error.message}`);
    }
    process.exit(1);
  }
})();
