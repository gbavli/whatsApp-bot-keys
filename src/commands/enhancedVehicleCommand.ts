import { VehicleLookup, VehicleData } from '../data/vehicleLookup';
import { PostgresLookup } from '../data/postgresLookup';
import { VehicleSuggestionEngine } from '../logic/vehicleSuggestions';
import { formatVehicleResult } from '../logic/format';
import { smartParseVehicle } from '../logic/intelligentParser';

export interface VehicleSelectionSession {
  userId: string;
  step: 'awaiting_make_selection' | 'awaiting_model_selection' | 'awaiting_year_input' | 'awaiting_pricing_action' | 'awaiting_price_option' | 'awaiting_new_price' | 'awaiting_confirmation';
  make?: string;
  availableModels?: string[];
  selectedModel?: string;
  availableYearRanges?: string[];
  selectedYearRange?: string;
  selectedYear?: number;
  currentVehicle?: {
    make: string;
    model: string;
    year: number;
    yearRange?: string;
    id?: number;
  };
  priceType?: 'key' | 'remote' | 'p2s' | 'ignition';
  newPrice?: string;
  originalPrice?: string;
}

export class EnhancedVehicleCommand {
  private sessions: Map<string, VehicleSelectionSession> = new Map();
  private lookup: VehicleLookup;
  private vehicleData: VehicleData[] = [];
  private suggestionEngine?: VehicleSuggestionEngine;
  
  constructor(lookup: VehicleLookup) {
    this.lookup = lookup;
    // Load vehicle data in background after short delay
    this.loadVehicleDataSafe();
  }

  private loadVehicleDataSafe(): void {
    // Start loading after a short delay to avoid blocking startup
    setTimeout(async () => {
      try {
        console.log('🔄 Enhanced command: Loading vehicle data for smart parsing...');
        if ('getAllVehicles' in this.lookup) {
          this.vehicleData = await (this.lookup as any).getAllVehicles();
          this.suggestionEngine = new VehicleSuggestionEngine(this.vehicleData);
          console.log(`✅ Enhanced vehicle command loaded ${this.vehicleData.length} vehicles with intelligent parsing`);
        } else {
          console.log('⚠️ Enhanced command: Lookup does not support getAllVehicles');
        }
      } catch (error) {
        console.error('❌ Enhanced command: Failed to load vehicle data:', error);
        // Don't crash, continue with limited functionality
        console.log('ℹ️ Enhanced command: Will work with basic parsing only');
      }
    }, 1000); // Wait 1 second after startup
  }

  private async loadVehicleDataNow(): Promise<void> {
    try {
      if ('getAllVehicles' in this.lookup && this.vehicleData.length === 0) {
        console.log('⚡ Enhanced command: Loading data on-demand...');
        this.vehicleData = await (this.lookup as any).getAllVehicles();
        this.suggestionEngine = new VehicleSuggestionEngine(this.vehicleData);
        console.log(`✅ Enhanced command: Loaded ${this.vehicleData.length} vehicles on-demand`);
      }
    } catch (error) {
      console.error('❌ Enhanced command: Failed to load data on-demand:', error);
    }
  }

