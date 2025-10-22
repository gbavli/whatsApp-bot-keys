// FINAL WORKING TELEGRAM BOT - NO DEPENDENCIES ON EXTERNAL CONFIG
const axios = require('axios');
const { Client } = require('pg');

// HARDCODE THE WORKING TOKEN (temporary fix)
const BOT_TOKEN = '8241961782:AAF6IQFSBL91Sd-8t0futKNceR_l519NzsU';
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🚀 STARTING FINAL TELEGRAM BOT...');

class SimpleTelegramBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.vehicles = [];
    this.userSessions = new Map();
  }

  async loadVehicles() {
    try {
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
      this.vehicles = result.rows;
      await client.end();
      
      console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
    } catch (error) {
      console.error('❌ Database load failed:', error.message);
      // Fallback to empty array - bot will still work for basic commands
      this.vehicles = [];
    }
  }

  async sendMessage(chatId, text, replyMarkup = null) {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
        ...(replyMarkup && { reply_markup: replyMarkup })
      };

      await axios.post(`${this.apiUrl}/sendMessage`, payload);
    } catch (error) {
      console.error('Send message error:', error.response?.data || error.message);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.toLowerCase().trim();
    
    if (!text) return;

    if (text === '/start' || text === '/help') {
      await this.sendMessage(chatId, `🤖 Vehicle Key Pricing Bot

Send a vehicle make to search (e.g., "toyota")
Or send "Make Model Year" (e.g., "Toyota Corolla 2020")

Commands:
/start - Show this help
/cancel - Cancel current operation`);
      return;
    }

    if (text === '/cancel' || text === 'cancel') {
      this.userSessions.delete(chatId);
      await this.sendMessage(chatId, '✅ Operation cancelled');
      return;
    }

    // Simple vehicle search
    const makes = [...new Set(this.vehicles.map(v => v.make.toLowerCase()))];
    const matchingMake = makes.find(make => make.includes(text) || text.includes(make));
    
    if (matchingMake) {
      const makeVehicles = this.vehicles.filter(v => v.make.toLowerCase() === matchingMake);
      const models = [...new Set(makeVehicles.map(v => v.model))];
      
      let response = `${matchingMake.toUpperCase()} MODELS:\n\n`;
      models.slice(0, 20).forEach((model, i) => {
        response += `${i + 1}. ${model}\n`;
      });
      response += '\nReply with number or model name';
      
      await this.sendMessage(chatId, response);
      return;
    }

    // Try direct vehicle lookup
    const parts = text.split(' ');
    if (parts.length >= 3) {
      const [make, model, year] = parts;
      const vehicle = this.vehicles.find(v => 
        v.make.toLowerCase().includes(make) && 
        v.model.toLowerCase().includes(model) &&
        this.yearInRange(parseInt(year), v.year_range)
      );

      if (vehicle) {
        const response = `${vehicle.make} ${vehicle.model} ${vehicle.year_range}

Key: ${vehicle.key || 'N/A'}
Turn Key Min: $${vehicle.key_min_price || 'N/A'}
Remote Min: $${vehicle.remote_min_price || 'N/A'}
Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}`;

        await this.sendMessage(chatId, response);
        return;
      }
    }

    await this.sendMessage(chatId, 'No matching vehicles found. Try a make name like "toyota" or "honda".');
  }

  yearInRange(year, rangeStr) {
    if (!rangeStr || !year) return false;
    
    if (rangeStr.includes('-')) {
      const [start, end] = rangeStr.split('-').map(y => parseInt(y.trim()));
      return year >= start && year <= end;
    }
    
    return parseInt(rangeStr) === year;
  }

  async start() {
    console.log('📊 Loading vehicle data...');
    await this.loadVehicles();
    
    console.log('🚀 Starting message polling...');
    
    while (true) {
      try {
        const response = await axios.get(`${this.apiUrl}/getUpdates`, {
          params: { offset: this.offset, timeout: 10 }
        });

        const updates = response.data.result;
        
        for (const update of updates) {
          if (update.message) {
            await this.handleMessage(update.message);
          }
          this.offset = update.update_id + 1;
        }
      } catch (error) {
        if (error.response?.status === 401) {
          console.error('❌ Bot token invalid');
          break;
        }
        console.error('Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Start the bot
const bot = new SimpleTelegramBot();
bot.start().catch(console.error);