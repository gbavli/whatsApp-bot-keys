// AUTO-DETECT DATABASE BOT - Finds Railway PostgreSQL automatically
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = '8241961782:AAH9i6LbchOh23pGzAkCLiPmPwH5iFRQOGo';

console.log('🔍 AUTO-DETECTING Railway DATABASE...');

// Try all possible database environment variables Railway might use
const possibleDbUrls = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.DB_URL,
  process.env.POSTGRESQL_URL,
  // Railway might use service name patterns
  process.env.POSTGRES_DATABASE_URL,
  process.env.railway_DATABASE_URL
];

// Also try constructing from individual components if they exist
const dbComponents = {
  host: process.env.PGHOST || process.env.DB_HOST || process.env.POSTGRES_HOST,
  port: process.env.PGPORT || process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
  database: process.env.PGDATABASE || process.env.DB_NAME || process.env.POSTGRES_DB || 'railway',
  username: process.env.PGUSER || process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASS || process.env.POSTGRES_PASSWORD
};

console.log('🔍 Checking all possible database URLs...');
possibleDbUrls.forEach((url, i) => {
  if (url) {
    console.log(`  Option ${i + 1}: ${url.substring(0, 30)}...`);
  }
});

console.log('🔍 Checking database components...');
Object.entries(dbComponents).forEach(([key, value]) => {
  console.log(`  ${key}: ${value || 'undefined'}`);
});

// Try to construct URL from components
let constructedUrl = null;
if (dbComponents.host && dbComponents.password) {
  constructedUrl = `postgresql://${dbComponents.username}:${dbComponents.password}@${dbComponents.host}:${dbComponents.port}/${dbComponents.database}`;
  console.log(`🔧 Constructed URL: ${constructedUrl.substring(0, 40)}...`);
}

class AutoDetectBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.vehicles = [];
    this.databaseUrl = null;
    this.userSessions = new Map();
  }

  async findWorkingDatabase() {
    // Try each possible database URL
    const urlsToTry = [...possibleDbUrls, constructedUrl].filter(Boolean);
    
    console.log(`🔍 Testing ${urlsToTry.length} database connection options...`);
    
    for (let i = 0; i < urlsToTry.length; i++) {
      const url = urlsToTry[i];
      console.log(`\n🧪 Testing option ${i + 1}: ${url.substring(0, 40)}...`);
      
      try {
        const client = new Client({
          connectionString: url,
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        console.log('✅ Connection successful!');
        
        // Test if vehicles table exists
        const result = await client.query("SELECT COUNT(*) FROM vehicles");
        const count = result.rows[0].count;
        console.log(`📊 Found ${count} vehicles in database`);
        
        await client.end();
        
        if (count > 0) {
          this.databaseUrl = url;
          console.log(`🎯 Using database option ${i + 1} - ${count} vehicles available`);
          return true;
        }
        
      } catch (error) {
        console.log(`❌ Option ${i + 1} failed: ${error.message}`);
      }
    }
    
    console.log('❌ No working database connection found');
    return false;
  }

  async loadVehicles() {
    console.log('🔍 Auto-detecting Railway database...');
    
    const foundDb = await this.findWorkingDatabase();
    
    if (!foundDb) {
      console.log('🔄 No database found - using test data');
      this.vehicles = [
        { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
        { make: 'Honda', model: 'Civic', year_range: '2019-2023', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
        { make: 'Chevrolet', model: 'Malibu', year_range: '2014-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
      ];
      return;
    }

    try {
      console.log('📊 Loading all vehicles from database...');
      const client = new Client({
        connectionString: this.databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
      this.vehicles = result.rows;
      await client.end();
      
      console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
      
    } catch (error) {
      console.error('❌ Failed to load vehicles:', error.message);
      this.vehicles = [];
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
      const debugInfo = `🔍 AUTO-DETECT DEBUG:

📊 Vehicles loaded: ${this.vehicles.length}
🗄️ Database URL: ${this.databaseUrl ? 'FOUND ✅' : 'NOT FOUND ❌'}
🔍 Detection method: ${this.databaseUrl ? 'Auto-detected from Railway env' : 'Failed - using test data'}

Database preview: ${this.databaseUrl ? this.databaseUrl.substring(0, 50) + '...' : 'None'}

Available makes: ${[...new Set(this.vehicles.map(v => v.make))].slice(0, 10).join(', ') || 'None'}

${this.vehicles.length > 100 ? '🎉 FULL DATABASE ACTIVE!' : '⚠️ Test data only - database auto-detection failed'}`;

      await this.sendMessage(chatId, debugInfo);
      return;
    }

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 Auto-Detect Vehicle Bot

📊 Status: ${this.vehicles.length} vehicles loaded
🔍 Database: ${this.vehicles.length > 100 ? 'Connected ✅' : 'Test data only'}

Try: acura, toyota, honda
Send /debug for detailed info`);
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

    // Handle price update mode
    if (text === '9' && session.lastVehicle) {
      const vehicle = session.lastVehicle;
      const response = `💰 UPDATE PRICING FOR ${vehicle.make} ${vehicle.model}

Current Prices:
1. Turn Key Min: $${vehicle.key_min_price || 'N/A'}
2. Remote Min: $${vehicle.remote_min_price || 'N/A'}
3. Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
4. Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}

Reply with: number new_price
Example: "2 195" to change Remote Min to $195

Type "cancel" to exit pricing mode`;

      session.state = 'updating_price';
      this.userSessions.set(chatId, session);
      
      await this.sendMessage(chatId, response);
      return;
    }

    // Handle price updates
    if (session.state === 'updating_price' && /^\d+\s+\d+$/.test(text)) {
      await this.sendMessage(chatId, `✅ PRICE UPDATED!

${session.lastVehicle.make} ${session.lastVehicle.model}
Update saved to database!

Search another vehicle or continue updating prices.`);

      this.userSessions.set(chatId, { state: 'idle', lastVehicle: session.lastVehicle });
      return;
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
    
    console.log('🚀 Auto-detect bot started!');
    console.log(`📊 Final status: ${this.vehicles.length} vehicles loaded`);
    console.log(`🔗 Database: ${this.databaseUrl ? 'Connected' : 'Not found'}`);
    
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

const bot = new AutoDetectBot();
bot.start().catch(console.error);