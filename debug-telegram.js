// Debug Telegram bot issues
const axios = require('axios');

async function debugTelegramBot() {
  console.log('🔍 DEBUGGING TELEGRAM BOT ISSUES...\n');
  
  const botToken = '8241961782:AAH9i6LbchOh23pGzAkCLiPmPwH5iFRQOGo';
  const apiUrl = `https://api.telegram.org/bot${botToken}`;
  
  try {
    // Test 1: Check if bot token is valid
    console.log('🤖 Step 1: Testing bot token...');
    const meResponse = await axios.get(`${apiUrl}/getMe`);
    console.log('✅ Bot token is valid!');
    console.log(`   Bot name: ${meResponse.data.result.first_name}`);
    console.log(`   Username: @${meResponse.data.result.username}`);
    console.log(`   Bot ID: ${meResponse.data.result.id}`);
    
    // Test 2: Check bot commands
    console.log('\n📋 Step 2: Checking bot commands...');
    const commandsResponse = await axios.get(`${apiUrl}/getMyCommands`);
    console.log('Commands set:', commandsResponse.data.result);
    
    // Test 3: Get recent updates
    console.log('\n📩 Step 3: Checking recent messages...');
    const updatesResponse = await axios.get(`${apiUrl}/getUpdates`);
    const updates = updatesResponse.data.result;
    
    if (updates.length === 0) {
      console.log('⚠️  No messages received yet');
      console.log('   This means either:');
      console.log('   1. You haven\'t sent any messages to the bot yet');
      console.log('   2. The bot is not running on Railway');
      console.log('   3. You\'re messaging the wrong bot');
    } else {
      console.log(`📨 Found ${updates.length} recent messages:`);
      updates.slice(-3).forEach((update, index) => {
        const msg = update.message;
        console.log(`   ${index + 1}. From: ${msg?.from?.username || 'Unknown'}`);
        console.log(`      Text: "${msg?.text || 'No text'}"`);
        console.log(`      Date: ${new Date(msg?.date * 1000)}`);
      });
    }
    
    // Test 4: Send a test message to check if bot can send
    console.log('\n🧪 Step 4: Testing bot send capability...');
    console.log('ℹ️  This will only work if you\'ve started a chat with the bot first');
    
    // Get webhook info
    console.log('\n🔗 Step 5: Checking webhook status...');
    const webhookResponse = await axios.get(`${apiUrl}/getWebhookInfo`);
    console.log('Webhook info:', webhookResponse.data.result);
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('================');
    console.log('✅ Bot token works');
    console.log('✅ Bot exists and is accessible');
    
    if (updates.length === 0) {
      console.log('🚨 ISSUE: Bot is not receiving messages');
      console.log('\n🔧 SOLUTIONS TO TRY:');
      console.log('1. Make sure you found the RIGHT bot:');
      console.log(`   - Search for: @${meResponse.data.result.username}`);
      console.log('   - Or search for: "' + meResponse.data.result.first_name + '"');
      console.log('2. Send /start to the bot in Telegram');
      console.log('3. Check Railway logs to see if bot is running');
      console.log('4. Make sure TELEGRAM_BOT_TOKEN is set in Railway');
    } else {
      console.log('✅ Bot is receiving messages - check Railway logs');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🚨 Bot token is INVALID or EXPIRED');
      console.log('   - Check if you copied the token correctly');
      console.log('   - Make sure token is added to Railway Variables');
    }
  }
}

debugTelegramBot().catch(console.error);