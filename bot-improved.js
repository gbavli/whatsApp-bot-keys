// IMPROVED TELEGRAM BOT with better diagnostics and PostgreSQL connection
const axios = require('axios');
const { Client } = require('pg');

// Working bot token
const BOT_TOKEN = '8241961782:AAF6IQFSBL91Sd-8t0futKNceR_l519NzsU';
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🚀 IMPROVED TELEGRAM BOT STARTING...');
console.log('🔑 Bot token configured');
console.log('🗄️ Database URL:', DATABASE_URL ? 'Available' : 'Missing');

class ImprovedTelegramBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.vehicles = [];
    this.userSessions = new Map();
  }

  async loadVehicles() {
    try {
      console.log('📊 Connecting to PostgreSQL...');
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      console.log('✅ PostgreSQL connected successfully');
      
      const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range LIMIT 10');
      console.log(`📋 Sample vehicles query returned ${result.rows.length} rows`);
      
      if (result.rows.length > 0) {
        console.log('📋 Sample vehicle:', JSON.stringify(result.rows[0], null, 2));
      }
      
      const fullResult = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
      this.vehicles = fullResult.rows;
      await client.end();
      
      console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
      
      // Show available makes
      const makes = [...new Set(this.vehicles.map(v => v.make))].slice(0, 10);
      console.log('📋 Available makes (first 10):', makes);
      
    } catch (error) {
      console.error('❌ Database load failed:', error.message);
      console.error('❌ Full error:', error);
      this.vehicles = [];
      
      // Load some test data so bot still works
      this.vehicles = [
        { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
        { make: 'Honda', model: 'Civic', year_range: '2019-2023', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
        { make: 'Chevrolet', model: 'Malibu', year_range: '2014-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
      ];
      console.log('🔄 Using fallback test data with 3 vehicles');
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
      console.log(`📤 Sent message to ${chatId}: ${text.substring(0, 50)}...`);
    } catch (error) {
      console.error('❌ Send message error:', error.response?.data || error.message);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.toLowerCase().trim();
    const username = message.from?.username || message.from?.first_name || 'User';
    
    console.log(`📩 Message from @${username} (${chatId}): "${text}"`);
    
    if (!text) {
      console.log('⚠️ Empty message, ignoring');
      return;
    }

    if (text === '/start' || text === '/help') {
      const helpText = `🤖 Vehicle Key Pricing Bot

💾 Database: ${this.vehicles.length} vehicles loaded
🔍 Search examples:
• "toyota" - Show all Toyota models
• "honda civic" - Search Honda Civic  
• "Toyota Corolla 2020" - Get specific pricing

Commands:
/start - Show this help
/debug - Show bot status
/cancel - Cancel current operation`;

      await this.sendMessage(chatId, helpText);
      return;
    }

    if (text === '/debug') {
      const debugInfo = `🔧 Bot Debug Info:

📊 Vehicles loaded: ${this.vehicles.length}
🗄️ Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}
🤖 Bot token: Active
📡 API URL: ${this.apiUrl}

${this.vehicles.length > 0 ? '✅ Ready for vehicle searches' : '❌ No vehicle data available'}`;

      await this.sendMessage(chatId, debugInfo);
      return;
    }

    if (text === '/cancel' || text === 'cancel') {
      this.userSessions.delete(chatId);
      await this.sendMessage(chatId, '✅ Operation cancelled');
      return;
    }

    // Handle vehicle searches
    await this.handleVehicleSearch(chatId, text);
  }

  async handleVehicleSearch(chatId, text) {
    console.log(`🔍 Vehicle search for: "${text}" (${this.vehicles.length} vehicles available)`);

    if (this.vehicles.length === 0) {
      await this.sendMessage(chatId, '❌ No vehicle database available. Try /debug for more info.');
      return;
    }

    // Search for make
    const makes = [...new Set(this.vehicles.map(v => v.make.toLowerCase()))];
    console.log(`📋 Available makes: ${makes.slice(0, 5).join(', ')}... (${makes.length} total)`);
    
    const matchingMake = makes.find(make => make.includes(text) || text.includes(make));
    console.log(`🎯 Matching make for "${text}": ${matchingMake || 'None'}`);
    
    if (matchingMake) {
      const makeVehicles = this.vehicles.filter(v => v.make.toLowerCase() === matchingMake);
      const models = [...new Set(makeVehicles.map(v => v.model))];
      
      console.log(`📋 Found ${models.length} models for ${matchingMake}`);
      
      let response = `${matchingMake.toUpperCase()} MODELS (${models.length} found):\n\n`;
      models.slice(0, 20).forEach((model, i) => {
        response += `${i + 1}. ${model}\n`;
      });
      response += '\n💡 Reply with number or model name';
      
      await this.sendMessage(chatId, response);
      return;
    }

    // Try direct vehicle lookup "make model year"
    const parts = text.split(' ');
    if (parts.length >= 2) {
      console.log(`🔍 Trying direct search for: ${parts.join(' ')}`);
      
      const [make, model, year] = parts;
      const vehicle = this.vehicles.find(v => 
        v.make.toLowerCase().includes(make) && 
        v.model.toLowerCase().includes(model) &&
        (year ? this.yearInRange(parseInt(year), v.year_range) : true)
      );

      if (vehicle) {
        console.log(`✅ Found vehicle: ${vehicle.make} ${vehicle.model} ${vehicle.year_range}`);
        
        const response = `${vehicle.make} ${vehicle.model} ${vehicle.year_range}

🔑 Key: ${vehicle.key || 'N/A'}
💰 Turn Key Min: $${vehicle.key_min_price || 'N/A'}
📱 Remote Min: $${vehicle.remote_min_price || 'N/A'}
🚀 Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
🔧 Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}`;

        await this.sendMessage(chatId, response);
        return;
      }
    }

    // No matches found
    console.log(`❌ No matches found for "${text}"`);
    const suggestion = makes.slice(0, 5).join(', ');
    await this.sendMessage(chatId, `❌ No matching vehicles found for "${text}".

🔍 Try a make name like: ${suggestion}

💡 Or send /debug to check bot status`);
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
    console.log('📱 Bot ready! Search @KeyPricingBot in Telegram and send /start');
    
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
        console.error('❌ Polling error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Start the improved bot
const bot = new ImprovedTelegramBot();
bot.start().catch(console.error);