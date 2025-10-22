// SIMPLE WORKING TELEGRAM BOT
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = '8241961782:AAH9i6LbchOh23pGzAkCLiPmPwH5iFRQOGo';

class WorkingBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.vehicles = [];
    this.userSessions = new Map();
  }

  async loadVehicles() {
    // Try all possible Railway database URLs
    const possibleUrls = [
      process.env.DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.POSTGRESQL_URL,
      process.env.DB_URL
    ].filter(Boolean);

    console.log('🔍 Testing database connections...');
    
    for (const url of possibleUrls) {
      try {
        const client = new Client({
          connectionString: url,
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
        this.vehicles = result.rows;
        await client.end();
        
        console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
        return;
        
      } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}`);
      }
    }

    // Fallback data
    console.log('🔄 Using test data');
    this.vehicles = [
      { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
      { make: 'Honda', model: 'Civic', year_range: '2019-2023', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' }
    ];
  }

  async sendMessage(chatId, text) {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text
      });
    } catch (error) {
      console.error('❌ Send error:', error.message);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.toLowerCase().trim();
    
    if (!text) return;

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 Vehicle Key Pricing Bot

📊 Status: ${this.vehicles.length} vehicles loaded
🔍 Database: ${this.vehicles.length > 100 ? 'Connected ✅' : 'Test data'}

Try: toyota, honda, acura
Send /debug for info`);
      return;
    }

    if (text === '/debug') {
      await this.sendMessage(chatId, `🔧 Bot Status:
      
📊 Vehicles: ${this.vehicles.length}
🤖 Token: Active
🗄️ Database: ${process.env.DATABASE_URL ? 'Connected' : 'Missing'}
      
Available makes: ${[...new Set(this.vehicles.map(v => v.make))].slice(0, 5).join(', ')}`);
      return;
    }

    // Handle interactive selections
    let session = this.userSessions.get(chatId) || { state: 'idle' };

    // Handle number selections for models
    if (session.state === 'selecting_model' && /^\d+$/.test(text)) {
      const modelIndex = parseInt(text) - 1;
      if (session.models && modelIndex >= 0 && modelIndex < session.models.length) {
        const selectedModel = session.models[modelIndex];
        
        // Get year ranges for this make/model
        const yearRanges = [...new Set(
          this.vehicles
            .filter(v => v.make.toLowerCase() === session.make.toLowerCase() && 
                        v.model.toLowerCase() === selectedModel.toLowerCase())
            .map(v => v.year_range)
        )];

        if (yearRanges.length > 0) {
          let response = `${session.make} ${selectedModel} - SELECT YEAR RANGE:\n\n`;
          yearRanges.forEach((range, i) => {
            response += `${i + 1}. ${range}\n`;
          });
          response += '\nReply with number or type "cancel"';

          session.state = 'selecting_year';
          session.selectedModel = selectedModel;
          session.yearRanges = yearRanges;
          this.userSessions.set(chatId, session);

          await this.sendMessage(chatId, response);
          return;
        }
      }
    }

    // Handle year selection
    if (session.state === 'selecting_year' && /^\d+$/.test(text)) {
      const yearIndex = parseInt(text) - 1;
      if (session.yearRanges && yearIndex >= 0 && yearIndex < session.yearRanges.length) {
        const selectedYearRange = session.yearRanges[yearIndex];
        
        // Find the specific vehicle
        const vehicle = this.vehicles.find(v => 
          v.make.toLowerCase() === session.make.toLowerCase() &&
          v.model.toLowerCase() === session.selectedModel.toLowerCase() &&
          v.year_range === selectedYearRange
        );

        if (vehicle) {
          const response = `${vehicle.make} ${vehicle.model} ${vehicle.year_range}

🔑 Key: ${vehicle.key || 'N/A'}
💰 Turn Key Min: $${vehicle.key_min_price || 'N/A'}
📱 Remote Min: $${vehicle.remote_min_price || 'N/A'}
🚀 Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
🔧 Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}

💡 Press 9 to update pricing`;

          this.userSessions.set(chatId, { state: 'idle', lastVehicle: vehicle });
          await this.sendMessage(chatId, response);
          return;
        }
      }
    }

    if (text === 'cancel') {
      this.userSessions.delete(chatId);
      await this.sendMessage(chatId, '✅ Cancelled. Send any make name to search.');
      return;
    }

    // Make search
    const makes = [...new Set(this.vehicles.map(v => v.make.toLowerCase()))];
    const matchingMake = makes.find(make => make.includes(text) || text.includes(make));
    
    if (matchingMake) {
      const makeVehicles = this.vehicles.filter(v => v.make.toLowerCase() === matchingMake);
      const models = [...new Set(makeVehicles.map(v => v.model))];
      
      let response = `${matchingMake.toUpperCase()} MODELS:\n\n`;
      models.slice(0, 30).forEach((model, i) => {
        response += `${i + 1}. ${model}\n`;
      });
      response += `\n💡 Reply with number or model name`;
      
      // Set session for interactive flow
      this.userSessions.set(chatId, {
        state: 'selecting_model',
        make: matchingMake,
        models: models
      });
      
      await this.sendMessage(chatId, response);
    } else {
      await this.sendMessage(chatId, `❌ No matches for "${text}". Try: ${makes.slice(0, 5).join(', ')}`);
    }
  }

  async start() {
    await this.loadVehicles();
    
    console.log('🚀 Working bot started!');
    console.log(`📊 Status: ${this.vehicles.length} vehicles loaded`);
    
    while (true) {
      try {
        const response = await axios.get(`${this.apiUrl}/getUpdates`, {
          params: { offset: this.offset, timeout: 10 }
        });

        for (const update of response.data.result) {
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

const bot = new WorkingBot();
bot.start().catch(console.error);