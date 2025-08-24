// Minimal version to test Railway deployment
require('dotenv/config');
const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
const { PostgresLookup } = require('./dist/src/data/postgresLookup');

async function createMinimalBot() {
  try {
    console.log('🚀 Starting MINIMAL WhatsApp bot...');
    console.log('📊 Data Provider: postgres (minimal test)');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    
    const lookup = new PostgresLookup();
    
    // Test database connection first
    console.log('🔌 Testing database connection...');
    await lookup.connect();
    console.log('✅ Database connected successfully');
    
    // Create simple bot without enhanced features
    const bot = new WhatsAppBot(lookup);
    
    console.log('📱 Starting WhatsApp connection...');
    await bot.start();
    
  } catch (error) {
    console.error('❌ Minimal bot failed:', error);
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

createMinimalBot();