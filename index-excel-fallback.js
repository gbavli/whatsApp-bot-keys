// Temporary fallback to Excel while we fix database issues
require('dotenv/config');

console.log('🚀 Starting Excel Fallback Bot (stable version)...');

async function createExcelBot() {
  try {
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    const { ExcelLookup } = require('./dist/src/data/excelLookup');
    
    console.log('📊 Using Excel data provider (fallback mode)');
    
    const lookup = new ExcelLookup('./keys.xlsx');
    const bot = new WhatsAppBot(lookup, './keys.xlsx');
    
    console.log('📱 Starting WhatsApp connection...');
    await bot.start();
    
  } catch (error) {
    console.error('❌ Excel bot failed:', error);
    process.exit(1);
  }
}

createExcelBot();