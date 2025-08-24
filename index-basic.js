// Ultra-basic bot to ensure Railway deployment works
require('dotenv/config');

console.log('🚀 Starting BASIC WhatsApp bot...');
console.log('📊 Node.js version:', process.version);
console.log('📊 Current time:', new Date().toISOString());

// Test basic functionality step by step
async function startBasicBot() {
  try {
    console.log('1️⃣ Loading modules...');
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    const { PostgresLookup } = require('./dist/src/data/postgresLookup');
    console.log('✅ Modules loaded successfully');

    console.log('2️⃣ Testing environment...');
    console.log('- DATABASE_URL present:', !!process.env.DATABASE_URL);
    console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
    
    console.log('3️⃣ Creating PostgreSQL lookup...');
    const lookup = new PostgresLookup();
    console.log('✅ PostgreSQL lookup created');

    console.log('4️⃣ Creating WhatsApp bot...');
    // Create bot without any complex features initially
    const bot = new WhatsAppBot(lookup);
    console.log('✅ WhatsApp bot created');

    console.log('5️⃣ Starting WhatsApp connection...');
    await bot.start();
    console.log('✅ WhatsApp bot started successfully');

  } catch (error) {
    console.error('❌ Basic bot failed at step:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Immediate execution
startBasicBot().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

// Keep process alive
console.log('🔄 Bot process running...');
setInterval(() => {
  console.log('💓 Heartbeat:', new Date().toLocaleTimeString());
}, 30000); // Every 30 seconds