  async processMessage(userId: string, message: string): Promise<string | null> {
    try {
      const session = this.sessions.get(userId);
      const input = message.trim();

      // Handle numeric inputs for sessions
      if (session) {
        return this.handleSessionStep(userId, session, input);
      }

      // Handle pricing action (9)
      if (input === '9') {
        return `❌ You need to search for a vehicle first.\n\nPlease send: Make Model Year\nExample: Toyota Corolla 2015`;
      }

      // Try intelligent parsing with vehicle data if available, or load it now
      if (this.vehicleData.length === 0) {
        console.log(`🔄 Enhanced command: No data loaded yet, trying to load now...`);
        await this.loadVehicleDataNow();
      }
      
      if (this.vehicleData.length > 0) {
        console.log(`🧠 Enhanced command: Using intelligent parsing with ${this.vehicleData.length} vehicles`);
        const smartResults = smartParseVehicle(input, this.vehicleData);
        
        if (smartResults.length > 0) {
          console.log(`🎯 Enhanced command: Smart parser found ${smartResults.length} matches`);
          // Try the best match first
          for (const match of smartResults) {
            console.log(`🔎 Enhanced command: Trying ${match.make} ${match.model} ${match.year} (confidence: ${match.confidence})`);
            const result = await this.lookup.find(match.make, match.model, match.year);
            if (result) {
              console.log(`✅ Enhanced command: Found exact match in database`);
              // Store successful lookup in session for potential pricing updates
              this.sessions.set(userId, {
                userId,
                step: 'awaiting_pricing_action',
                currentVehicle: {
                  make: match.make,
                  model: match.model,
                  year: match.year,
                  yearRange: this.findYearRangeForVehicle(match.make, match.model, match.year),
                  id: this.findVehicleId(match.make, match.model, match.year)
                }
              });
              
              return formatVehicleResult(result, true);
            } else {
              console.log(`❌ Enhanced command: Smart match not found in database: ${match.make} ${match.model} ${match.year}`);
            }
          }
          console.log(`❌ Enhanced command: No smart matches found in database`);
        } else {
          console.log(`❌ Enhanced command: Smart parser found no matches for: "${input}"`);
        }
      } else {
        console.log(`⚠️ Enhanced command: No vehicle data loaded yet, using suggestions engine only`);
      }

      // If smart parsing didn't work, try suggestion engine for make/model suggestions
      if (!this.suggestionEngine) {
        console.log(`⚠️ Enhanced command: Suggestion engine not ready, returning null`);
        return null;
      }

      // If no exact match, try to provide suggestions
      const parsed = this.parseBasicInput(input);
      if (parsed && parsed.make) {
        const bestMakeMatch = this.suggestionEngine.findBestMakeMatch(parsed.make);
        
        if (bestMakeMatch) {
          // Found a make match, show model options
          this.sessions.set(userId, {
            userId,
            step: 'awaiting_model_selection',
            make: bestMakeMatch,
            availableModels: this.suggestionEngine.getModelsForMake(bestMakeMatch)
          });
          
          return `❓ **Did you mean "${bestMakeMatch}"?**\n\n${this.suggestionEngine.formatModelSelection(bestMakeMatch)}`;
        }
      }

      // If we can't parse make, offer all makes
      const allMakes = this.suggestionEngine.getAllMakeModels().map(m => m.make);
      if (allMakes.length > 0) {
        let message = `❓ **Vehicle not found!** Available makes:\n\n`;
        allMakes.slice(0, 15).forEach((make, index) => {
          message += `${index + 1}️⃣ ${make}\n`;
        });
        
        if (allMakes.length > 15) {
          message += `... and ${allMakes.length - 15} more\n`;
        }
        
        message += `\n📝 **Reply with make name** to see available models`;
        return message;
      }

      return null; // Not handled by this command
      
    } catch (error) {
      console.error('❌ Enhanced vehicle command error:', error);
      return null; // Let fallback handle the message
    }
  }

  private async handleSessionStep(userId: string, session: VehicleSelectionSession, input: string): Promise<string> {
    const trimmedInput = input.toLowerCase().trim();

    // Handle cancel
    if (trimmedInput === 'cancel') {
      this.sessions.delete(userId);
      return '❌ Selection cancelled.';
    }

    switch (session.step) {
      case 'awaiting_model_selection':
        return this.handleModelSelection(userId, session, input);
      
      case 'awaiting_year_input':
        return this.handleYearInput(userId, session, input);
      
      case 'awaiting_pricing_action':
        return this.handlePricingAction(userId, session, input);
      
      case 'awaiting_price_option':
        return this.handlePriceOptionSelection(userId, session, input);
      
      case 'awaiting_new_price':
        return this.handleNewPriceInput(userId, session, input);
      
      case 'awaiting_confirmation':
        return this.handlePriceConfirmation(userId, session, input);
      
      default:
        this.sessions.delete(userId);
        return '❌ Session error. Please start over.';
    }
  }

