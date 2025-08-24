import { VehicleLookup, VehicleData } from '../data/vehicleLookup';
import { PostgresLookup } from '../data/postgresLookup';
import { parseUserInput, formatVehicleResult, ParsedInput } from '../logic/format';

interface UserSession {
  userId: string;
  state: 'idle' | 'selecting_model' | 'selecting_year' | 'updating_price' | 'selecting_vehicle_for_pricing';
  make?: string;
  model?: string;
  vehicleData?: VehicleData;
  vehicleOptions?: VehicleData[];
  models?: string[];
  yearRanges?: string[];
  lastActivity: Date;
}

export class InteractiveVehicleCommand {
  private lookup: VehicleLookup;
  private sessions = new Map<string, UserSession>();
  private vehicleData: VehicleData[] = [];

  constructor(lookup: VehicleLookup) {
    this.lookup = lookup;
    this.loadVehicleData();
    
    // Clean up old sessions every 5 minutes
    setInterval(() => this.cleanupOldSessions(), 5 * 60 * 1000);
  }

  private async loadVehicleData(): Promise<void> {
    try {
      if ('getAllVehicles' in this.lookup) {
        this.vehicleData = await (this.lookup as any).getAllVehicles();
        console.log(`🎯 Interactive system loaded ${this.vehicleData.length} vehicles`);
      }
    } catch (error) {
      console.error('❌ Failed to load vehicle data for interactive system:', error);
    }
  }

