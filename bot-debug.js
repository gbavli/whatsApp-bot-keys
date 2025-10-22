// DEBUG VERSION - Shows detailed environment info
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = '8241961782:AAF6IQFSBL91Sd-8t0futKNceR_l519NzsU';

console.log('🔍 DEBUGGING RAILWAY ENVIRONMENT...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'undefined');
console.log('All environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('railway')) {
    console.log(`  ${key}:`, process.env[key]);
  }
});

class DebugBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.vehicles = [];
  }

  async loadVehicles() {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    console.log('🔍 DATABASE CONNECTION ATTEMPT:');
    console.log('  DATABASE_URL from env:', DATABASE_URL ? 'EXISTS' : 'MISSING');
    
    if (!DATABASE_URL) {
      console.log('❌ No DATABASE_URL found in environment');
      console.log('Available env vars containing "postgres" or "database":');
      Object.keys(process.env).forEach(key => {
        if (key.toLowerCase().includes('postgres') || key.toLowerCase().includes('database')) {
          console.log(`  ${key}: ${process.env[key]}`);
        }
      });
      
      // Use test data
      this.vehicles = [
        { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
        { make: 'Honda', model: 'Civic', year_range: '2019-2023', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
        { make: 'Chevrolet', model: 'Malibu', year_range: '2014-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
      ];
      console.log('🔄 Using fallback test data');
      return;
    }

    try {
      console.log('🔗 Attempting PostgreSQL connection...');
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      console.log('✅ PostgreSQL connected successfully');
      
      const result = await client.query('SELECT COUNT(*) FROM vehicles');
      const count = result.rows[0].count;
      console.log(`📊 Total vehicles in database: ${count}`);
      
      if (count > 0) {
        const fullResult = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range LIMIT 1000');
        this.vehicles = fullResult.rows;
        console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
        
        const makes = [...new Set(this.vehicles.map(v => v.make))].slice(0, 5);
        console.log('📋 Sample makes:', makes.join(', '));
      } else {
        console.log('⚠️ Database is empty');
        this.vehicles = [];
      }
      
      await client.end();
      
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('Full error:', error);
      
      // Use test data as fallback
      this.vehicles = [
        { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
        { make: 'Honda', model: 'Civic', year_range: '2019-2023', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
        { make: 'Chevrolet', model: 'Malibu', year_range: '2014-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
      ];
      console.log('🔄 Using fallback test data due to connection error');
    }
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

    if (text === '/debug' || text === '/env') {
      const envInfo = `🔍 ENVIRONMENT DEBUG:

📊 Vehicles loaded: ${this.vehicles.length}
🗄️ DATABASE_URL: ${process.env.DATABASE_URL ? 'SET ✅' : 'MISSING ❌'}
🌐 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}
🚀 Railway deployment: ${process.env.RAILWAY_DEPLOYMENT_ID ? 'Active' : 'Not detected'}

Database URL preview: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) + '...' : 'None'}

Available makes: ${[...new Set(this.vehicles.map(v => v.make))].join(', ') || 'None'}`;

      await this.sendMessage(chatId, envInfo);
      return;
    }

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 DEBUG Bot Active

Send /debug for detailed info
Try: toyota, honda, chevrolet

Vehicles loaded: ${this.vehicles.length}`);
      return;
    }

    // Simple vehicle search
    const makes = [...new Set(this.vehicles.map(v => v.make.toLowerCase()))];
    const matchingMake = makes.find(make => make.includes(text) || text.includes(make));
    
    if (matchingMake) {
      const makeVehicles = this.vehicles.filter(v => v.make.toLowerCase() === matchingMake);
      const models = [...new Set(makeVehicles.map(v => v.model))];
      
      let response = `${matchingMake.toUpperCase()} MODELS:\n\n`;
      models.forEach((model, i) => {
        response += `${i + 1}. ${model}\n`;
      });
      
      await this.sendMessage(chatId, response);
    } else {
      await this.sendMessage(chatId, `❌ No matches for "${text}". Try: ${makes.slice(0, 3).join(', ')}`);
    }
  }

  async start() {
    await this.loadVehicles();
    
    console.log('🚀 Debug bot started - waiting for messages...');
    
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

const bot = new DebugBot();
bot.start().catch(console.error);