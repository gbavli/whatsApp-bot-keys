"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleSuggestionEngine = void 0;
class VehicleSuggestionEngine {
    constructor(vehicleData) {
        this.vehicleData = vehicleData;
    }
    /**
     * Extract all makes and their models from the database
     */
    getAllMakeModels() {
        const makeModelMap = new Map();
        this.vehicleData.forEach(vehicle => {
            const make = vehicle.make.trim();
            const model = vehicle.model.trim();
            if (!make || !model)
                return;
            if (!makeModelMap.has(make.toLowerCase())) {
                makeModelMap.set(make.toLowerCase(), new Set());
            }
            makeModelMap.get(make.toLowerCase())?.add(model);
        });
        return Array.from(makeModelMap.entries())
            .map(([make, models]) => ({
            make: this.capitalizeWords(make),
            models: Array.from(models).sort()
        }))
            .sort((a, b) => a.make.localeCompare(b.make));
    }
    /**
     * Find the best make match for user input (handles typos)
     */
    findBestMakeMatch(userInput) {
        const makes = this.getAllMakeModels().map(m => m.make);
        const inputLower = userInput.toLowerCase();
        // Exact match first
        const exactMatch = makes.find(make => make.toLowerCase() === inputLower);
        if (exactMatch)
            return exactMatch;
        // Partial match (starts with)
        const partialMatch = makes.find(make => make.toLowerCase().startsWith(inputLower) ||
            inputLower.startsWith(make.toLowerCase()));
        if (partialMatch)
            return partialMatch;
        // Fuzzy match (contains or similar)
        const fuzzyMatch = makes.find(make => {
            const makeLower = make.toLowerCase();
            return makeLower.includes(inputLower) ||
                inputLower.includes(makeLower) ||
                this.levenshteinDistance(makeLower, inputLower) <= 2;
        });
        return fuzzyMatch || null;
    }
    /**
     * Get all models for a specific make
     */
    getModelsForMake(make) {
        const makeModels = this.getAllMakeModels().find(m => m.make.toLowerCase() === make.toLowerCase());
        return makeModels?.models || [];
    }
    /**
     * Format numbered list of models for user selection
     */
    formatModelSelection(make) {
        const models = this.getModelsForMake(make);
        if (models.length === 0) {
            return `No models found for ${make}.`;
        }
        let message = `🚗 **${make.toUpperCase()} MODELS AVAILABLE:**\n\n`;
        models.forEach((model, index) => {
            message += `${index + 1}️⃣ ${model}\n`;
        });
        message += `\n📝 **Reply with the number** of your desired model\n`;
        message += `Example: Reply "3" for ${models[2] || 'third option'}`;
        return message;
    }
    /**
     * Get model by selection number
     */
    getModelByNumber(make, selection) {
        const models = this.getModelsForMake(make);
        if (selection < 1 || selection > models.length) {
            return null;
        }
        return models[selection - 1] || null;
    }
    /**
     * Get all year ranges for a specific make/model combination
     */
    getYearRangesForVehicle(make, model) {
        return this.vehicleData
            .filter(vehicle => vehicle.make.toLowerCase() === make.toLowerCase() &&
            vehicle.model.toLowerCase() === model.toLowerCase())
            .map(vehicle => vehicle.yearRange)
            .filter(yearRange => yearRange.trim())
            .sort();
    }
    /**
     * Format year range selection for user
     */
    formatYearRangeSelection(make, model) {
        const yearRanges = this.getYearRangesForVehicle(make, model);
        if (yearRanges.length === 0) {
            return `No year ranges found for ${make} ${model}.`;
        }
        if (yearRanges.length === 1) {
            return `📅 **${make} ${model}** available for: **${yearRanges[0]}**\n\nReply with a specific year from this range to get pricing.`;
        }
        let message = `📅 **${make} ${model}** - SELECT YEAR RANGE:\n\n`;
        yearRanges.forEach((yearRange, index) => {
            message += `${index + 1}️⃣ ${yearRange}\n`;
        });
        message += `\n📝 **Reply with the number** of your desired year range\n`;
        message += `Then specify a year within that range.`;
        return message;
    }
    /**
     * Simple Levenshtein distance for fuzzy matching
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * Capitalize words properly
     */
    capitalizeWords(str) {
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }
}
exports.VehicleSuggestionEngine = VehicleSuggestionEngine;
