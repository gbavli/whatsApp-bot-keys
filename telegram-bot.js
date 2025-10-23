// TELEGRAM BOT WITH COMPLETE WHATSAPP LOGIC
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = '8278468804:AAH-32P_K0HA_iWr1WcTJsraqViOXMSNQgw';

class VehiclePricingBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.userSessions = new Map();
    this.vehicles = [];
    this.databaseUrl = null;
    console.log('🤖 Vehicle Pricing Bot Starting...');
  }

  async loadVehicles() {
    // Try to connect to database from environment
    const possibleUrls = [
      process.env.DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.POSTGRESQL_URL,
      process.env.DB_URL
    ].filter(Boolean);

    console.log('🔍 Looking for database connection...');
    
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
        
        this.databaseUrl = url;
        console.log(`✅ Connected to database: ${this.vehicles.length} vehicles loaded`);
        return;
        
      } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}`);
      }
    }

    // Fallback to sample data for testing
    console.log('🔄 Using sample data - no database connection');
    this.vehicles = [
      { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
      { make: 'Toyota', model: 'Camry', year_range: '2018-2023', key: 'TOY44', key_min_price: '160', remote_min_price: '210', p2s_min_price: '320', ignition_min_price: '270' },
      { make: 'Honda', model: 'Civic', year_range: '2019-2024', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
      { make: 'Honda', model: 'Accord', year_range: '2017-2022', key: 'HON13', key_min_price: '170', remote_min_price: '220', p2s_min_price: '340', ignition_min_price: '280' },
      { make: 'Chevrolet', model: 'Malibu', year_range: '2016-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
    ];
  }

  async sendMessage(chatId, text) {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text
      });
      console.log(`✅ Sent to ${chatId}`);
    } catch (error) {
      console.error('❌ Send error:', error.message);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.toLowerCase().trim();
    const username = message.from?.username || message.from?.first_name || 'User';
    
    console.log(`📩 @${username}: "${text}"`);
    
    if (!text) return;

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 Vehicle Key Pricing Bot

📊 Database: ${this.vehicles.length} vehicles loaded
🔍 Search examples:
• toyota (show models)
• toyota corolla (show years)  
• Toyota Corolla 2022 (get pricing)

Try: toyota, honda, chevrolet`);
      return;
    }

    if (text === '/debug') {
      await this.sendMessage(chatId, `🔧 Bot Debug:
      
📊 Vehicles: ${this.vehicles.length}
🗄️ Database: ${this.databaseUrl ? 'Connected' : 'Sample data'}
💾 Sessions: ${this.userSessions.size} active

Available makes: ${[...new Set(this.vehicles.map(v => v.make))].slice(0, 5).join(', ')}`);
      return;
    }

    if (text === 'cancel') {
      this.userSessions.delete(chatId);
      await this.sendMessage(chatId, '✅ Cancelled. Send any make name to search.');
      return;
    }

    // Handle interactive sessions - CORE WHATSAPP LOGIC
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

Key: ${vehicle.key || 'N/A'}
Turn Key Min: $${vehicle.key_min_price || 'N/A'}
Remote Min: $${vehicle.remote_min_price || 'N/A'}
Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}

update pricing ? press 9`;

          this.userSessions.set(chatId, { state: 'idle', lastVehicle: vehicle });
          await this.sendMessage(chatId, response);
          return;
        }
      }
    }

    // Handle pricing updates
    if (text === '9' && session.lastVehicle) {
      const vehicle = session.lastVehicle;
      await this.sendMessage(chatId, `💰 UPDATE PRICING FOR ${vehicle.make} ${vehicle.model}

Current Prices:
1. Turn Key Min: $${vehicle.key_min_price || 'N/A'}
2. Remote Min: $${vehicle.remote_min_price || 'N/A'}
3. Push-to-Start Min: $${vehicle.p2s_min_price || 'N/A'}
4. Ignition Change/Fix Min: $${vehicle.ignition_min_price || 'N/A'}

Reply with: number new_price
Example: "2 195" to change Remote Min to $195

Type "cancel" to exit pricing mode`);

      session.state = 'updating_price';
      this.userSessions.set(chatId, session);
      return;
    }

    // Handle direct vehicle search or make search
    await this.handleVehicleSearch(chatId, text);
  }

  async handleVehicleSearch(chatId, searchText) {
    console.log(`🔍 Searching: "${searchText}"`);
    
    // Parse input using WhatsApp logic
    const parsed = this.parseUserInput(searchText);
    
    if (!parsed) {
      await this.sendMessage(chatId, `❌ Try: toyota, honda civic, Toyota Corolla 2022`);
      return;
    }

    if (parsed.type === 'full') {
      // Full search: Make Model Year
      const result = this.matchVehicle(parsed.make, parsed.model, parsed.year);
      if (result) {
        const response = `${result.make} ${result.model} ${result.year_range}

Key: ${result.key || 'N/A'}
Turn Key Min: $${result.key_min_price || 'N/A'}
Remote Min: $${result.remote_min_price || 'N/A'}
Push-to-Start Min: $${result.p2s_min_price || 'N/A'}
Ignition Change/Fix Min: $${result.ignition_min_price || 'N/A'}

