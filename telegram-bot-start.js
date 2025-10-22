// NEW Telegram bot start file - bypasses Railway cache completely
require('dotenv/config');

console.log('🚀 TELEGRAM BOT - NEW START FILE');
console.log('🔧 This bypasses Railway caching issues');

async function startTelegramBot() {
  try {
    console.log('📦 Loading modules...');
    const { TelegramBot } = require('./dist/src/bot/telegram');
    const { getVehicleLookup } = require('./dist/src/data/providerFactory');

    // Try multiple token sources
    const botToken = process.env.BOT_TOKEN || 
                    process.env.TELEGRAM_BOT_TOKEN ||
                    process.env.TG_BOT_TOKEN;
                    
    console.log('🔑 Token sources available:');
    console.log('   BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET ✅' : 'NOT SET ❌');
    console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET ✅' : 'NOT SET ❌');
    console.log('   TG_BOT_TOKEN:', process.env.TG_BOT_TOKEN ? 'SET ✅' : 'NOT SET ❌');

    if (!botToken) {
      console.error('❌ NO BOT TOKEN FOUND IN ANY VARIABLE');
      console.error('   Set one of: BOT_TOKEN, TELEGRAM_BOT_TOKEN, or TG_BOT_TOKEN');
      process.exit(1);
    }

    const tokenSource = process.env.BOT_TOKEN ? 'BOT_TOKEN' : 
                       process.env.TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : 'TG_BOT_TOKEN';
    console.log(`✅ Using token from: ${tokenSource}`);
    console.log(`🎯 Token starts with: ${botToken.substring(0, 10)}...`);

    console.log('📊 Connecting to PostgreSQL...');
    const lookup = await getVehicleLookup();
    
    console.log('🤖 Creating Telegram bot...');
    const bot = new TelegramBot(lookup, botToken);
    
    console.log('🚀 Starting bot polling...');
    await bot.start();
    
    console.log('✅ TELEGRAM BOT IS RUNNING!');
    console.log('📱 Test it: Search @KeyPricingBot in Telegram');
    
  } catch (error) {
    console.error('❌ STARTUP FAILED:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

console.log('🏁 Starting Telegram bot...');
startTelegramBot();