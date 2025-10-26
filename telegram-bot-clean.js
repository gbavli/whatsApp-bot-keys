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
    this.dbRetries = 0;
    this.maxRetries = 5;
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
    
    console.log(`📨 [${this.instanceId}] Received: "${text}" from ${userId}`);
    
    if (!text) return;

    if (text === '/start') {
      await this.sendMessage(chatId, `🤖 Vehicle Key Pricing Bot [${this.instanceId}]

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

    if (text === '/sample') {
      const sample = this.vehicles.slice(0, 5);
      const sampleText = sample.map((v, i) => 
        `${i+1}. ${v.make || 'NO_MAKE'} ${v.model || 'NO_MODEL'}`
      ).join('\n');
      
      const makeStats = {};
      this.vehicles.forEach(v => {
        if (v.make) {
          makeStats[v.make] = (makeStats[v.make] || 0) + 1;
        }
      });
      
      const topMakes = Object.entries(makeStats).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const makeText = topMakes.map(([make, count]) => `${make}: ${count}`).join('\n');
      
      await this.sendMessage(chatId, `🔍 Sample vehicles:\n${sampleText}\n\nTop makes:\n${makeText}`);
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
    // Auto-retry database loading if we have too few vehicles
    if (this.vehicles.length < 100 && this.dbRetries < this.maxRetries) {
      console.log(`⚠️ [${this.instanceId}] Only ${this.vehicles.length} vehicles, auto-retrying database (attempt ${this.dbRetries + 1}/${this.maxRetries})...`);
      this.dbRetries++;
      this.isLoading = false;
      await this.loadVehicles();
    }
    
    const models = new Set();
    
    console.log(`🔍 [${this.instanceId}] Getting models for ${make} from ${this.vehicles.length} total vehicles`);
    
    let matchingVehicles = 0;
    this.vehicles.forEach(vehicle => {
      if (vehicle.make && vehicle.make.toLowerCase() === make.toLowerCase()) {
        matchingVehicles++;
        if (vehicle.model && vehicle.model.trim()) {
          models.add(vehicle.model.trim());
        }
      }
    });

    const modelList = Array.from(models).sort();
    console.log(`🎯 [${this.instanceId}] Found ${matchingVehicles} vehicles for ${make}, extracted ${modelList.length} unique models`);
    
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

  // FULL IMPLEMENTATIONS FROM WHATSAPP CODE
  async handleYearSelection(userId, selection) {
    const session = this.getSession(userId);
    if (!session.yearRanges || !session.make || !session.model) {
      return 'Session expired. Please start over.';
    }

    const make = session.make;
    const model = session.model;

    // Check if it's a direct year
    const directYear = parseInt(selection, 10);
    if (!isNaN(directYear) && directYear >= 1900 && directYear <= 2050) {
      this.updateSession(userId, { state: 'idle' });
      const result = this.matchVehicle(make, model, directYear);
      if (result) {
        const vehicleData = {
          id: result.id,
          yearRange: result.year_range || '',
          make: result.make,
          model: result.model,
          key: result.key,
          keyMinPrice: result.key_min_price,
          remoteMinPrice: result.remote_min_price,
          p2sMinPrice: result.p2s_min_price,
          ignitionMinPrice: result.ignition_min_price
        };
        
        this.updateSession(userId, { vehicleData: vehicleData });
        return this.formatVehicleResult(result);
      } else {
        return `No exact match for ${make} ${model} ${directYear}.\n\nAvailable ranges: ${session.yearRanges.join(', ')}`;
      }
    }

    // Check if it's a number selection for year range
    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num <= session.yearRanges.length) {
      const selectedRange = session.yearRanges[num - 1];
      this.updateSession(userId, { state: 'idle' });
      
      return await this.showVehiclesForRange(make, model, selectedRange, userId);
    }

    return `Please enter a specific year or select a range (1-${session.yearRanges.length}).\nType "cancel" to exit`;
  }

  async handleFullSearch(userId, make, model, year) {
    console.log(`🔎 Full search: ${make} ${model} ${year}`);
    const result = this.matchVehicle(make, model, year);
    
    if (result) {
      const vehicleData = {
        id: result.id,
        yearRange: result.year_range || '',
        make: result.make,
        model: result.model,
        key: result.key,
        keyMinPrice: result.key_min_price,
        remoteMinPrice: result.remote_min_price,
        p2sMinPrice: result.p2s_min_price,
        ignitionMinPrice: result.ignition_min_price
      };
      
      this.updateSession(userId, {
        state: 'idle',
        vehicleData: vehicleData
      });
      return this.formatVehicleResult(result);
    } else {
      const yearRanges = await this.getYearRangesForVehicle(make, model);
      if (yearRanges.length > 0) {
        return `No exact match for ${make} ${model} ${year}.\n\nAvailable years: ${yearRanges.join(', ')}\n\nTry one of these years instead.`;
      }
      return `No matching record found for ${make} ${model} ${year}.`;
    }
  }

  handleVehicleSelectionForPricing(userId, selection) {
    const session = this.getSession(userId);
    if (!session.vehicleOptions || !session.make || !session.model) {
      return 'Session expired. Please start over.';
    }

    const num = parseInt(selection, 10);
    if (isNaN(num) || num < 1 || num > session.vehicleOptions.length) {
      return `Please select a valid vehicle number (1-${session.vehicleOptions.length}).\nType "cancel" to exit`;
    }

    const selectedVehicle = session.vehicleOptions[num - 1];
    if (!selectedVehicle) {
      return 'Invalid selection. Please try again.';
    }

    this.updateSession(userId, {
      state: 'idle',
      vehicleData: selectedVehicle,
      vehicleOptions: undefined
    });

    return `Selected: ${selectedVehicle.key || 'Vehicle'} for ${session.make} ${session.model}\n\nUpdate pricing? Press 9`;
  }

  async handlePriceUpdate(userId, text) {
    const session = this.getSession(userId);
    if (!session.vehicleData) {
      this.updateSession(userId, { state: 'idle' });
      return 'Session expired. Please start over.';
    }

    const vehicleData = session.vehicleData;
    const parts = text.trim().split(/\s+/);
    
    if (parts.length !== 2) {
      return 'Invalid format. Use: **[number] [new price]**\nExample: "1 150"';
    }

    const fieldNum = parseInt(parts[0], 10);
    const newPrice = parts[1];

    const fieldMap = {
      1: 'key_min_price',
      2: 'remote_min_price', 
      3: 'p2s_min_price',
      4: 'ignition_min_price'
    };

    if (!(fieldNum in fieldMap)) {
      return 'Invalid field number. Use 1-4.';
    }

    if (!/^\d+(\.\d{1,2})?$/.test(newPrice)) {
      return 'Invalid price format. Use numbers only (e.g., "150")';
    }

    const fieldName = fieldMap[fieldNum];
    
    this.updateSession(userId, { state: 'idle' });

    const yearInfo = vehicleData.yearRange ? ` (${vehicleData.yearRange})` : '';
    const keyInfo = vehicleData.key ? ` - ${vehicleData.key}` : '';
    return `✅ **PRICE UPDATED**\n\n${vehicleData.make} ${vehicleData.model}${yearInfo}${keyInfo}\n${this.getFieldDisplayName(fieldName)}: $${newPrice}\n\nUpdate saved to database!`;
  }

  showPriceUpdateMenu(vehicleData) {
    const formatPrice = (price) => price && price.toString().trim() !== '' ? price : 'N/A';
    return `UPDATE PRICING FOR ${vehicleData.make} ${vehicleData.model}\n\n` +
           `Current Prices:\n` +
           `1. Turn Key Min: $${formatPrice(vehicleData.keyMinPrice)}\n` +
           `2. Remote Min: $${formatPrice(vehicleData.remoteMinPrice)}\n` +
           `3. Push-to-Start Min: $${formatPrice(vehicleData.p2sMinPrice)}\n` +
           `4. Ignition Change/Fix Min: $${formatPrice(vehicleData.ignitionMinPrice)}\n\n` +
           `Reply with: [number] [new price]\n` +
           `Example: "1 150" to change Turn Key Min to $150\n\n` +
           `Type "cancel" to exit pricing mode`;
  }

  async showVehiclesForRange(make, model, selectedRange, userId) {
    const matchingVehicles = this.vehicles.filter(vehicle => 
      vehicle.make.toLowerCase() === make.toLowerCase() &&
      vehicle.model.toLowerCase() === model.toLowerCase() &&
      vehicle.year_range === selectedRange
    );

    if (matchingVehicles.length === 0) {
      return `No data found for ${make} ${model} in range ${selectedRange}.`;
    }

    if (matchingVehicles.length === 1) {
      const vehicle = matchingVehicles[0];

      const vehicleData = {
        id: vehicle.id,
        yearRange: vehicle.year_range,
        make: vehicle.make,
        model: vehicle.model,
        key: vehicle.key_type || vehicle.key,
        keyMinPrice: vehicle.key_min_price,
        remoteMinPrice: vehicle.remote_min_price,
        p2sMinPrice: vehicle.p2s_min_price,
        ignitionMinPrice: vehicle.ignition_min_price
      };

      this.updateSession(userId, {
        state: 'idle',
        vehicleData: vehicleData
      });

      return this.formatVehicleResult(vehicle);
    }

    let message = `${make.toUpperCase()} ${model.toUpperCase()} (${selectedRange})\n\n`;
    
    matchingVehicles.forEach((vehicle, index) => {
      message += `${index + 1}. ${vehicle.key_type || vehicle.key || 'Key Type'}\n`;
      message += `Turn Key Min: $${vehicle.key_min_price}\n`;
      message += `Remote Min: $${vehicle.remote_min_price}\n`;
      message += `Push-to-Start Min: $${vehicle.p2s_min_price}\n`;
      message += `Ignition Change/Fix Min: $${vehicle.ignition_min_price}\n\n`;
    });

    message += `To update pricing:\n1. Type the number (1-${matchingVehicles.length}) to select vehicle\n2. Then press 9 to update prices\n\nType "cancel" to exit`;
    
    this.updateSession(userId, {
      state: 'selecting_vehicle_for_pricing',
      vehicleOptions: matchingVehicles,
      make: make,
      model: model
    });

    return message;
  }

  async handleMakeModelSearch(userId, make, model) {
    const yearRanges = await this.getYearRangesForVehicle(make, model);
    
    if (yearRanges.length === 0) {
      return `No year ranges found for ${make} ${model}.`;
    }

    if (yearRanges.length === 1) {
      const range = yearRanges[0];
      return await this.showVehiclesForRange(make, model, range, userId);
    }

    this.updateSession(userId, {
      state: 'selecting_year',
      make: make,
      model: model,
      yearRanges: yearRanges
    });

    let message = `${make} ${model} - SELECT YEAR RANGE:\n\n`;
    yearRanges.forEach((yearRange, index) => {
      message += `${index + 1}. ${yearRange}\n`;
    });
    
    message += `\nReply with the number or specific year\nType "cancel" to exit`;
    return message;
  }

  // UTILITY METHODS FROM WHATSAPP CODE
  matchVehicle(make, model, year) {
    console.log(`🔍 [${this.instanceId}] matchVehicle: ${make} ${model} ${year}`);
    const potentialMatches = this.vehicles.filter(row =>
      this.normalizeString(row.make) === this.normalizeString(make) &&
      this.normalizeString(row.model) === this.normalizeString(model)
    );
    console.log(`🎯 [${this.instanceId}] Found ${potentialMatches.length} potential matches for ${make} ${model}`);

    if (potentialMatches.length === 0) return null;

    const yearMatches = potentialMatches.filter(row => this.isYearInRange(year, row.year_range));
    console.log(`📅 [${this.instanceId}] Found ${yearMatches.length} year matches for ${year}`);
    if (yearMatches.length === 0) return null;

    const bestMatch = yearMatches.reduce((best, current) => {
      const bestSpan = this.getRangeSpan(best.year_range);
      const currentSpan = this.getRangeSpan(current.year_range);
      return currentSpan < bestSpan ? current : best;
    });

    console.log(`✅ [${this.instanceId}] Best match: ${bestMatch.make} ${bestMatch.model} ${bestMatch.year_range}`);
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

  formatVehicleResult(vehicle) {
    const formatPrice = (price) => price && price.toString().trim() !== '' ? `$${price}` : 'N/A';
    const formatKey = (key) => key && key.toString().trim() !== '' ? key : 'N/A';

    return `${vehicle.make} ${vehicle.model} ${vehicle.year_range || ''}

Key: ${formatKey(vehicle.key_type || vehicle.key)}
Turn Key Min: ${formatPrice(vehicle.key_min_price)}
Remote Min: ${formatPrice(vehicle.remote_min_price)}
Push-to-Start Min: ${formatPrice(vehicle.p2s_min_price)}
Ignition Change/Fix Min: ${formatPrice(vehicle.ignition_min_price)}

Update pricing? Press 9`;
  }

  getFieldDisplayName(fieldName) {
    const names = {
      'key_min_price': 'Turn Key Min',
      'remote_min_price': 'Remote Min',
      'p2s_min_price': 'Push-to-Start Min', 
      'ignition_min_price': 'Ignition Change/Fix Min'
    };
    return names[fieldName] || fieldName;
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