  private handleModelSelection(userId: string, session: VehicleSelectionSession, input: string): string {
    if (!this.suggestionEngine || !session.make || !session.availableModels) {
      this.sessions.delete(userId);
      return '❌ Session error. Please start over.';
    }

    const selection = parseInt(input.trim());
    
    if (isNaN(selection)) {
      return `❌ Please enter a number between 1 and ${session.availableModels.length}\n\nOr type "cancel" to stop.`;
    }

    const selectedModel = this.suggestionEngine.getModelByNumber(session.make, selection);
    if (!selectedModel) {
      return `❌ Invalid selection. Please choose 1-${session.availableModels.length}\n\nOr type "cancel" to stop.`;
    }

    // Check year ranges for this make/model
    const yearRanges = this.suggestionEngine.getYearRangesForVehicle(session.make, selectedModel);
    
    session.step = 'awaiting_year_input';
    session.selectedModel = selectedModel;
    session.availableYearRanges = yearRanges;
    this.sessions.set(userId, session);

    if (!this.suggestionEngine) {
      this.sessions.delete(userId);
      return '❌ System error. Please try again.';
    }
    
    return `✅ **${session.make} ${selectedModel}** selected!\n\n${this.suggestionEngine.formatYearRangeSelection(session.make, selectedModel)}\n\nOr type "cancel" to stop.`;
  }

  private async handleYearInput(userId: string, session: VehicleSelectionSession, input: string): Promise<string> {
    if (!session.make || !session.selectedModel) {
      this.sessions.delete(userId);
      return '❌ Session error. Please start over.';
    }

    const year = parseInt(input.trim());
    if (isNaN(year) || year < 1900 || year > 2050) {
      return '❌ Please enter a valid year (1900-2050)\n\nOr type "cancel" to stop.';
    }

    // Try to find the vehicle
    const result = await this.lookup.find(session.make, session.selectedModel, year);
    if (!result) {
      return `❌ No pricing data found for ${session.make} ${session.selectedModel} ${year}\n\nTry a different year or type "cancel" to stop.`;
    }

    // Store successful lookup
    session.step = 'awaiting_pricing_action';
    session.selectedYear = year;
    session.currentVehicle = {
      make: session.make,
      model: session.selectedModel,
      year: year,
      yearRange: this.findYearRangeForVehicle(session.make, session.selectedModel, year),
      id: this.findVehicleId(session.make, session.selectedModel, year)
    };
    this.sessions.set(userId, session);

    return formatVehicleResult(result, true);
  }

  private handlePricingAction(userId: string, session: VehicleSelectionSession, input: string): string {
    if (input.trim() !== '9') {
      // Not a pricing action, end session
      this.sessions.delete(userId);
      return null!; // Let other handlers process this
    }

    if (!session.currentVehicle) {
      this.sessions.delete(userId);
      return '❌ Session error. Please search for a vehicle first.';
    }

    session.step = 'awaiting_price_option';
    this.sessions.set(userId, session);

    const vehicle = session.currentVehicle;
    const yearInfo = vehicle.yearRange ? `📅 **Year Range: ${vehicle.yearRange}**` : `📅 **Year: ${vehicle.year}**`;
    
    return `💰 **UPDATE PRICING FOR:**\n🚗 **${vehicle.make} ${vehicle.model}**\n${yearInfo}\n\n**Select price to change:**\n1️⃣ Turn Key Min\n2️⃣ Remote Min\n3️⃣ Push-to-Start Min\n4️⃣ Ignition Change/Fix Min\n\n📝 **Reply with number (1-4)** or "cancel" to stop.`;
  }

