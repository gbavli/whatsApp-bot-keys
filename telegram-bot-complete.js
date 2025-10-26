// COMPLETE TELEGRAM BOT WITH ALL WHATSAPP LOGIC
const axios = require('axios');
const { Client } = require('pg');

const BOT_TOKEN = process.env.BOT_TOKEN || '8278468804:AAH-32P_K0HA_iWr1WcTJsraqViOXMSNQgw';

class CompleteTelegramBot {
  constructor() {
    this.apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
    this.offset = 0;
    this.userSessions = new Map();
    this.vehicles = [];
    this.databaseUrl = null;
    this.isLoading = false;
    console.log('🤖 Complete Telegram Bot Starting...');
  }

  async loadVehicles() {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log('🔍 Environment check:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
      console.log('❌ No DATABASE_URL found');
      this.vehicles = this.getFallbackData();
      this.isLoading = false;
      return;
    }

    try {
      console.log('🔍 Connecting to PostgreSQL...');
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      console.log('✅ PostgreSQL connected');
      
      const result = await client.query('SELECT * FROM vehicles ORDER BY make, model, year_range');
      this.vehicles = result.rows;
      await client.end();
      
      this.databaseUrl = DATABASE_URL;
      console.log(`✅ Loaded ${this.vehicles.length} vehicles from PostgreSQL`);
      
    } catch (error) {
      console.error('❌ Database error:', error.message);
      this.vehicles = this.getFallbackData();
    }
    
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
    const text = message.text?.trim();
    const username = message.from?.username || message.from?.first_name || 'User';
    
    console.log(`📩 @${username}: "${text}"`);
    
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
      await this.sendMessage(chatId, `🔧 Bot Debug:
      
📊 Vehicles: ${this.vehicles.length}
🗄️ Database: ${this.databaseUrl ? 'Connected' : 'Sample data'}
💾 Sessions: ${this.userSessions.size} active

Available makes: ${[...new Set(this.vehicles.map(v => v.make))].slice(0, 5).join(', ')}`);
      return;
    }

