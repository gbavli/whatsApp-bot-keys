import * as XLSX from 'xlsx';
import { VehicleLookup, VehicleData } from '../data/vehicleLookup';
import { smartParseVehicle } from '../logic/intelligentParser';
import { formatVehicleResult } from '../logic/format';

export interface PriceUpdateSession {
  userId: string;
  step: 'awaiting_vehicle' | 'awaiting_price_type' | 'awaiting_new_price' | 'awaiting_confirmation';
  vehicle?: {
    make: string;
    model: string;
    year: number;
    rowIndex?: number;
    yearRange?: string;
  };
  priceType?: 'key' | 'remote' | 'p2s' | 'ignition';
  newPrice?: string;
  originalPrice?: string;
}

export class PriceUpdateCommand {
  private sessions: Map<string, PriceUpdateSession> = new Map();
  private lookup: VehicleLookup;
  private excelFilePath: string;
  
  // TODO: Future enhancement - Option 2: Range Splitting
  // Add methods to split year ranges when user wants year-specific pricing:
  // - splitYearRange(originalRange: string, targetYear: number)
  // - addNewVehicleRecord(make, model, year, priceData)
  // - updateExcelWithNewRow(rowData)
  // This will allow creating separate entries like:
  // 2014-2017 Honda Civic, 2018 Honda Civic, 2019-2021 Honda Civic

  constructor(lookup: VehicleLookup, excelFilePath: string) {
    this.lookup = lookup;
    this.excelFilePath = excelFilePath;
  }

  isCommand(message: string): boolean {
    const command = message.toLowerCase().trim();
    return command === 'update' ||
           command.startsWith('update ') || 
           command.startsWith('/update') || 
           command === 'help' ||
           command === '/help';
  }

  async processCommand(userId: string, message: string): Promise<string> {
    const command = message.toLowerCase().trim();

    // Handle help command
    if (command === 'help' || command === '/help') {
      return this.getHelpMessage();
    }

    // Handle update command start
    if (command === 'update' || command.startsWith('update ') || command.startsWith('/update')) {
      return this.startUpdateSession(userId, message);
    }

    // Handle ongoing session
    const session = this.sessions.get(userId);
    if (!session) {
      return "No active update session. Type 'help' for available commands.";
    }

    return this.handleSessionStep(userId, session, message);
  }

  private getHelpMessage(): string {
    return `🔧 **PRICING UPDATE COMMANDS**

**Start Update:**
• \`update Toyota Camry 2015\` - Update specific vehicle
• \`update\` - Start guided update process

**During Update:**
• Choose price type: key, remote, p2s, ignition
• Enter new price (numbers only)
• Confirm changes

**Examples:**
• \`update Honda Civic 2018\`
• \`update Ford F150 2020\`

**Note:** Updates apply to entire year ranges
**Cancel:** Type \`cancel\` to stop update process

**Future:** Split range feature coming soon!`;
  }

  private async startUpdateSession(userId: string, message: string): Promise<string> {
    // Extract vehicle info from command
    const vehicleText = message.replace(/^(update|\/update)\s*/i, '').trim();
    
    if (!vehicleText) {
      // Start guided process
      this.sessions.set(userId, {
        userId,
        step: 'awaiting_vehicle'
      });
      return `🚗 **START PRICE UPDATE**

Please send the vehicle information:
**Format:** Make Model Year
**Example:** Toyota Camry 2015

Or type \`cancel\` to stop.`;
    }

    // Try to parse vehicle from command
    try {
      if ('getAllVehicles' in this.lookup) {
        const vehicleData = await (this.lookup as any).getAllVehicles();
        const matches = smartParseVehicle(vehicleText, vehicleData as VehicleData[]);
        
        if (matches.length > 0) {
          const bestMatch = matches[0]!;
          return this.confirmVehicleAndShowPricing(userId, bestMatch.make, bestMatch.model, bestMatch.year);
        }
      }
      
      // Fallback: start guided process
      this.sessions.set(userId, {
        userId,
        step: 'awaiting_vehicle'
      });
      return `❌ Vehicle not found: "${vehicleText}"

Please send the vehicle information:
**Format:** Make Model Year
**Example:** Toyota Camry 2015`;
      
    } catch (error) {
      console.error('Error parsing vehicle in update command:', error);
      return `❌ Error processing update command. Type 'help' for usage.`;
    }
  }

