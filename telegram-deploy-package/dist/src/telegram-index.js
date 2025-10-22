"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const telegram_1 = require("./bot/telegram");
const providerFactory_1 = require("./data/providerFactory");
async function main() {
    try {
        console.log('🤖 Starting Telegram Vehicle Pricing Bot...');
        // Check for bot token
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        // Initialize database lookup
        console.log('📊 Initializing database connection...');
        const lookup = await (0, providerFactory_1.getVehicleLookup)();
        // Create and start Telegram bot
        console.log('🚀 Creating Telegram bot...');
        const bot = new telegram_1.TelegramBot(lookup, botToken);
        console.log('✅ Starting bot...');
        await bot.start();
    }
    catch (error) {
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
