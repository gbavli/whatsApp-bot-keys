// Simple Railway start script that doesn't rely on complex builds
require('dotenv/config');

console.log('🤖 Starting Telegram Bot - Simple Railway Version');

// Import compiled modules
async function startTelegramBot() {
  try {
    const { TelegramBot } = require('./dist/src/bot/telegram');
    const { getVehicleLookup } = require('./dist/src/data/providerFactory');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not found');
      process.exit(1);
    }

    console.log('📊 Connecting to database...');
    const lookup = await getVehicleLookup();
    
    console.log('🚀 Starting bot...');
    const bot = new TelegramBot(lookup, botToken);
    await bot.start();
    
    console.log('✅ Telegram bot running successfully!');
  } catch (error) {
    console.error('❌ Bot failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

startTelegramBot();