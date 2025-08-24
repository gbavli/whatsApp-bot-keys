// Minimal version to test Railway deployment
require('dotenv/config');
const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
const { PostgresLookup } = require('./dist/src/data/postgresLookup');

async function createMinimalBot() {
  try {
    console.log('🚀 Starting MINIMAL WhatsApp bot...');
    console.log('📊 Data Provider: postgres (minimal test)');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    
    // Debug environment variables
    console.log('🔍 Environment debugging:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'undefined');
    console.log('- DATABASE_URL starts with:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'undefined');
    console.log('- PGHOST:', process.env.PGHOST || 'undefined');
    console.log('- PGPORT:', process.env.PGPORT || 'undefined');
    
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