  private async confirmVehicleAndShowPricing(userId: string, make: string, model: string, year: number): Promise<string> {
    try {
      // Find the vehicle and get current pricing
      const result = await this.lookup.find(make, model, year);
      if (!result) {
        return `❌ No pricing data found for ${make} ${model} ${year}`;
      }

      // Find the actual vehicle record with year range
      let vehicleRecord: VehicleData | null = null;
      let rowIndex = -1;
      if ('getAllVehicles' in this.lookup) {
        const vehicleData = await (this.lookup as any).getAllVehicles() as VehicleData[];
        
        // Find ALL potential matches for make and model
        const potentialMatches = vehicleData.map((v, index) => ({ vehicle: v, index }))
          .filter(({ vehicle }) => 
            vehicle.make.toLowerCase() === make.toLowerCase() &&
            vehicle.model.toLowerCase() === model.toLowerCase()
          );
        
        // Find the record that matches the specific year (using same logic as matchVehicle)
        const matchingRecord = potentialMatches.find(({ vehicle }) => {
          const yearRange = vehicle.yearRange;
          if (!yearRange) return false;
          
          // Handle single year
          if (/^\d{4}$/.test(yearRange.trim())) {
            return parseInt(yearRange.trim(), 10) === year;
          }
          
          // Handle year range
          const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
          if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
            const startYear = parseInt(rangeMatch[1], 10);
            const endYear = parseInt(rangeMatch[2], 10);
            return year >= startYear && year <= endYear;
          }
          
          return false;
        });
        
        if (matchingRecord) {
          vehicleRecord = matchingRecord.vehicle;
          rowIndex = matchingRecord.index + 2; // +2 for header row and 0-based index
        }
      }

      if (!vehicleRecord) {
        return `❌ Could not find vehicle record for ${make} ${model}`;
      }

      this.sessions.set(userId, {
        userId,
        step: 'awaiting_price_type',
        vehicle: { make, model, year, rowIndex, yearRange: vehicleRecord.yearRange }
      });

      return `✅ **VEHICLE FOUND**
📅 **Year Range: ${vehicleRecord.yearRange}** (You requested ${year})
🚗 **Vehicle: ${make} ${model}**

⚠️ **IMPORTANT:** Pricing updates will apply to the ENTIRE year range (${vehicleRecord.yearRange})

**Current Pricing:**
${formatVehicleResult(result)}

**Select price type to update:**
1️⃣ \`key\` - Key pricing
2️⃣ \`remote\` - Remote minimum price  
3️⃣ \`p2s\` - Push-to-Start minimum price
4️⃣ \`ignition\` - Ignition Change/Fix minimum price

Type the price type you want to update, or \`cancel\` to stop.`;

    } catch (error) {
      console.error('Error confirming vehicle:', error);
      return `❌ Error retrieving vehicle data. Please try again.`;
    }
  }

  private async handleSessionStep(userId: string, session: PriceUpdateSession, message: string): Promise<string> {
    const input = message.toLowerCase().trim();

    // Handle cancel
    if (input === 'cancel') {
      this.sessions.delete(userId);
      return '❌ Update cancelled.';
    }

    switch (session.step) {
      case 'awaiting_vehicle':
        return this.handleVehicleInput(userId, session, message);
      
      case 'awaiting_price_type':
        return this.handlePriceTypeInput(userId, session, input);
      
      case 'awaiting_new_price':
        return this.handleNewPriceInput(userId, session, message);
      
      case 'awaiting_confirmation':
        return this.handleConfirmation(userId, session, input);
      
      default:
        this.sessions.delete(userId);
        return '❌ Session error. Please start over with `update`.';
    }
  }

  private async handleVehicleInput(userId: string, session: PriceUpdateSession, message: string): Promise<string> {
    try {
      if ('getAllVehicles' in this.lookup) {
        const vehicleData = await (this.lookup as any).getAllVehicles() as VehicleData[];
        const matches = smartParseVehicle(message, vehicleData);
        
        if (matches.length === 0) {
          return `❌ Vehicle not found: "${message}"

Please try again with format: Make Model Year
Example: Toyota Camry 2015

Or type \`cancel\` to stop.`;
        }

        const bestMatch = matches[0]!;
        return this.confirmVehicleAndShowPricing(userId, bestMatch.make, bestMatch.model, bestMatch.year);
      } else {
        return '❌ Vehicle lookup not supported with current data provider.';
      }
      
    } catch (error) {
      console.error('Error handling vehicle input:', error);
      return '❌ Error processing vehicle. Please try again.';
    }
  }

  private async handlePriceTypeInput(userId: string, session: PriceUpdateSession, input: string): Promise<string> {
    const validTypes = ['key', 'remote', 'p2s', 'ignition'];
    
    if (!validTypes.includes(input)) {
      return `❌ Invalid price type: "${input}"

Please choose one of:
1️⃣ \`key\` - Key pricing
2️⃣ \`remote\` - Remote minimum price  
3️⃣ \`p2s\` - Push-to-Start minimum price
4️⃣ \`ignition\` - Ignition Change/Fix minimum price

Or type \`cancel\` to stop.`;
    }

    // Get current price
    const result = await this.lookup.find(session.vehicle!.make, session.vehicle!.model, session.vehicle!.year);
    if (!result) {
      this.sessions.delete(userId);
      return '❌ Error retrieving current pricing. Please start over.';
    }

    let currentPrice = '';
    switch (input) {
      case 'key':
        currentPrice = result.key || 'Not set';
        break;
      case 'remote':
        currentPrice = result.remoteMinPrice || 'Not set';
        break;
      case 'p2s':
        currentPrice = result.p2sMinPrice || 'Not set';
        break;
      case 'ignition':
        currentPrice = result.ignitionMinPrice || 'Not set';
        break;
    }

    session.step = 'awaiting_new_price';
    session.priceType = input as any;
    session.originalPrice = currentPrice;
    this.sessions.set(userId, session);

    const yearInfo = session.vehicle!.yearRange 
      ? `📅 **Year Range: ${session.vehicle!.yearRange}** (affects entire range)`
      : `📅 **Year: ${session.vehicle!.year}**`;

    return `💰 **UPDATE ${input.toUpperCase()} PRICING**

🚗 **Vehicle:** ${session.vehicle!.make} ${session.vehicle!.model}
${yearInfo}
💵 **Current ${input} price:** ${currentPrice}

⚠️ **This will update pricing for the ENTIRE year range**

Please enter the new price:
**Format:** Numbers only (e.g., 150, 89.99)
**Example:** 125

Or type \`cancel\` to stop.`;
  }

  private handleNewPriceInput(userId: string, session: PriceUpdateSession, message: string): Promise<string> {
    const priceInput = message.trim();
    
    // Validate price format
    if (!/^\d+(\.\d{1,2})?$/.test(priceInput)) {
      return Promise.resolve(`❌ Invalid price format: "${priceInput}"

Please enter numbers only:
**Examples:** 150, 89.99, 75

Or type \`cancel\` to stop.`);
    }

    const newPrice = parseFloat(priceInput);
    if (newPrice < 0 || newPrice > 9999) {
      return Promise.resolve(`❌ Price must be between 0 and 9999

Please enter a valid price or type \`cancel\` to stop.`);
    }

    session.step = 'awaiting_confirmation';
    session.newPrice = priceInput;
    this.sessions.set(userId, session);

    const yearInfo = session.vehicle!.yearRange 
      ? `📅 **Year Range: ${session.vehicle!.yearRange}** ⚠️ (ENTIRE RANGE)`
      : `📅 **Year: ${session.vehicle!.year}**`;

    return Promise.resolve(`🔍 **CONFIRM PRICE UPDATE**

🚗 **Vehicle:** ${session.vehicle!.make} ${session.vehicle!.model}
${yearInfo}
💰 **Price Type:** ${session.priceType!.toUpperCase()}
📊 **Current Price:** ${session.originalPrice}
📊 **New Price:** $${session.newPrice}

⚠️ **WARNING: This will update pricing for ALL vehicles in the year range!**

**Are you sure you want to make this change?**
Type \`yes\` to confirm or \`no\` to cancel.`);
  }

  private async handleConfirmation(userId: string, session: PriceUpdateSession, input: string): Promise<string> {
    if (input !== 'yes' && input !== 'y') {
      this.sessions.delete(userId);
      return '❌ Update cancelled.';
    }

    try {
      // Update the Excel file
      const success = await this.updateExcelFile(session);
      this.sessions.delete(userId);

      if (success) {
        const yearInfo = session.vehicle!.yearRange 
          ? `📅 **Year Range: ${session.vehicle!.yearRange}**`
          : `📅 **Year: ${session.vehicle!.year}**`;

        return `✅ **PRICE UPDATED SUCCESSFULLY**

🚗 **Vehicle:** ${session.vehicle!.make} ${session.vehicle!.model}
${yearInfo}
💰 **${session.priceType!.toUpperCase()} Price:** ${session.originalPrice} → $${session.newPrice}

📊 **Applied to:** ${session.vehicle!.yearRange || 'Single year entry'}

The change has been saved to the database. New pricing will be used immediately for all vehicles in this range.`;
      } else {
        return `❌ **UPDATE FAILED**

There was an error updating the Excel file. Please try again or check the file permissions.`;
      }
      
    } catch (error) {
      console.error('Error updating Excel file:', error);
      this.sessions.delete(userId);
      return `❌ **UPDATE ERROR**

Failed to update the pricing: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async updateExcelFile(session: PriceUpdateSession): Promise<boolean> {
    try {
      console.log(`📝 Updating Excel file: ${this.excelFilePath}`);
      
      // Read the Excel file
      const workbook = XLSX.readFile(this.excelFilePath);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No sheets found in Excel file');
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('Worksheet not found');
      }

      // Determine column to update based on price type
      let columnIndex: number;
      switch (session.priceType!) {
        case 'key':
          columnIndex = 5; // Column F (0-based)
          break;
        case 'remote':
          columnIndex = 9; // Column J
          break;
        case 'p2s':
          columnIndex = 11; // Column L
          break;
        case 'ignition':
          columnIndex = 13; // Column N
          break;
        default:
          throw new Error(`Unknown price type: ${session.priceType}`);
      }

      // Update the cell
      const rowIndex = session.vehicle!.rowIndex;
      if (rowIndex === undefined) {
        throw new Error('Row index not found for vehicle');
      }
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex });
      worksheet[cellAddress] = { t: 's', v: session.newPrice };

      // Write the file back
      XLSX.writeFile(workbook, this.excelFilePath);
      
      // Clear cached data so it reloads with new values
      if ('clearCache' in this.lookup) {
        (this.lookup as any).clearCache();
      }
      
      console.log(`✅ Successfully updated ${session.priceType} price for ${session.vehicle!.make} ${session.vehicle!.model}`);
      return true;
      
    } catch (error) {
      console.error('Error updating Excel file:', error);
      return false;
    }
  }

  // Clean up old sessions (call periodically)
  cleanupOldSessions(): void {
    // Remove sessions older than 10 minutes
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    for (const [userId, session] of this.sessions.entries()) {
      // Add timestamp to sessions in the future if needed
      this.sessions.delete(userId);
    }
  }
}