  private cleanupOldSessions(): void {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(userId);
      }
    }
  }

  private getSession(userId: string): UserSession {
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

  private updateSession(userId: string, updates: Partial<UserSession>): void {
    const session = this.getSession(userId);
    Object.assign(session, updates);
    session.lastActivity = new Date();
  }

  async processMessage(userId: string, text: string): Promise<string | null> {
    const session = this.getSession(userId);
    const trimmedText = text.trim();

    console.log(`🎯 Interactive command - User: ${userId}, Text: "${trimmedText}", State: ${session.state}`);

    // Check for exit commands first - works in any state
    if (this.isExitCommand(trimmedText)) {
      console.log(`🚪 Exit command detected: "${trimmedText}"`);
      this.sessions.delete(userId); // Clear the session
      return 'Cancelled. You can now send any vehicle request or command.';
    }

    // Handle price update mode (press 9)
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
    const parsed = parseUserInput(trimmedText);
    if (!parsed) {
      return null; // Let other handlers deal with it
    }

    console.log(`🎯 Interactive system processing:`, parsed);

    switch (parsed.type) {
      case 'make_only':
        return await this.handleMakeOnlySearch(userId, parsed.make);
      
      case 'make_model':
        return await this.handleMakeModelSearch(userId, parsed.make, parsed.model!);
      
      case 'full':
        return await this.handleFullSearch(userId, parsed.make, parsed.model!, parsed.year!);
    }

    return null;
  }

  private async handleMakeOnlySearch(userId: string, make: string): Promise<string> {
    // Get all models for this make
    const makeModels = await this.getModelsForMake(make);
    
    if (makeModels.length === 0) {
      return `No models found for ${make}.`;
    }

    // Store session for model selection
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

  private async handleMakeModelSearch(userId: string, make: string, model: string): Promise<string> {
    // Get year ranges for this make/model
    const yearRanges = await this.getYearRangesForVehicle(make, model);
    
    if (yearRanges.length === 0) {
      return `No year ranges found for ${make} ${model}.`;
    }

    if (yearRanges.length === 1) {
      const range = yearRanges[0];
      if (range) {
        return await this.showVehiclesForRange(make, model, range, userId);
      }
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

  private async handleFullSearch(userId: string, make: string, model: string, year: number): Promise<string> {
    const result = await this.lookup.find(make, model, year);
    
    if (result) {
      // Store the result for potential price updates - convert to VehicleData format
      const vehicleData: VehicleData = {
        id: result.id,
        yearRange: result.yearRange || '',
        make: result.make,
        model: result.model,
        key: result.key,
        keyMinPrice: result.keyMinPrice,
        remoteMinPrice: result.remoteMinPrice,
        p2sMinPrice: result.p2sMinPrice,
        ignitionMinPrice: result.ignitionMinPrice
      };
      
      this.updateSession(userId, {
        state: 'idle',
        vehicleData: vehicleData
      });
      return formatVehicleResult(result);
    } else {
      // Try to offer alternative years
      const yearRanges = await this.getYearRangesForVehicle(make, model);
      if (yearRanges.length > 0) {
        return `No exact match for ${make} ${model} ${year}.\n\nAvailable years: ${yearRanges.join(', ')}\n\nTry one of these years instead.`;
      }
      return `No matching record found for ${make} ${model} ${year}.`;
    }
  }

  private async handleModelSelection(userId: string, selection: string): Promise<string> {
    const session = this.getSession(userId);
    if (!session.models || !session.make) {
      return 'Session expired. Please start over.';
    }

    const make = session.make; // Extract for type safety
    let selectedModel: string | undefined;

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
      if (range) {
        return await this.showVehiclesForRange(make, selectedModel, range, userId);
      }
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

  private async handleYearSelection(userId: string, selection: string): Promise<string> {
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
      const result = await this.lookup.find(make, model, directYear);
      if (result) {
        // Convert to VehicleData format
        const vehicleData: VehicleData = {
          id: result.id,
          yearRange: result.yearRange || '',
          make: result.make,
          model: result.model,
          key: result.key,
          keyMinPrice: result.keyMinPrice,
          remoteMinPrice: result.remoteMinPrice,
          p2sMinPrice: result.p2sMinPrice,
          ignitionMinPrice: result.ignitionMinPrice
        };
        
        this.updateSession(userId, { vehicleData: vehicleData });
        return formatVehicleResult(result);
      } else {
        return `No exact match for ${make} ${model} ${directYear}.\n\nAvailable ranges: ${session.yearRanges.join(', ')}`;
      }
    }

    // Check if it's a number selection for year range
    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num <= session.yearRanges.length) {
      const selectedRange = session.yearRanges[num - 1];
      this.updateSession(userId, { state: 'idle' });
      
      // Show all vehicles for this make/model/range combination
      if (selectedRange) {
        return await this.showVehiclesForRange(make, model, selectedRange, userId);
      }
    }

    return `Please enter a specific year or select a range (1-${session.yearRanges.length}).\nType "cancel" to exit`;
  }

  private handleVehicleSelectionForPricing(userId: string, selection: string): string {
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

    // Store the selected vehicle for pricing updates
    this.updateSession(userId, {
      state: 'idle',
      vehicleData: selectedVehicle,
      vehicleOptions: undefined
    });

    return `Selected: ${selectedVehicle.key || 'Vehicle'} for ${session.make} ${session.model}\n\nupdate pricing ? press 9`;
  }

  private showPriceUpdateMenu(vehicleData: VehicleData): string {
    return `UPDATE PRICING FOR ${vehicleData.make} ${vehicleData.model}\n\n` +
           `Current Prices:\n` +
           `1. Turn Key Min: $${vehicleData.keyMinPrice}\n` +
           `2. Remote Min: $${vehicleData.remoteMinPrice}\n` +
           `3. Push-to-Start Min: $${vehicleData.p2sMinPrice}\n` +
           `4. Ignition Change/Fix Min: $${vehicleData.ignitionMinPrice}\n\n` +
           `Reply with: [number] [new price]\n` +
           `Example: "1 150" to change Turn Key Min to $150\n\n` +
           `Type "cancel" to exit pricing mode`;
  }

  private async handlePriceUpdate(userId: string, text: string): Promise<string> {
    const session = this.getSession(userId);
    if (!session.vehicleData) {
      this.updateSession(userId, { state: 'idle' });
      return 'Session expired. Please start over.';
    }

    const vehicleData = session.vehicleData;

    const parts = text.trim().split(/\s+/);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return 'Invalid format. Use: **[number] [new price]**\nExample: "1 150"';
    }

    const fieldNum = parseInt(parts[0], 10);
    const newPrice = parts[1];

    const fieldMap: { [key: number]: string } = {
      1: 'key_min_price',
      2: 'remote_min_price', 
      3: 'p2s_min_price',
      4: 'ignition_min_price'
    };

    if (!(fieldNum in fieldMap)) {
      return 'Invalid field number. Use 1-4.';
    }

    // Validate price format
    if (!/^\d+$/.test(newPrice)) {
      return 'Invalid price format. Use numbers only (e.g., "150")';
    }

    const fieldName = fieldMap[fieldNum] as 'key_min_price' | 'remote_min_price' | 'p2s_min_price' | 'ignition_min_price';
    
    // Update in database if PostgresLookup
    if (this.lookup instanceof PostgresLookup && vehicleData.id) {
      const success = await this.lookup.updateVehiclePrice(
        vehicleData.id,
        fieldName,
        newPrice,
        userId
      );

      this.updateSession(userId, { state: 'idle' });

      if (success) {
        const yearInfo = vehicleData.yearRange ? ` (${vehicleData.yearRange})` : '';
        const keyInfo = vehicleData.key ? ` - ${vehicleData.key}` : '';
        return `✅ **PRICE UPDATED**\n\n${vehicleData.make} ${vehicleData.model}${yearInfo}${keyInfo}\n${this.getFieldDisplayName(fieldName)}: $${newPrice}\n\nUpdate saved to database!`;
      } else {
        return `❌ Failed to update price. Please try again.`;
      }
    }

    this.updateSession(userId, { state: 'idle' });
    return `⚠️ Price updates not supported for this data source.`;
  }

  private getFieldDisplayName(fieldName: string): string {
    const names: { [key: string]: string } = {
      'key_min_price': 'Turn Key Min',
      'remote_min_price': 'Remote Min',
      'p2s_min_price': 'Push-to-Start Min', 
      'ignition_min_price': 'Ignition Change/Fix Min'
    };
    return names[fieldName] || fieldName;
  }

  private async getModelsForMake(make: string): Promise<string[]> {
    try {
      // Use database directly instead of cached data
      let vehicles = this.vehicleData;
      
      // If cached data is empty, try to load from database
      if (!vehicles || vehicles.length === 0) {
        console.log(`🔍 No cached data, loading vehicles for ${make} from database`);
        if ('getAllVehicles' in this.lookup) {
          vehicles = await (this.lookup as any).getAllVehicles();
          this.vehicleData = vehicles; // Update cache
          console.log(`📊 Loaded ${vehicles.length} vehicles from database`);
        }
      }
      
      if (!vehicles || vehicles.length === 0) {
        console.log(`❌ No vehicle data available for ${make}`);
        return [];
      }
      
      const models = new Set<string>();
      
      vehicles.forEach(vehicle => {
        if (vehicle.make.toLowerCase() === make.toLowerCase()) {
          models.add(vehicle.model);
        }
      });

      const modelList = Array.from(models).sort();
      console.log(`🎯 Found ${modelList.length} models for ${make}:`, modelList.slice(0, 5), '...');
      
      return modelList;
    } catch (error) {
      console.error(`❌ Error getting models for ${make}:`, error);
      return [];
    }
  }

  private async getYearRangesForVehicle(make: string, model: string): Promise<string[]> {
    try {
      // Use database directly instead of cached data
      let vehicles = this.vehicleData;
      
      // If cached data is empty, try to load from database
      if (!vehicles || vehicles.length === 0) {
        console.log(`🔍 No cached data, loading vehicles for ${make} ${model} from database`);
        if ('getAllVehicles' in this.lookup) {
          vehicles = await (this.lookup as any).getAllVehicles();
          this.vehicleData = vehicles; // Update cache
          console.log(`📊 Loaded ${vehicles.length} vehicles from database`);
        }
      }
      
      if (!vehicles || vehicles.length === 0) {
        console.log(`❌ No vehicle data available for ${make} ${model}`);
        return [];
      }
      
      const ranges = vehicles
        .filter(vehicle => 
          vehicle.make.toLowerCase() === make.toLowerCase() &&
          vehicle.model.toLowerCase() === model.toLowerCase()
        )
        .map(vehicle => vehicle.yearRange)
        .filter(yearRange => yearRange && yearRange.trim())
        .filter((range, index, self) => self.indexOf(range) === index); // unique

      console.log(`🎯 Found ${ranges.length} year ranges for ${make} ${model}:`, ranges);

      // Sort to prioritize specific years (single years) over ranges
      return ranges.sort((a, b) => {
        const aIsRange = a.includes('-');
        const bIsRange = b.includes('-');
        
        // Single years first, then ranges
        if (!aIsRange && bIsRange) return -1;
        if (aIsRange && !bIsRange) return 1;
        
        // Both same type, sort alphabetically/numerically
        return a.localeCompare(b);
      });
    } catch (error) {
      console.error(`❌ Error getting year ranges for ${make} ${model}:`, error);
      return [];
    }
  }

  private async showVehiclesForRange(make: string, model: string, selectedRange: string, userId?: string): Promise<string> {
    // Find all vehicles that match this make/model/range
    const matchingVehicles = this.vehicleData.filter(vehicle => 
      vehicle.make.toLowerCase() === make.toLowerCase() &&
      vehicle.model.toLowerCase() === model.toLowerCase() &&
      vehicle.yearRange === selectedRange
    );

    if (matchingVehicles.length === 0) {
      return `No data found for ${make} ${model} in range ${selectedRange}.`;
    }

    // If only one vehicle, show it directly with pricing
    if (matchingVehicles.length === 1) {
      const vehicle = matchingVehicles[0];
      if (vehicle) {
        const result = {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: this.extractYearFromRange(selectedRange), // Use first year of range
          yearRange: vehicle.yearRange,
          key: vehicle.key,
          keyMinPrice: vehicle.keyMinPrice,
          remoteMinPrice: vehicle.remoteMinPrice,
          p2sMinPrice: vehicle.p2sMinPrice,
          ignitionMinPrice: vehicle.ignitionMinPrice
        };

        // Store for potential price updates
        if (userId) {
          this.updateSession(userId, {
            state: 'idle',
            vehicleData: vehicle
          });
        }

        return formatVehicleResult(result);
      }
    }

    // Multiple vehicles - show them all with selection for price updates
    let message = `${make.toUpperCase()} ${model.toUpperCase()} (${selectedRange})\n\n`;
    
    matchingVehicles.forEach((vehicle, index) => {
      message += `${index + 1}. ${vehicle.key || 'Key Type'}\n`;
      message += `Turn Key Min: $${vehicle.keyMinPrice}\n`;
      message += `Remote Min: $${vehicle.remoteMinPrice}\n`;
      message += `Push-to-Start Min: $${vehicle.p2sMinPrice}\n`;
      message += `Ignition Change/Fix Min: $${vehicle.ignitionMinPrice}\n\n`;
    });

    if (matchingVehicles.length > 1) {
      message += `To update pricing:\n1. Type the number (1-${matchingVehicles.length}) to select vehicle\n2. Then press 9 to update prices\n\nType "cancel" to exit`;
      
      // Store all vehicles for selection
      if (userId) {
        this.updateSession(userId, {
          state: 'selecting_vehicle_for_pricing',
          vehicleOptions: matchingVehicles,
          make: make,
          model: model
        });
      }
    } else {
      message += `update pricing ? press 9`;
      
      // Store single vehicle for pricing
      if (userId && matchingVehicles[0]) {
        this.updateSession(userId, {
          state: 'idle',
          vehicleData: matchingVehicles[0]
        });
      }
    }

    return message;
  }

  private extractYearFromRange(yearRange: string | undefined): number {
    // Extract first year from range like "2008-2014" or single year like "2015"
    const match = yearRange?.match(/^(\d{4})/);
    return match && match[1] ? parseInt(match[1], 10) : 2015; // fallback
  }

  private isExitCommand(text: string): boolean {
    const exitCommands = [
      'cancel', 'exit', 'stop', 'back', 'quit', 'done', 'no', 'nevermind', 'never mind'
    ];
    const lowerText = text.toLowerCase().trim();
    const isExit = exitCommands.includes(lowerText);
    console.log(`🚪 Checking exit command: "${text}" -> "${lowerText}" -> ${isExit}`);
    return isExit;
  }

  // Public method to store vehicle data for price updates
  public storeVehicleForPricing(userId: string, vehicleData: VehicleData): void {
    this.updateSession(userId, {
      state: 'idle',
      vehicleData: vehicleData
    });
  }
}