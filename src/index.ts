import 'dotenv/config';
import { WhatsAppBot } from './bot/whatsapp';
import { VehicleLookup, DataProvider } from './data/vehicleLookup';
import { SheetsLookup } from './data/sheetsLookup';
import { ExcelLookup } from './data/excelLookup';

async function createLookupProvider(): Promise<VehicleLookup> {
  const provider = (process.env.DATA_PROVIDER as DataProvider) || 'sheets';

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

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting WhatsApp Vehicle Pricing Bot...');
    console.log(`📊 Data Provider: ${process.env.DATA_PROVIDER || 'sheets'}`);

    // Clear session if CLEAR_SESSION=true environment variable is set
    if (process.env.CLEAR_SESSION === 'true') {
      console.log('🔄 CLEAR_SESSION flag detected - clearing WhatsApp session...');
      const fs = require('fs');
      const path = require('path');
      
      const authPath = './auth';
      if (fs.existsSync(authPath)) {
        const files = fs.readdirSync(authPath);
        files.forEach((file: string) => {
          const filePath = path.join(authPath, file);
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted session file: ${file}`);
        });
        console.log('✅ Session cleared! New QR code will be generated.');
      } else {
        console.log('📁 No session files found to clear.');
      }
    }

    const lookup = await createLookupProvider();
    const bot = new WhatsAppBot(lookup);

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