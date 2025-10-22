// ULTRA-SIMPLE TELEGRAM BOT - ZERO CONFIGURATION
// Just run: node deploy-bot.js

const axios = require('axios');

const BOT_TOKEN = '8241961782:AAF6IQFSBL91Sd-8t0futKNceR_l519NzsU';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:ZfUYUgJUPRaNtlEyuOKheDOxHaBxHKCl@junction.proxy.rlwy.net:51070/railway';

console.log('🚀 ULTRA-SIMPLE TELEGRAM BOT STARTING...');
console.log('🎯 Bot Token:', BOT_TOKEN.substring(0, 15) + '...');
console.log('🎯 Database:', DATABASE_URL ? 'Connected' : 'Not configured');

let offset = 0;

async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
  } catch (error) {
    console.error('Send error:', error.message);
  }
}

async function handleMessage(msg) {
  const text = msg.text?.toLowerCase();
  const chatId = msg.chat.id;
  
  if (text === '/start') {
    await sendMessage(chatId, '🤖 Vehicle Pricing Bot is working!\n\nSend a car make like "toyota" to search.');
    return;
  }
  
  await sendMessage(chatId, `You said: ${text}\n\nBot is working! 🎉\n(Vehicle search coming soon)`);
}

async function startBot() {
  console.log('📡 Starting polling...');
  
  while (true) {
    try {
      const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
        params: { offset, timeout: 10 }
      });

      for (const update of response.data.result) {
        if (update.message) {
          await handleMessage(update.message);
        }
        offset = update.update_id + 1;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('❌ Bot token invalid!');
        break;
      }
      console.error('Polling error:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Start immediately
startBot();