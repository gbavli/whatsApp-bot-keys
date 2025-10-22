// Test the new Telegram bot token
const axios = require('axios');

async function testNewToken() {
  const newToken = '8241961782:AAF6IQFSBL91Sd-8t0futKNceR_l519NzsU';
  const apiUrl = `https://api.telegram.org/bot${newToken}`;
  
  try {
    console.log('🧪 Testing new bot token...');
    
    // Test token validity
    const response = await axios.get(`${apiUrl}/getMe`);
    
    if (response.data.ok) {
      console.log('✅ NEW TOKEN WORKS!');
      console.log(`Bot name: ${response.data.result.first_name}`);
      console.log(`Username: @${response.data.result.username}`);
      console.log(`Bot ID: ${response.data.result.id}`);
    } else {
      console.log('❌ Token invalid:', response.data);
    }
    
  } catch (error) {
    console.log('❌ Token test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('🚨 Token is invalid or expired');
    }
  }
}

testNewToken();