"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddVehicleCommand = void 0;
const postgresLookup_1 = require("../data/postgresLookup");
class AddVehicleCommand {
    constructor(lookup) {
        this.sessions = new Map();
        this.lookup = lookup;
        // Clean up old sessions every 10 minutes
        setInterval(() => this.cleanupOldSessions(), 10 * 60 * 1000);
    }
    cleanupOldSessions() {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
        for (const [userId, session] of this.sessions.entries()) {
            if (session.lastActivity < cutoff) {
                this.sessions.delete(userId);
            }
        }
    }
    getSession(userId) {
        return this.sessions.get(userId) || null;
    }
    updateSession(userId, updates) {
        let session = this.sessions.get(userId);
        if (!session) {
            session = {
                userId,
                state: 'pending_make',
                lastActivity: new Date()
            };
            this.sessions.set(userId, session);
        }
        Object.assign(session, updates);
        session.lastActivity = new Date();
    }
    // Check if user wants to add a new vehicle after "not found" message
    canStartAddVehicle(text) {
        const addTriggers = [
            'add', 'add new', 'add vehicle', 'create', 'new',
            'add it', 'add this', 'create new', 'yes add'
        ];
        const lowerText = text.toLowerCase().trim();
        return addTriggers.some(trigger => lowerText.includes(trigger));
    }
    startAddVehicle(userId, originalMake, originalModel, originalYear) {
        this.updateSession(userId, {
            state: 'pending_make',
            make: originalMake,
            model: originalModel,
            year: originalYear
        });
        if (originalMake && originalModel && originalYear) {
            // We have the vehicle info from the original search
            this.updateSession(userId, {
                state: 'pending_key',
                yearRange: originalYear.toString()
            });
            return `🆕 ADD NEW VEHICLE: ${originalMake} ${originalModel} ${originalYear}\n\n` +
                `What type of key is this?\n\n` +
                `Examples:\n` +
                `• "Standard Key"\n` +
                `• "Smart Key"\n` +
                `• "Proximity Key"\n` +
                `• "Transponder Key"\n\n` +
                `Reply with the key type:`;
        }
        return `🆕 ADD NEW VEHICLE\n\n` +
            `Let's add this vehicle to the database.\n\n` +
            `What's the make? (e.g., "BMW", "Toyota")`;
    }
    async processMessage(userId, text) {
        const session = this.getSession(userId);
        if (!session) {
            return null; // Not in add vehicle flow
        }
        const trimmedText = text.trim();
        switch (session.state) {
            case 'pending_make':
                return this.handleMakeInput(userId, trimmedText);
            case 'pending_model':
                return this.handleModelInput(userId, trimmedText);
            case 'pending_year':
                return this.handleYearInput(userId, trimmedText);
            case 'pending_key':
                return this.handleKeyInput(userId, trimmedText);
            case 'pending_prices':
                return this.handlePricesInput(userId, trimmedText);
            case 'confirming':
                return await this.handleConfirmation(userId, trimmedText);
        }
        return null;
    }
    handleMakeInput(userId, make) {
        if (!make || make.length < 2) {
            return 'Please enter a valid make (e.g., "BMW", "Toyota")';
        }
        this.updateSession(userId, {
            state: 'pending_model',
            make: this.capitalizeMake(make)
        });
        return `Make: ${this.capitalizeMake(make)}\n\n` +
            `What's the model? (e.g., "i8", "Corolla")`;
    }
    handleModelInput(userId, model) {
        if (!model || model.length < 1) {
            return 'Please enter a valid model (e.g., "i8", "Corolla")';
        }
        this.updateSession(userId, {
            state: 'pending_year',
            model: this.capitalizeModel(model)
        });
        const session = this.getSession(userId);
        return `${session.make} ${this.capitalizeModel(model)}\n\n` +
            `What year or year range?\n\n` +
            `Examples:\n` +
            `• "2023" (single year)\n` +
            `• "2020-2024" (range)\n\n` +
            `Reply with the year:`;
    }
    handleYearInput(userId, yearInput) {
        const session = this.getSession(userId);
        // Validate year format
        if (!/^\d{4}(-\d{4})?$/.test(yearInput.trim())) {
            return 'Please enter a valid year format:\n• "2023" (single year)\n• "2020-2024" (range)';
        }
        // Extract year for database
        const yearParts = yearInput.split('-');
        const firstYearStr = yearParts[0];
        if (!firstYearStr) {
            return 'Invalid year format';
        }
        const firstYear = parseInt(firstYearStr);
        if (firstYear < 1900 || firstYear > 2030) {
            return 'Please enter a realistic year (1900-2030)';
        }
        this.updateSession(userId, {
            state: 'pending_key',
            year: firstYear,
            yearRange: yearInput.trim()
        });
        return `${session.make} ${session.model} ${yearInput}\n\n` +
            `What type of key is this?\n\n` +
            `Examples:\n` +
            `• "Standard Key"\n` +
            `• "Smart Key"\n` +
            `• "Proximity Key"\n` +
            `• "Transponder Key"\n\n` +
            `Reply with the key type:`;
    }
    handleKeyInput(userId, keyType) {
        if (!keyType || keyType.length < 2) {
            return 'Please enter a valid key type (e.g., "Smart Key", "Standard Key")';
        }
        this.updateSession(userId, {
            state: 'pending_prices',
            key: keyType
        });
        const session = this.getSession(userId);
        return `${session.make} ${session.model} ${session.yearRange} - ${keyType}\n\n` +
            `Now enter the pricing information:\n\n` +
            `Format: [turn key] [remote] [push2start] [ignition]\n` +
            `Example: "150 180 250 300"\n\n` +
            `Enter all 4 prices separated by spaces:`;
    }
    handlePricesInput(userId, pricesText) {
        const prices = pricesText.trim().split(/\s+/);
        if (prices.length !== 4) {
            return 'Please enter exactly 4 prices separated by spaces:\n' +
                'Format: [turn key] [remote] [push2start] [ignition]\n' +
                'Example: "150 180 250 300"';
        }
        // Validate all prices are numbers
        const numericPrices = prices.map(p => parseInt(p.replace(/\$/, '')));
        if (numericPrices.some(p => isNaN(p) || p < 0 || p > 9999)) {
            return 'Please enter valid prices (0-9999):\n' +
                'Example: "150 180 250 300"';
        }
        this.updateSession(userId, {
            state: 'confirming',
            keyMinPrice: numericPrices[0]?.toString() || '0',
            remoteMinPrice: numericPrices[1]?.toString() || '0',
            p2sMinPrice: numericPrices[2]?.toString() || '0',
            ignitionMinPrice: numericPrices[3]?.toString() || '0'
        });
        const session = this.getSession(userId);
        return `🔍 REVIEW NEW VEHICLE:\n\n` +
            `${session.make} ${session.model} ${session.yearRange}\n` +
            `Key: ${session.key}\n\n` +
            `Turn Key Min: $${session.keyMinPrice}\n` +
            `Remote Min: $${session.remoteMinPrice}\n` +
            `Push-to-Start Min: $${session.p2sMinPrice}\n` +
            `Ignition Change/Fix Min: $${session.ignitionMinPrice}\n\n` +
            `Type "YES" to add this vehicle or "NO" to cancel:`;
    }
    async handleConfirmation(userId, confirmation) {
        const session = this.getSession(userId);
        if (confirmation.toLowerCase() !== 'yes') {
            this.sessions.delete(userId);
            return 'Vehicle addition cancelled.';
        }
        // Add vehicle to database if using PostgresLookup
        if (this.lookup instanceof postgresLookup_1.PostgresLookup) {
            try {
                const success = await this.addVehicleToDatabase(session);
                this.sessions.delete(userId);
                if (success) {
                    return `✅ VEHICLE ADDED SUCCESSFULLY!\n\n` +
                        `${session.make} ${session.model} ${session.yearRange}\n` +
                        `Key: ${session.key}\n\n` +
                        `Saved to database and ready for use!`;
                }
                else {
                    return `❌ Failed to add vehicle to database. Please try again later.`;
                }
            }
            catch (error) {
                this.sessions.delete(userId);
                return `❌ Error adding vehicle: ${error}`;
            }
        }
        this.sessions.delete(userId);
        return `⚠️ Vehicle addition not supported for this data source.`;
    }
    async addVehicleToDatabase(session) {
        if (!(this.lookup instanceof postgresLookup_1.PostgresLookup)) {
            return false;
        }
        try {
            // Connect to database first
            await this.lookup.connect();
            // Add vehicle to database using direct query
            const client = this.lookup.client;
            if (!client) {
                console.error('Database client not available');
                return false;
            }
            console.log('🔄 Adding vehicle to database:', {
                yearRange: session.yearRange,
                make: session.make,
                model: session.model,
                key: session.key
            });
            await client.query(`
        INSERT INTO vehicles (year_range, make, model, key_type, key_min_price, remote_min_price, p2s_min_price, ignition_min_price, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
                session.yearRange,
                session.make,
                session.model,
                session.key,
                session.keyMinPrice,
                session.remoteMinPrice,
                session.p2sMinPrice,
                session.ignitionMinPrice
            ]);
            console.log('✅ Vehicle added to database successfully');
            // Clear cache to include new vehicle - this is CRUCIAL for searchability
            this.lookup.clearCache();
            console.log('🔄 Cache cleared - new vehicle will be searchable');
            return true;
        }
        catch (error) {
            console.error('❌ Error adding vehicle to database:', error);
            return false;
        }
    }
    capitalizeMake(make) {
        // Special handling for common makes
        const specialCases = {
            'bmw': 'BMW',
            'gmc': 'GMC',
            'ram': 'RAM',
            'kia': 'Kia',
            'mini': 'MINI',
            'fiat': 'FIAT'
        };
        const lower = make.toLowerCase();
        return specialCases[lower] || make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
    }
    capitalizeModel(model) {
        return model.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    isInAddVehicleFlow(userId) {
        return this.sessions.has(userId);
    }
    cancelAddVehicle(userId) {
        if (this.sessions.has(userId)) {
            this.sessions.delete(userId);
            return 'Vehicle addition cancelled.';
        }
        return '';
    }
}
exports.AddVehicleCommand = AddVehicleCommand;
