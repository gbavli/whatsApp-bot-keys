"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveVehicleCommand = void 0;
const postgresLookup_1 = require("../data/postgresLookup");
const format_1 = require("../logic/format");
class InteractiveVehicleCommand {
    constructor(lookup) {
        this.sessions = new Map();
        this.vehicleData = [];
        this.lookup = lookup;
        this.loadVehicleData();
        // Clean up old sessions every 5 minutes
        setInterval(() => this.cleanupOldSessions(), 5 * 60 * 1000);
    }
    async loadVehicleData() {
        try {
            if ('getAllVehicles' in this.lookup) {
                this.vehicleData = await this.lookup.getAllVehicles();
                console.log(`🎯 Interactive system loaded ${this.vehicleData.length} vehicles`);
            }
        }
        catch (error) {
            console.error('❌ Failed to load vehicle data for interactive system:', error);
        }
    }
    cleanupOldSessions() {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        for (const [userId, session] of this.sessions.entries()) {
            if (session.lastActivity < cutoff) {
                this.sessions.delete(userId);
            }
        }
    }
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
    async processMessage(userId, text) {
        const session = this.getSession(userId);
        const trimmedText = text.trim();
        // Handle price update mode (press 9)
        if (session.state === 'updating_price') {
            return await this.handlePriceUpdate(userId, trimmedText);
        }
        // Handle model selection
        if (session.state === 'selecting_model') {
            return this.handleModelSelection(userId, trimmedText);
        }
        // Handle year selection  
        if (session.state === 'selecting_year') {
            return await this.handleYearSelection(userId, trimmedText);
        }
        // Handle price update trigger (9)
        if (trimmedText === '9' && session.vehicleData) {
            this.updateSession(userId, { state: 'updating_price' });
            return this.showPriceUpdateMenu(session.vehicleData);
        }
        // Parse new vehicle request
        const parsed = (0, format_1.parseUserInput)(trimmedText);
        if (!parsed) {
            return null; // Let other handlers deal with it
        }
        console.log(`🎯 Interactive system processing:`, parsed);
        switch (parsed.type) {
            case 'make_only':
                return this.handleMakeOnlySearch(userId, parsed.make);
            case 'make_model':
                return await this.handleMakeModelSearch(userId, parsed.make, parsed.model);
            case 'full':
                return await this.handleFullSearch(userId, parsed.make, parsed.model, parsed.year);
        }
        return null;
    }
    handleMakeOnlySearch(userId, make) {
        // Get all models for this make
        const makeModels = this.getModelsForMake(make);
        if (makeModels.length === 0) {
            return `No models found for ${make}.`;
        }
        // Store session for model selection
        this.updateSession(userId, {
            state: 'selecting_model',
            make: make,
            models: makeModels
        });
        let message = `🚗 **${make.toUpperCase()} MODELS:**\n\n`;
        makeModels.forEach((model, index) => {
            message += `${index + 1}. ${model}\n`;
        });
        message += `\n📝 Reply with the **number** or **model name**`;
        return message;
    }
    async handleMakeModelSearch(userId, make, model) {
        // Get year ranges for this make/model
        const yearRanges = this.getYearRangesForVehicle(make, model);
        if (yearRanges.length === 0) {
            return `No year ranges found for ${make} ${model}.`;
        }
        if (yearRanges.length === 1) {
            return `📅 **${make} ${model}** available for: **${yearRanges[0]}**\n\nSend a specific year from this range to get pricing.`;
        }
        // Store session for year selection
        this.updateSession(userId, {
            state: 'selecting_year',
            make: make,
            model: model,
            yearRanges: yearRanges
        });
        let message = `📅 **${make} ${model}** - SELECT YEAR RANGE:\n\n`;
        yearRanges.forEach((yearRange, index) => {
            message += `${index + 1}. ${yearRange}\n`;
        });
        message += `\n📝 Reply with the **number** or **specific year**`;
        return message;
    }
    async handleFullSearch(userId, make, model, year) {
        const result = await this.lookup.find(make, model, year);
        if (result) {
            // Store the result for potential price updates - convert to VehicleData format
            const vehicleData = {
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
            return (0, format_1.formatVehicleResult)(result);
        }
        else {
            // Try to offer alternative years
            const yearRanges = this.getYearRangesForVehicle(make, model);
            if (yearRanges.length > 0) {
                return `No exact match for ${make} ${model} ${year}.\n\nAvailable years: ${yearRanges.join(', ')}\n\nTry one of these years instead.`;
            }
            return `No matching record found for ${make} ${model} ${year}.`;
        }
    }
    handleModelSelection(userId, selection) {
        const session = this.getSession(userId);
        if (!session.models || !session.make) {
            return 'Session expired. Please start over.';
        }
        const make = session.make; // Extract for type safety
        let selectedModel;
        // Check if it's a number selection
        const num = parseInt(selection, 10);
        if (!isNaN(num) && num >= 1 && num <= session.models.length) {
            selectedModel = session.models[num - 1];
        }
        else {
            // Check if it's a direct model name match
            selectedModel = session.models.find(model => model.toLowerCase() === selection.toLowerCase());
        }
        if (!selectedModel) {
            return `Please select a valid option (1-${session.models.length}) or model name.`;
        }
        // Now get year ranges for this make/model
        const yearRanges = this.getYearRangesForVehicle(make, selectedModel);
        if (yearRanges.length === 0) {
            this.updateSession(userId, { state: 'idle' });
            return `No year data found for ${make} ${selectedModel}.`;
        }
        if (yearRanges.length === 1) {
            this.updateSession(userId, { state: 'idle' });
            return `📅 **${make} ${selectedModel}** available for: **${yearRanges[0]}**\n\nSend a specific year from this range to get pricing.`;
        }
        // Multiple year ranges - let user select
        this.updateSession(userId, {
            state: 'selecting_year',
            model: selectedModel,
            yearRanges: yearRanges
        });
        let message = `📅 **${make} ${selectedModel}** - SELECT YEAR RANGE:\n\n`;
        yearRanges.forEach((yearRange, index) => {
            message += `${index + 1}. ${yearRange}\n`;
        });
        message += `\n📝 Reply with the **number** or **specific year**`;
        return message;
    }
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
            const result = await this.lookup.find(make, model, directYear);
            if (result) {
                // Convert to VehicleData format
                const vehicleData = {
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
                return (0, format_1.formatVehicleResult)(result);
            }
            else {
                return `No exact match for ${make} ${model} ${directYear}.\n\nAvailable ranges: ${session.yearRanges.join(', ')}`;
            }
        }
        // Check if it's a number selection for year range
        const num = parseInt(selection, 10);
        if (!isNaN(num) && num >= 1 && num <= session.yearRanges.length) {
            const selectedRange = session.yearRanges[num - 1];
            this.updateSession(userId, { state: 'idle' });
            return `📅 Selected range: **${selectedRange}**\n\nNow send: ${make} ${model} [specific year from ${selectedRange}]`;
        }
        return `Please enter a specific year or select a range (1-${session.yearRanges.length}).`;
    }
    showPriceUpdateMenu(vehicleData) {
        return `🔧 **UPDATE PRICING FOR ${vehicleData.make} ${vehicleData.model}**\n\n` +
            `Current Prices:\n` +
            `1. Turn Key Min: $${vehicleData.keyMinPrice}\n` +
            `2. Remote Min: $${vehicleData.remoteMinPrice}\n` +
            `3. Push-to-Start Min: $${vehicleData.p2sMinPrice}\n` +
            `4. Ignition Change/Fix Min: $${vehicleData.ignitionMinPrice}\n\n` +
            `📝 Reply with: **[number] [new price]**\n` +
            `Example: "1 150" to change Turn Key Min to $150`;
    }
    async handlePriceUpdate(userId, text) {
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
        if (!/^\d+$/.test(newPrice)) {
            return 'Invalid price format. Use numbers only (e.g., "150")';
        }
        const fieldName = fieldMap[fieldNum];
        // Update in database if PostgresLookup
        if (this.lookup instanceof postgresLookup_1.PostgresLookup && vehicleData.id) {
            const success = await this.lookup.updateVehiclePrice(vehicleData.id, fieldName, newPrice, userId);
            this.updateSession(userId, { state: 'idle' });
            if (success) {
                return `✅ **PRICE UPDATED**\n\n${vehicleData.make} ${vehicleData.model}\n${this.getFieldDisplayName(fieldName)}: $${newPrice}\n\nUpdate saved to database!`;
            }
            else {
                return `❌ Failed to update price. Please try again.`;
            }
        }
        this.updateSession(userId, { state: 'idle' });
        return `⚠️ Price updates not supported for this data source.`;
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
    getModelsForMake(make) {
        const models = new Set();
        this.vehicleData.forEach(vehicle => {
            if (vehicle.make.toLowerCase() === make.toLowerCase()) {
                models.add(vehicle.model);
            }
        });
        return Array.from(models).sort();
    }
    getYearRangesForVehicle(make, model) {
        return this.vehicleData
            .filter(vehicle => vehicle.make.toLowerCase() === make.toLowerCase() &&
            vehicle.model.toLowerCase() === model.toLowerCase())
            .map(vehicle => vehicle.yearRange)
            .filter(yearRange => yearRange.trim())
            .filter((range, index, self) => self.indexOf(range) === index) // unique
            .sort();
    }
}
exports.InteractiveVehicleCommand = InteractiveVehicleCommand;
