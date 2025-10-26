// CLEAN TELEGRAM BOT BASED ON WORKING WHATSAPP CODE
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = process.env.BOT_TOKEN || '8278468804:AAH-32P_K0HA_iWr1WcTJsraqViOXMSNQgw';

class CleanTelegramBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.sessions = new Map(); // Clean session management like WhatsApp
    this.vehicles = [];
    this.databaseUrl = null;
    this.isLoading = false;
    this.instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`🤖 Clean Telegram Bot Starting... [Instance: ${this.instanceId}]`);
  }

  async loadVehicles() {
    if (this.isLoading) return;
    this.isLoading = true;

    const DATABASE_URL = process.env.DATABASE_URL;
    
    console.log(`🔍 [${this.instanceId}] DATABASE_URL exists: ${!!DATABASE_URL}`);
    console.log(`🔍 [${this.instanceId}] DATABASE_URL preview: ${DATABASE_URL ? DATABASE_URL.substring(0, 20) + '...' : 'undefined'}`);
    
    if (!DATABASE_URL) {
      console.log(`❌ [${this.instanceId}] No DATABASE_URL found`);
      this.vehicles = this.getFallbackData();
      this.isLoading = false;
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🔍 [${this.instanceId}] Connecting to PostgreSQL... (attempt ${retryCount + 1})`);
        const client = new Client({
          connectionString: DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
          query_timeout: 30000
        });
        
        await client.connect();
        console.log(`✅ [${this.instanceId}] PostgreSQL connected`);
        
        const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
        
        if (result.rows.length > 100) { // Sanity check
          this.vehicles = result.rows;
          this.databaseUrl = DATABASE_URL;
          console.log(`✅ [${this.instanceId}] Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
          await client.end();
          this.isLoading = false;
          return;
        } else {
          console.log(`⚠️ [${this.instanceId}] Got only ${result.rows.length} vehicles, retrying...`);
          await client.end();
        }
        
      } catch (error) {
        console.error(`❌ [${this.instanceId}] Database error (attempt ${retryCount + 1}):`, error.message);
        console.error(`❌ [${this.instanceId}] Error code:`, error.code);
        console.error(`❌ [${this.instanceId}] Full error:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`🔄 [${this.instanceId}] Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`⚠️ [${this.instanceId}] All database attempts failed, using fallback data`);
    this.vehicles = this.getFallbackData();
    this.isLoading = false;
  }

  getFallbackData() {
    return [
      { make: 'Toyota', model: 'Corolla', year_range: '2020-2024', key: 'TOY43', key_min_price: '150', remote_min_price: '200', p2s_min_price: '300', ignition_min_price: '250' },
      { make: 'Toyota', model: 'Camry', year_range: '2018-2023', key: 'TOY44', key_min_price: '160', remote_min_price: '210', p2s_min_price: '320', ignition_min_price: '270' },
      { make: 'Honda', model: 'Civic', year_range: '2019-2024', key: 'HON12', key_min_price: '140', remote_min_price: '190', p2s_min_price: '290', ignition_min_price: '240' },
      { make: 'Honda', model: 'Accord', year_range: '2017-2022', key: 'HON13', key_min_price: '170', remote_min_price: '220', p2s_min_price: '340', ignition_min_price: '280' },
      { make: 'Chevrolet', model: 'Malibu', year_range: '2016-2021', key: 'CHV98', key_min_price: '130', remote_min_price: '180', p2s_min_price: '280', ignition_min_price: '230' }
    ];
  }

  // EXACT COPY OF WHATSAPP SESSION MANAGEMENT
  getSession(userId) {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        userId,
        state: 'idle',
        lastActivity: new Date()
      };
      this.sessions.set(userId, session);
    }
    session.lastActivity = new Date();
    return session;
  }

  updateSession(userId, updates) {
    const session = this.getSession(userId);
    Object.assign(session, updates);
    session.lastActivity = new Date();
  }

  async sendMessage(chatId, text) {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text
      });
      console.log(`✅ [${this.instanceId}] Sent to ${chatId}: "${text.substring(0, 30)}..."`);
    } catch (error) {
      console.error(`❌ [${this.instanceId}] Send error:`, error.message);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    const userId = chatId.toString();
    
    if (!text) return;

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 Vehicle Key Pricing Bot

📊 Database: ${this.vehicles.length} vehicles loaded
🔍 Search examples:
• toyota (show models)
• honda civic (show years)  
• Toyota Corolla 2022 (get pricing)

Try: toyota, honda, chevrolet`);
      return;
    }

    if (text === '/debug') {
      const dbStatus = this.databaseUrl ? 'Connected' : 'Using fallback';
      const dbPreview = process.env.DATABASE_URL ? 
        process.env.DATABASE_URL.substring(0, 30) + '...' : 'Not set';
      
      await this.sendMessage(chatId, `🔧 Debug Info:

📊 Vehicles: ${this.vehicles.length}
🗄️ Database: ${dbStatus}
🔗 DB URL: ${dbPreview}
🌐 Environment: ${process.env.NODE_ENV || 'not set'}
🤖 Instance: ${this.instanceId}

Available makes: ${[...new Set(this.vehicles.map(v => v.make))].slice(0, 5).join(', ')}`);
      return;
    }

    if (text === '/reload') {
      await this.sendMessage(chatId, '🔄 Reloading database...');
      this.isLoading = false; // Reset loading flag
      await this.loadVehicles();
      await this.sendMessage(chatId, `✅ Database reloaded: ${this.vehicles.length} vehicles`);
      return;
    }

    // Process the message using WhatsApp logic
    const response = await this.processMessage(userId, text.toLowerCase());
    if (response) {
      await this.sendMessage(chatId, response);
    }
  }

  // EXACT COPY OF WHATSAPP PROCESS MESSAGE LOGIC
  async processMessage(userId, text) {
    const session = this.getSession(userId);
    const trimmedText = text.trim();

    console.log(`🎯 User: ${userId}, Text: "${trimmedText}", State: ${session.state}`);

    // Check for exit commands first
    if (this.isExitCommand(trimmedText)) {
      console.log(`🚪 Exit command detected: "${trimmedText}"`);
      this.sessions.delete(userId);
      return 'Cancelled. You can now send any vehicle request or command.';
    }

    // Handle price update mode
    if (session.state === 'updating_price') {
      return await this.handlePriceUpdate(userId, trimmedText);
    }

    // Handle model selection
    if (session.state === 'selecting_model') {
      return await this.handleModelSelection(userId, trimmedText);
    }

    // Handle year selection  
    if (session.state === 'selecting_year') {
      return await this.handleYearSelection(userId, trimmedText);
    }

    // Handle vehicle selection for pricing
    if (session.state === 'selecting_vehicle_for_pricing') {
      return this.handleVehicleSelectionForPricing(userId, trimmedText);
    }

    // Handle price update trigger (9)
    if (trimmedText === '9' && session.vehicleData) {
      console.log(`🔧 Triggering price update mode for user: ${userId}`);
      this.updateSession(userId, { state: 'updating_price' });
      return this.showPriceUpdateMenu(session.vehicleData);
    }

    // Parse new vehicle request
    const parsed = this.parseUserInput(trimmedText);
    if (!parsed) {
      return null; // Let other handlers deal with it
    }

    console.log(`🎯 Processing:`, parsed);

    switch (parsed.type) {
      case 'make_only':
        return await this.handleMakeOnlySearch(userId, parsed.make);
      
      case 'make_model':
        return await this.handleMakeModelSearch(userId, parsed.make, parsed.model);
      
      case 'full':
        return await this.handleFullSearch(userId, parsed.make, parsed.model, parsed.year);
    }

    return null;
  }

  // REST OF METHODS - EXACT COPIES FROM WHATSAPP CODE
  async handleMakeOnlySearch(userId, make) {
    const makeModels = await this.getModelsForMake(make);
    
    if (makeModels.length === 0) {
      return `No models found for ${make}.`;
    }

    this.updateSession(userId, {
      state: 'selecting_model',
      make: make,
      models: makeModels
    });

    let message = `${make.toUpperCase()} MODELS:\n\n`;
    makeModels.forEach((model, index) => {
      message += `${index + 1}. ${model}\n`;
    });
    
    message += `\nReply with the number or model name\nType "cancel" to exit`;
    return message;
  }

  async handleModelSelection(userId, selection) {
    const session = this.getSession(userId);
    if (!session.models || !session.make) {
      return 'Session expired. Please start over.';
    }

    const make = session.make;
    let selectedModel;

    // Check if it's a number selection
    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num <= session.models.length) {
      selectedModel = session.models[num - 1];
    } else {
      // Check if it's a direct model name match
      selectedModel = session.models.find(model => 
        model.toLowerCase() === selection.toLowerCase()
      );
    }

    if (!selectedModel) {
      return `Please select a valid option (1-${session.models.length}) or model name.\nType "cancel" to exit`;
    }

    // Get year ranges for this make/model
    const yearRanges = await this.getYearRangesForVehicle(make, selectedModel);
    
    if (yearRanges.length === 0) {
      this.updateSession(userId, { state: 'idle' });
      return `No year data found for ${make} ${selectedModel}.`;
    }

    if (yearRanges.length === 1) {
      this.updateSession(userId, { state: 'idle' });
      const range = yearRanges[0];
      return await this.showVehiclesForRange(make, selectedModel, range, userId);
    }

    // Multiple year ranges - let user select
    this.updateSession(userId, {
      state: 'selecting_year',
      model: selectedModel,
      yearRanges: yearRanges
    });

    let message = `${make} ${selectedModel} - SELECT YEAR RANGE:\n\n`;
    yearRanges.forEach((yearRange, index) => {
      message += `${index + 1}. ${yearRange}\n`;
    });
    
    message += `\nReply with the number or specific year\nType "cancel" to exit`;
    return message;
  }

  async getModelsForMake(make) {
    // If we have very few vehicles, try to reload database
    if (this.vehicles.length < 100) {
      console.log(`⚠️ Only ${this.vehicles.length} vehicles, reloading database...`);
      await this.loadVehicles();
    }
    
    const models = new Set();
    
    this.vehicles.forEach(vehicle => {
      if (vehicle.make.toLowerCase() === make.toLowerCase()) {
        models.add(vehicle.model);
      }
    });

    const modelList = Array.from(models).sort();
    console.log(`🎯 Found ${modelList.length} models for ${make} (total vehicles: ${this.vehicles.length})`);
    
    return modelList;
  }

  async getYearRangesForVehicle(make, model) {
    const ranges = this.vehicles
      .filter(vehicle => 
        vehicle.make.toLowerCase() === make.toLowerCase() &&
        vehicle.model.toLowerCase() === model.toLowerCase()
      )
      .map(vehicle => vehicle.year_range)
      .filter(yearRange => yearRange && yearRange.trim())
      .filter((range, index, self) => self.indexOf(range) === index); // unique

    // Sort to prioritize specific years over ranges
    return ranges.sort((a, b) => {
      const aIsRange = a.includes('-');
      const bIsRange = b.includes('-');
      
      if (!aIsRange && bIsRange) return -1;
      if (aIsRange && !bIsRange) return 1;
      
      return a.localeCompare(b);
    });
  }

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

  isExitCommand(text) {
    const exitCommands = [
      'cancel', 'exit', 'stop', 'back', 'quit', 'done', 'no', 'nevermind', 'never mind'
    ];
    return exitCommands.includes(text.toLowerCase().trim());
  }

  // Placeholder methods - will add the full implementations
  async handleYearSelection(userId, selection) {
    return "Year selection coming soon...";
  }

  async handleFullSearch(userId, make, model, year) {
    return "Full search coming soon...";
  }

  handleVehicleSelectionForPricing(userId, selection) {
    return "Vehicle pricing coming soon...";
  }

  async handlePriceUpdate(userId, text) {
    return "Price update coming soon...";
  }

  showPriceUpdateMenu(vehicleData) {
    return "Price update menu coming soon...";
  }

  async showVehiclesForRange(make, model, range, userId) {
    return `Found ${make} ${model} for range ${range} - full implementation coming soon...`;
  }

  async handleMakeModelSearch(userId, make, model) {
    return "Make/model search coming soon...";
  }

  async start() {
    console.log(`🚀 [${this.instanceId}] Starting bot...`);
    console.log(`🔍 [${this.instanceId}] Environment check:`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`  BOT_TOKEN exists: ${!!process.env.BOT_TOKEN}`);
    
    await this.loadVehicles();
    
    console.log(`🚀 [${this.instanceId}] Clean bot started!`);
    console.log(`📊 [${this.instanceId}] ${this.vehicles.length} vehicles available`);
    
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

async function main() {
  try {
    const testResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log('✅ Bot token valid:', testResponse.data.result.username);
    
    const bot = new CleanTelegramBot();
    bot.start().catch(console.error);
  } catch (error) {
    console.error('❌ Bot token test failed');
    process.exit(1);
  }
}

main();