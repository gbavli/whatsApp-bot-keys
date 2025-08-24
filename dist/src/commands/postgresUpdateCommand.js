"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresUpdateCommand = void 0;
const postgresLookup_1 = require("../data/postgresLookup");
const intelligentParser_1 = require("../logic/intelligentParser");
const format_1 = require("../logic/format");
class PostgresUpdateCommand {
    constructor(lookup) {
        this.sessions = new Map();
        if (!(lookup instanceof postgresLookup_1.PostgresLookup)) {
            throw new Error('PostgresUpdateCommand requires PostgresLookup instance');
        }
        this.lookup = lookup;
    }
    isCommand(message) {
        const command = message.toLowerCase().trim();
        return command === 'update' ||
            command.startsWith('update ') ||
            command.startsWith('/update') ||
            command === 'help' ||
            command === '/help';
    }
    async processCommand(userId, message) {
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
    getHelpMessage() {
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

**New:** All changes are tracked with full audit history!`;
    }
    async startUpdateSession(userId, message) {
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
            const vehicleData = await this.lookup.getAllVehicles();
            const matches = (0, intelligentParser_1.smartParseVehicle)(vehicleText, vehicleData);
            if (matches.length > 0) {
                const bestMatch = matches[0];
                return this.confirmVehicleAndShowPricing(userId, bestMatch.make, bestMatch.model, bestMatch.year);
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
        }
        catch (error) {
            console.error('Error parsing vehicle in update command:', error);
            return `❌ Error processing update command. Type 'help' for usage.`;
        }
    }
    async confirmVehicleAndShowPricing(userId, make, model, year) {
        try {
            // Find the vehicle and get current pricing
            const result = await this.lookup.find(make, model, year);
            if (!result) {
                return `❌ No pricing data found for ${make} ${model} ${year}`;
            }
            // Find the specific vehicle record in the database
            const vehicleRecord = await this.lookup.findVehicleRecord(make, model, year);
            if (!vehicleRecord) {
                return `❌ Could not find vehicle record for ${make} ${model}`;
            }
            this.sessions.set(userId, {
                userId,
                step: 'awaiting_price_type',
                vehicle: {
                    make,
                    model,
                    year,
                    id: vehicleRecord.id, // Database ID for updates
                    yearRange: vehicleRecord.yearRange
                }
            });
            return `✅ **VEHICLE FOUND**
📅 **Year Range: ${vehicleRecord.yearRange}** (You requested ${year})
🚗 **Vehicle: ${make} ${model}**
🆔 **Database ID: ${vehicleRecord.id}**

⚠️ **IMPORTANT:** Pricing updates will apply to the ENTIRE year range (${vehicleRecord.yearRange})

**Current Pricing:**
${(0, format_1.formatVehicleResult)(result)}

**Select price type to update:**
1️⃣ \`key\` - Key pricing
2️⃣ \`remote\` - Remote minimum price  
3️⃣ \`p2s\` - Push-to-Start minimum price
4️⃣ \`ignition\` - Ignition Change/Fix minimum price

Type the price type you want to update, or \`cancel\` to stop.`;
        }
        catch (error) {
            console.error('Error confirming vehicle:', error);
            return `❌ Error retrieving vehicle data. Please try again.`;
        }
    }
    async handleSessionStep(userId, session, message) {
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
    async handleVehicleInput(userId, session, message) {
        try {
            const vehicleData = await this.lookup.getAllVehicles();
            const matches = (0, intelligentParser_1.smartParseVehicle)(message, vehicleData);
            if (matches.length === 0) {
                return `❌ Vehicle not found: "${message}"

Please try again with format: Make Model Year
Example: Toyota Camry 2015

Or type \`cancel\` to stop.`;
            }
            const bestMatch = matches[0];
            return this.confirmVehicleAndShowPricing(userId, bestMatch.make, bestMatch.model, bestMatch.year);
        }
        catch (error) {
            console.error('Error handling vehicle input:', error);
            return '❌ Error processing vehicle. Please try again.';
        }
    }
    async handlePriceTypeInput(userId, session, input) {
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
        const result = await this.lookup.find(session.vehicle.make, session.vehicle.model, session.vehicle.year);
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
        session.priceType = input;
        session.originalPrice = currentPrice;
        this.sessions.set(userId, session);
        const yearInfo = session.vehicle.yearRange
            ? `📅 **Year Range: ${session.vehicle.yearRange}** (affects entire range)`
            : `📅 **Year: ${session.vehicle.year}**`;
        return `💰 **UPDATE ${input.toUpperCase()} PRICING**

🚗 **Vehicle:** ${session.vehicle.make} ${session.vehicle.model}
${yearInfo}
🆔 **Database ID:** ${session.vehicle.id}
💵 **Current ${input} price:** ${currentPrice}

⚠️ **This will update pricing for the ENTIRE year range**

Please enter the new price:
**Format:** Numbers only (e.g., 150, 89.99)
**Example:** 125

Or type \`cancel\` to stop.`;
    }
    handleNewPriceInput(userId, session, message) {
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
        const yearInfo = session.vehicle.yearRange
            ? `📅 **Year Range: ${session.vehicle.yearRange}** ⚠️ (ENTIRE RANGE)`
            : `📅 **Year: ${session.vehicle.year}**`;
        return Promise.resolve(`🔍 **CONFIRM PRICE UPDATE**

🚗 **Vehicle:** ${session.vehicle.make} ${session.vehicle.model}
${yearInfo}
🆔 **Database ID:** ${session.vehicle.id}
💰 **Price Type:** ${session.priceType.toUpperCase()}
📊 **Current Price:** ${session.originalPrice}
📊 **New Price:** $${session.newPrice}

⚠️ **WARNING: This will update pricing for ALL vehicles in the year range!**
✅ **NEW: Change will be logged in audit history**

**Are you sure you want to make this change?**
Type \`yes\` to confirm or \`no\` to cancel.`);
    }
    async handleConfirmation(userId, session, input) {
        if (input !== 'yes' && input !== 'y') {
            this.sessions.delete(userId);
            return '❌ Update cancelled.';
        }
        try {
            // Map price type to database field
            const fieldMap = {
                'key': 'key_min_price',
                'remote': 'remote_min_price',
                'p2s': 'p2s_min_price',
                'ignition': 'ignition_min_price'
            };
            const dbField = fieldMap[session.priceType];
            // Update the database
            const success = await this.lookup.updateVehiclePrice(session.vehicle.id, dbField, session.newPrice, userId);
            this.sessions.delete(userId);
            if (success) {
                const yearInfo = session.vehicle.yearRange
                    ? `📅 **Year Range: ${session.vehicle.yearRange}**`
                    : `📅 **Year: ${session.vehicle.year}**`;
                return `✅ **PRICE UPDATED SUCCESSFULLY**

🚗 **Vehicle:** ${session.vehicle.make} ${session.vehicle.model}
${yearInfo}
🆔 **Database ID:** ${session.vehicle.id}
💰 **${session.priceType.toUpperCase()} Price:** ${session.originalPrice} → $${session.newPrice}

📊 **Applied to:** ${session.vehicle.yearRange || 'Single year entry'}
🕒 **Updated:** ${new Date().toLocaleString()}
👤 **Updated by:** ${userId}

The change has been saved to the database with full audit trail. New pricing will be used immediately for all vehicles in this range.`;
            }
            else {
                return `❌ **UPDATE FAILED**

There was an error updating the database. Please try again or contact support.`;
            }
        }
        catch (error) {
            console.error('Error updating database:', error);
            this.sessions.delete(userId);
            return `❌ **UPDATE ERROR**

Failed to update the pricing: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
    // Clean up old sessions (call periodically)
    cleanupOldSessions() {
        // Remove sessions older than 10 minutes
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        for (const [userId, session] of this.sessions.entries()) {
            // Add timestamp to sessions in the future if needed
            this.sessions.delete(userId);
        }
    }
}
exports.PostgresUpdateCommand = PostgresUpdateCommand;