  private async handlePriceOptionSelection(userId: string, session: VehicleSelectionSession, input: string): Promise<string> {
    const selection = parseInt(input.trim());
    
    if (isNaN(selection) || selection < 1 || selection > 4) {
      return '❌ Please select 1, 2, 3, or 4\n\nOr type "cancel" to stop.';
    }

    const priceTypes = ['key', 'remote', 'p2s', 'ignition'] as const;
    const priceLabels = ['Turn Key Min', 'Remote Min', 'Push-to-Start Min', 'Ignition Change/Fix Min'];
    
    session.priceType = priceTypes[selection - 1];
    session.step = 'awaiting_new_price';

    // Get current price
    if (session.currentVehicle) {
      const result = await this.lookup.find(session.currentVehicle.make, session.currentVehicle.model, session.currentVehicle.year);
      if (result) {
        switch (session.priceType) {
          case 'key':
            session.originalPrice = result.keyMinPrice || 'Not set';
            break;
          case 'remote':
            session.originalPrice = result.remoteMinPrice || 'Not set';
            break;
          case 'p2s':
            session.originalPrice = result.p2sMinPrice || 'Not set';
            break;
          case 'ignition':
            session.originalPrice = result.ignitionMinPrice || 'Not set';
            break;
        }
      }
    }

    this.sessions.set(userId, session);

    const vehicle = session.currentVehicle!;
    const yearInfo = vehicle.yearRange ? `📅 **${vehicle.yearRange}** (entire range)` : `📅 **${vehicle.year}**`;

    const priceLabel = priceLabels[selection - 1];
    if (!priceLabel) {
      this.sessions.delete(userId);
      return '❌ Invalid price selection. Please start over.';
    }
    
    return `💰 **CHANGE ${priceLabel.toUpperCase()}**\n\n🚗 **${vehicle.make} ${vehicle.model}**\n${yearInfo}\n💵 **Current price:** $${session.originalPrice}\n\n📝 **Enter new price:**\nExample: 150 or 89.99\n\nOr type "cancel" to stop.`;
  }

  private handleNewPriceInput(userId: string, session: VehicleSelectionSession, input: string): string {
    const priceInput = input.trim();
    
    // Validate price format
    if (!/^\d+(\.\d{1,2})?$/.test(priceInput)) {
      return `❌ Invalid price format: "${priceInput}"\n\nEnter numbers only (e.g., 150, 89.99)\n\nOr type "cancel" to stop.`;
    }

    const newPrice = parseFloat(priceInput);
    if (newPrice < 0 || newPrice > 9999) {
      return '❌ Price must be between 0 and 9999\n\nPlease try again or type "cancel".';
    }

    session.step = 'awaiting_confirmation';
    session.newPrice = priceInput;
    this.sessions.set(userId, session);

    const vehicle = session.currentVehicle!;
    const priceLabels: Record<string, string> = {
      'key': 'Turn Key Min',
      'remote': 'Remote Min', 
      'p2s': 'Push-to-Start Min',
      'ignition': 'Ignition Change/Fix Min'
    };
    
    const yearInfo = vehicle.yearRange ? `📅 **${vehicle.yearRange}** (ENTIRE RANGE)` : `📅 **${vehicle.year}**`;

    return `🔍 **CONFIRM PRICE UPDATE**\n\n🚗 **${vehicle.make} ${vehicle.model}**\n${yearInfo}\n💰 **Price Type:** ${priceLabels[session.priceType!]}\n📊 **Current:** $${session.originalPrice}\n📊 **New:** $${session.newPrice}\n\n⚠️ **This will update pricing for all vehicles in the range!**\n\n**Confirm?** Type "yes" or "no"`;
  }

