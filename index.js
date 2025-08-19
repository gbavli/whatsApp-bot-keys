require('dotenv/config');
const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
const { SheetsLookup } = require('./dist/src/data/sheetsLookup');
const { ExcelLookup } = require('./dist/src/data/excelLookup');

async function createLookupProvider() {
  const provider = process.env.DATA_PROVIDER || 'excel';

  switch (provider) {
    case 'sheets': {
      const sheetsId = process.env.SHEETS_ID;
      const range = process.env.SHEETS_RANGE || 'Sheet1!A:N';
      const cacheTTL = parseInt(process.env.CACHE_TTL_MINUTES || '5', 10);

      if (!sheetsId) {
        throw new Error('SHEETS_ID environment variable is required when using sheets provider');
      }

      return new SheetsLookup(sheetsId, range, cacheTTL);
    }

    case 'excel': {
      const filePath = process.env.EXCEL_PATH || './keys.xlsx';
      return new ExcelLookup(filePath);
    }

    default:
      throw new Error(`Unknown data provider: ${provider}. Use 'sheets' or 'excel'.`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting WhatsApp Vehicle Pricing Bot...');
    console.log(`📊 Data Provider: ${process.env.DATA_PROVIDER || 'excel'}`);

    const lookup = await createLookupProvider();
    
    // Pass Excel file path for price updates (only for Excel provider)
    const provider = process.env.DATA_PROVIDER || 'excel';
    let excelFilePath = undefined;
    if (provider === 'excel') {
      excelFilePath = process.env.EXCEL_PATH || './keys.xlsx';
      console.log('🔧 Price update commands enabled for Excel file');
    }
    
    const bot = new WhatsAppBot(lookup, excelFilePath);

    console.log('📱 Initializing WhatsApp connection...');
    console.log('📋 Scan the QR code below with your WhatsApp to connect:');
    console.log('');

    await bot.start();
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});