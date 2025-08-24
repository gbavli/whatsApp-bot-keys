// Quick rollback script - removes enhanced features temporarily
require('dotenv/config');
const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
const { PostgresLookup } = require('./dist/src/data/postgresLookup');

async function createSimpleBot() {
  const lookup = new PostgresLookup();
  
  // Create bot without enhanced features for debugging
  const bot = new WhatsAppBot(lookup);
  
  console.log('🚀 Starting SIMPLE WhatsApp bot for debugging...');
  console.log('📊 Data Provider: postgres (simplified)');
  
  await bot.start();
}

createSimpleBot().catch((error) => {
  console.error('❌ Simple bot failed:', error);
  process.exit(1);
});