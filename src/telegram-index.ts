import 'dotenv/config';
import { TelegramBot } from './bot/telegram';
import { getVehicleLookup } from './data/providerFactory';

async function main(): Promise<void> {
  try {
    console.log('🤖 Starting Telegram Vehicle Pricing Bot...');
    
    // Check for bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    // Initialize database lookup
    console.log('📊 Initializing database connection...');
    const lookup = await getVehicleLookup();

    // Create and start Telegram bot
    console.log('🚀 Creating Telegram bot...');
    const bot = new TelegramBot(lookup, botToken);
    
    console.log('✅ Starting bot...');
    await bot.start();
    
  } catch (error) {
    console.error('❌ Failed to start Telegram bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down Telegram bot gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down Telegram bot gracefully...');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});