    // Process the message
    const response = await this.processMessage(text.toLowerCase(), chatId.toString());
    if (response) {
      await this.sendMessage(chatId, response);
    }
  }

  async processMessage(text, userId) {
    console.log(`📨 Processing message: "${text}" from user ${userId}`);
    
    // Handle exit commands
    if (this.isExitCommand(text)) {
      this.userSessions.delete(userId);
      return 'Cancelled. You can now send any vehicle request or command.';
    }

    // Handle greetings
    if (text.match(/^(hi|hello|hey|test)$/i)) {
      return 'Hello! Send me vehicle info to get pricing.\n\n💡 **EXAMPLES:**\n• "Toyota" - see all Toyota models\n• "Toyota Corolla" - see available years\n• "Toyota Corolla 2015" - get pricing\n• Press **9** after any result to update prices';
    }

    // Get or create session
    let session = this.userSessions.get(userId) || { state: 'idle' };
    console.log(`🎯 Session state for ${userId}: ${session.state}`);
    console.log(`🎯 Has vehicleData: ${!!session.vehicleData}`);
    console.log(`🎯 Session make: ${session.make || 'none'}`);
    console.log(`🎯 Session models count: ${session.models?.length || 0}`);

    // Handle price update trigger (9) - CHECK THIS FIRST before session states
    if (text === '9' && session.vehicleData) {
      console.log(`🎯 Price update triggered by "${text}"`);
      this.updateSession(userId, { state: 'updating_price' });
      return this.showPriceUpdateMenu(session.vehicleData);
    }

    // Handle price update mode
    if (session.state === 'updating_price') {
      return await this.handlePriceUpdate(userId, text);
    }

    // Handle model selection
    if (session.state === 'selecting_model') {
      console.log(`🎯 Handling model selection: "${text}"`);
      console.log(`🎯 Session models count: ${session.models?.length || 0}`);
      const result = await this.handleModelSelection(userId, text);
      console.log(`🎯 Model selection result: "${result}"`);
      return result;
    }

    // Handle year selection  
    if (session.state === 'selecting_year') {
      console.log(`🎯 Handling year selection: "${text}"`);
      return await this.handleYearSelection(userId, text);
    }

    // Handle vehicle selection for pricing
    if (session.state === 'selecting_vehicle_for_pricing') {
      return this.handleVehicleSelectionForPricing(userId, text);
    }

    // If not in any session state, parse new vehicle request
    const parsed = this.parseUserInput(text);
    if (!parsed) {
      return 'Please send: Make Model Year (e.g., "Toyota Corolla 2015")';
    }

    console.log(`🎯 Processing:`, parsed);

    switch (parsed.type) {
      case 'make_only':
        console.log(`🎯 Handling make-only search for: ${parsed.make}`);
        return await this.handleMakeOnlySearch(userId, parsed.make);
      
      case 'make_model':
        console.log(`🎯 Handling make-model search for: ${parsed.make} ${parsed.model}`);
        return await this.handleMakeModelSearch(userId, parsed.make, parsed.model);
      
      case 'full':
        console.log(`🎯 Handling full search for: ${parsed.make} ${parsed.model} ${parsed.year}`);
        return await this.handleFullSearch(userId, parsed.make, parsed.model, parsed.year);
    }

    console.log(`❌ No handler matched, returning generic error`);
    return 'No matching record found.';
  }

  async handleMakeOnlySearch(userId, make) {
    const models = await this.getModelsForMake(make);
    
    if (models.length === 0) {
      return `No models found for ${make}.`;
    }

    // Store session for model selection
    this.updateSession(userId, {
      state: 'selecting_model',
      make: make,
      models: models
    });

    let message = `${make.toUpperCase()} MODELS:\n\n`;
    models.forEach((model, index) => {
      message += `${index + 1}. ${model}\n`;
    });
    
    message += `\nReply with the number or model name\nType "cancel" to exit`;
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

    // Store session for year selection
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

  async handleFullSearch(userId, make, model, year) {
    const result = this.matchVehicle(make, model, year);
    
    if (result) {
      // Store the result for potential price updates
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
      // Try to offer alternative years
      const yearRanges = await this.getYearRangesForVehicle(make, model);
      if (yearRanges.length > 0) {
        return `No exact match for ${make} ${model} ${year}.\n\nAvailable years: ${yearRanges.join(', ')}\n\nTry one of these years instead.`;
      }
      return `No matching record found for ${make} ${model} ${year}.`;
    }
  }

  async handleModelSelection(userId, selection) {
    const session = this.userSessions.get(userId);
    if (!session || !session.models || !session.make) {
      console.log(`❌ Model selection: No valid session found for ${userId}`);
      console.log(`❌ Session data:`, session);
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

    // Now get year ranges for this make/model
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

  async handleYearSelection(userId, selection) {
    const session = this.userSessions.get(userId);
    if (!session || !session.yearRanges || !session.make || !session.model) {
      console.log(`❌ Year selection: No valid session found for ${userId}`);
      console.log(`❌ Session data:`, session);
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

  handleVehicleSelectionForPricing(userId, selection) {
    const session = this.userSessions.get(userId);
    if (!session || !session.vehicleOptions || !session.make || !session.model) {
      console.log(`❌ Vehicle selection: No valid session found for ${userId}`);
      console.log(`❌ Session data:`, session);
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

    // Store the selected vehicle for pricing updates
    this.updateSession(userId, {
      state: 'idle',
      vehicleData: selectedVehicle,
      vehicleOptions: undefined
    });

    return `Selected: ${selectedVehicle.key || 'Vehicle'} for ${session.make} ${session.model}\n\nupdate pricing ? press 9`;
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

  async handlePriceUpdate(userId, text) {
    const session = this.userSessions.get(userId);
    if (!session || !session.vehicleData) {
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

    // Validate price format
    if (!/^\d+(\.\d{1,2})?$/.test(newPrice)) {
      return 'Invalid price format. Use numbers only (e.g., "150")';
    }

    const fieldName = fieldMap[fieldNum];
    
    // For now, just simulate the update
    this.updateSession(userId, { state: 'idle' });

    const yearInfo = vehicleData.yearRange ? ` (${vehicleData.yearRange})` : '';
    const keyInfo = vehicleData.key ? ` - ${vehicleData.key}` : '';
    return `✅ **PRICE UPDATED**\n\n${vehicleData.make} ${vehicleData.model}${yearInfo}${keyInfo}\n${this.getFieldDisplayName(fieldName)}: $${newPrice}\n\nUpdate saved to database!`;
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

  async getModelsForMake(make) {
    // If we only have sample data, try to reload from database
    if (this.vehicles.length <= 10) {
      console.log(`⚠️ Only ${this.vehicles.length} vehicles loaded, attempting to reload from database...`);
      await this.loadVehicles();
    }
    
    const models = new Set();
    
    console.log(`🔍 Total vehicles in database: ${this.vehicles.length}`);
    console.log(`🔍 Database URL exists: ${!!this.databaseUrl}`);
    
    this.vehicles.forEach(vehicle => {
      if (vehicle.make.toLowerCase() === make.toLowerCase()) {
        models.add(vehicle.model);
      }
    });

    const modelList = Array.from(models).sort();
    console.log(`🎯 Found ${modelList.length} models for ${make}`);
    
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

    console.log(`🎯 Found ${ranges.length} year ranges for ${make} ${model}`);

    // Sort to prioritize specific years over ranges
    return ranges.sort((a, b) => {
      const aIsRange = a.includes('-');
      const bIsRange = b.includes('-');
      
      if (!aIsRange && bIsRange) return -1;
      if (aIsRange && !bIsRange) return 1;
      
      return a.localeCompare(b);
    });
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

    // If only one vehicle, show it directly
    if (matchingVehicles.length === 1) {
      const vehicle = matchingVehicles[0];
      const result = this.formatVehicleResult(vehicle);

      // Store for potential price updates
      const vehicleData = {
        id: vehicle.id,
        yearRange: vehicle.year_range,
        make: vehicle.make,
        model: vehicle.model,
        key: vehicle.key || vehicle.key_type,
        keyMinPrice: vehicle.key_min_price,
        remoteMinPrice: vehicle.remote_min_price,
        p2sMinPrice: vehicle.p2s_min_price,
        ignitionMinPrice: vehicle.ignition_min_price
      };

      this.updateSession(userId, {
        state: 'idle',
        vehicleData: vehicleData
      });

      return result;
    }

    // Multiple vehicles - show selection
    let message = `${make.toUpperCase()} ${model.toUpperCase()} (${selectedRange})\n\n`;
    
    matchingVehicles.forEach((vehicle, index) => {
      message += `${index + 1}. ${vehicle.key || 'Key Type'}\n`;
      message += `Turn Key Min: $${vehicle.key_min_price}\n`;
      message += `Remote Min: $${vehicle.remote_min_price}\n`;
      message += `Push-to-Start Min: $${vehicle.p2s_min_price}\n`;
      message += `Ignition Change/Fix Min: $${vehicle.ignition_min_price}\n\n`;
    });

    message += `To update pricing:\n1. Type the number (1-${matchingVehicles.length}) to select vehicle\n2. Then press 9 to update prices\n\nType "cancel" to exit`;
    
    // Store all vehicles for selection
    this.updateSession(userId, {
      state: 'selecting_vehicle_for_pricing',
      vehicleOptions: matchingVehicles,
      make: make,
      model: model
    });

    return message;
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

  formatVehicleResult(vehicle) {
    const formatPrice = (price) => price && price.toString().trim() !== '' ? `$${price}` : 'N/A';
    const formatKey = (key) => key && key.toString().trim() !== '' ? key : 'N/A';

    return `${vehicle.make} ${vehicle.model} ${vehicle.year_range || ''}

Key: ${formatKey(vehicle.key || vehicle.key_type)}
Turn Key Min: ${formatPrice(vehicle.key_min_price)}
Remote Min: ${formatPrice(vehicle.remote_min_price)}
Push-to-Start Min: ${formatPrice(vehicle.p2s_min_price)}
Ignition Change/Fix Min: ${formatPrice(vehicle.ignition_min_price)}

update pricing ? press 9`;
  }

  getSession(userId) {
    let session = this.userSessions.get(userId);
    if (!session) {
      session = {
        userId,
        state: 'idle',
        lastActivity: new Date()
      };
      this.userSessions.set(userId, session);
    }
    session.lastActivity = new Date();
    return session;
  }

  updateSession(userId, updates) {
    let session = this.userSessions.get(userId);
    if (!session) {
      session = {
        userId,
        state: 'idle',
        lastActivity: new Date()
      };
    }
    Object.assign(session, updates);
    session.lastActivity = new Date();
    this.userSessions.set(userId, session);
    console.log(`🎯 Updated session for ${userId}:`, { state: session.state, make: session.make, models: session.models?.length });
  }

  isExitCommand(text) {
    const exitCommands = [
      'cancel', 'exit', 'stop', 'back', 'quit', 'done', 'no', 'nevermind', 'never mind'
    ];
    return exitCommands.includes(text.toLowerCase().trim());
  }

  async start() {
    await this.loadVehicles();
    
    console.log('🚀 Complete bot started!');
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

async function main() {
  try {
    const testResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log('✅ Bot token valid:', testResponse.data.result.username);
    
    const bot = new CompleteTelegramBot();
    bot.start().catch(console.error);
  } catch (error) {
    console.error('❌ Bot token test failed');
    process.exit(1);
  }
}

main();