  private async handlePriceConfirmation(userId: string, session: VehicleSelectionSession, input: string): Promise<string> {
    if (input.toLowerCase().trim() !== 'yes') {
      this.sessions.delete(userId);
      return '❌ Price update cancelled.';
    }

    if (!(this.lookup instanceof PostgresLookup) || !session.currentVehicle || !session.priceType || !session.newPrice) {
      this.sessions.delete(userId);
      return '❌ Error: Database update not available.';
    }

    try {
      // Map price type to database field
      const fieldMap = {
        'key': 'key_min_price' as const,
        'remote': 'remote_min_price' as const, 
        'p2s': 'p2s_min_price' as const,
        'ignition': 'ignition_min_price' as const
      };

      const dbField = fieldMap[session.priceType];
      
      // Update the database
      if (!session.currentVehicle.id) {
        this.sessions.delete(userId);
        return '❌ Error: Vehicle ID not found for database update.';
      }
      
      const success = await this.lookup.updateVehiclePrice(
        session.currentVehicle.id,
        dbField,
        session.newPrice,
        userId
      );

      this.sessions.delete(userId);

      if (success) {
        const vehicle = session.currentVehicle;
        const yearInfo = vehicle.yearRange ? `📅 **${vehicle.yearRange}**` : `📅 **${vehicle.year}**`;
        
        return `✅ **PRICE UPDATED SUCCESSFULLY**\n\n🚗 **${vehicle.make} ${vehicle.model}**\n${yearInfo}\n💰 **${session.priceType.toUpperCase()}:** $${session.originalPrice} → $${session.newPrice}\n\n🕒 **Updated:** ${new Date().toLocaleString()}\n👤 **By:** ${userId}\n\n✨ **Change saved to database with audit trail!**`;
      } else {
        return '❌ **UPDATE FAILED** - Database error. Please try again.';
      }
      
    } catch (error) {
      console.error('Error updating price:', error);
      this.sessions.delete(userId);
      return `❌ **UPDATE ERROR:** ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private parseBasicInput(input: string): { make: string; model?: string; year?: number } | null {
    const parts = input.trim().split(/\s+/);
    if (parts.length === 0) return null;

    const lastPart = parts[parts.length - 1];
    if (!lastPart) return null;
    
    const year = parseInt(lastPart);
    
    if (!isNaN(year) && year >= 1900 && year <= 2050) {
      // Has year
      const make = parts[0];
      if (!make) return null;
      
      return {
        make,
        model: parts.slice(1, -1).join(' '),
        year
      };
    } else {
      // No year
      const make = parts[0];
      if (!make) return null;
      
      return {
        make,
        model: parts.slice(1).join(' ')
      };
    }
  }

  private findYearRangeForVehicle(make: string, model: string, year: number): string | undefined {
    const vehicle = this.vehicleData.find(v => 
      v.make.toLowerCase() === make.toLowerCase() &&
      v.model.toLowerCase() === model.toLowerCase() &&
      this.yearInRange(year, v.yearRange)
    );
    return vehicle?.yearRange;
  }

  private findVehicleId(make: string, model: string, year: number): number | undefined {
    const vehicle = this.vehicleData.find(v => 
      v.make.toLowerCase() === make.toLowerCase() &&
      v.model.toLowerCase() === model.toLowerCase() &&
      this.yearInRange(year, v.yearRange)
    );
    return vehicle?.id;
  }

  private yearInRange(year: number, yearRange: string): boolean {
    if (!yearRange) return false;
    
    // Single year
    if (/^\d{4}$/.test(yearRange.trim())) {
      return parseInt(yearRange.trim(), 10) === year;
    }
    
    // Year range
    const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const startYear = parseInt(rangeMatch[1], 10);
      const endYear = parseInt(rangeMatch[2], 10);
      return year >= startYear && year <= endYear;
    }
    
    return false;
  }

  // Clean up old sessions periodically
  cleanupOldSessions(): void {
    // Could add timestamp tracking in the future
    for (const [userId] of this.sessions.entries()) {
      // Simple cleanup - in production you'd want timestamp-based cleanup
      this.sessions.delete(userId);
    }
  }
}