update pricing ? press 9`;
        
        await this.sendMessage(chatId, response);
        this.userSessions.set(chatId, { state: 'idle', lastVehicle: result });
        return;
      } else {
        await this.sendMessage(chatId, `❌ No matching record found for ${parsed.make} ${parsed.model} ${parsed.year}`);
        return;
      }
    }

    if (parsed.type === 'make_model') {
      // Show year ranges for make/model
      const matches = this.vehicles.filter(v => 
        this.normalizeString(v.make) === this.normalizeString(parsed.make) &&
        this.normalizeString(v.model) === this.normalizeString(parsed.model)
      );
      
      if (matches.length > 0) {
        let response = `🚗 ${matches[0].make.toUpperCase()} ${matches[0].model.toUpperCase()}:\n\n`;
        matches.forEach((vehicle, i) => {
          response += `${i + 1}. ${vehicle.year_range}\n`;
        });
        response += `\n💡 Try: "${parsed.make} ${parsed.model} 2022"`;
        
        await this.sendMessage(chatId, response);
        return;
      }
    }

    if (parsed.type === 'make_only') {
      // Show models for make - WITH INTERACTIVE SESSION
      const makeVehicles = this.vehicles.filter(v => 
        this.normalizeString(v.make) === this.normalizeString(parsed.make)
      );
      
      if (makeVehicles.length > 0) {
        const models = [...new Set(makeVehicles.map(v => v.model))];
        
        let response = `🚗 ${makeVehicles[0].make.toUpperCase()} MODELS:\n\n`;
        models.forEach((model, i) => {
          response += `${i + 1}. ${model}\n`;
        });
        response += `\n💡 Reply with number or model name`;
        
        // Set session for interactive selection
        this.userSessions.set(chatId, {
          state: 'selecting_model',
          make: makeVehicles[0].make,
          models: models
        });
        
        await this.sendMessage(chatId, response);
        return;
      }
    }

    // No matches
    const makes = [...new Set(this.vehicles.map(v => v.make))];
    await this.sendMessage(chatId, `❌ No matches for "${searchText}"

Available makes: ${makes.slice(0, 5).join(', ')}`);
  }

  // WhatsApp parsing logic
  parseUserInput(input) {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length < 1) return null;

    const make = parts[0];
    if (!make) return null;

    if (parts.length === 1) {
      const singleYear = parseInt(make, 10);
      if (!isNaN(singleYear) && singleYear >= 1900 && singleYear <= 2050) {
        return null;
      }
      return { make, type: 'make_only' };
    }

    const firstYear = parseInt(parts[0], 10);
    const hasYearFirst = !isNaN(firstYear) && firstYear >= 1900 && firstYear <= 2050;

    if (hasYearFirst && parts.length >= 3) {
      const make = parts[1];
      const model = parts.slice(2).join(' ');
      return { make, model, year: firstYear, type: 'full' };
    }

    const lastPart = parts[parts.length - 1];
    if (!lastPart) return null;
    
    const year = parseInt(lastPart, 10);
    const hasYearLast = !isNaN(year) && year >= 1900 && year <= 2050;

    if (hasYearLast && parts.length >= 3) {
      const model = parts.slice(1, -1).join(' ');
      return { make, model, year, type: 'full' };
    } else if (!hasYearLast && parts.length >= 2) {
      const model = parts.slice(1).join(' ');
      return { make, model: model, type: 'make_model' };
    }

    return null;
  }

  matchVehicle(make, model, year) {
    const potentialMatches = this.vehicles.filter(row =>
      this.normalizeString(row.make) === this.normalizeString(make) &&
      this.normalizeString(row.model) === this.normalizeString(model)
    );

    if (potentialMatches.length === 0) return null;

    const yearMatches = potentialMatches.filter(row => this.isYearInRange(year, row.year_range));
    if (yearMatches.length === 0) return null;

    const bestMatch = yearMatches.reduce((best, current) => {
      const bestSpan = this.getRangeSpan(best.year_range);
      const currentSpan = this.getRangeSpan(current.year_range);
      return currentSpan < bestSpan ? current : best;
    });

    return bestMatch;
  }

  normalizeString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  isYearInRange(year, yearRange) {
    if (!yearRange) return false;

    if (/^\d{4}$/.test(yearRange.trim())) {
      return parseInt(yearRange.trim(), 10) === year;
    }

    const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const startYear = parseInt(rangeMatch[1], 10);
      const endYear = parseInt(rangeMatch[2], 10);
      return year >= startYear && year <= endYear;
    }

    return false;
  }

  getRangeSpan(yearRange) {
    if (/^\d{4}$/.test(yearRange.trim())) {
      return 1;
    }

    const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const startYear = parseInt(rangeMatch[1], 10);
      const endYear = parseInt(rangeMatch[2], 10);
      return endYear - startYear + 1;
    }

    return Number.MAX_SAFE_INTEGER;
  }

  async start() {
    await this.loadVehicles();
    
    console.log('🚀 Bot started with complete WhatsApp logic!');
    console.log(`📊 ${this.vehicles.length} vehicles available`);
    console.log('📱 Try /start to test');
    
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
        console.error('❌ Error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Test token and start
async function main() {
  try {
    const testResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log('✅ Bot token valid:', testResponse.data.result.username);
    
    const bot = new VehiclePricingBot();
    bot.start().catch(console.error);
  } catch (error) {
    console.error('❌ Bot token test failed');
    process.exit(1);
  }
}

main();