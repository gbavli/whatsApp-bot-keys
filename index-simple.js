// Simple bot without enhanced features to avoid client reuse issues
require('dotenv/config');

async function createSimpleBot() {
  try {
    console.log('🚀 Starting SIMPLE WhatsApp bot...');
    console.log('📊 Data Provider: postgres (simple mode)');
    
    // Import basic classes
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    const { PostgresLookup } = require('./dist/src/data/postgresLookup');
    
    console.log('🔌 Creating PostgreSQL lookup...');
    const lookup = new PostgresLookup();
    
    console.log('🤖 Creating WhatsApp bot...');
    // Create bot with full functionality but safer error handling
    const bot = new WhatsAppBot(lookup);
    
    console.log('📱 Starting WhatsApp connection...');
    await bot.start();
    
  } catch (error) {
    console.error('❌ Simple bot failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

createSimpleBot();