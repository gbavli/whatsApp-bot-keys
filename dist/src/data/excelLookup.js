"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelLookup = void 0;
const XLSX = __importStar(require("xlsx"));
const match_1 = require("../logic/match");
class ExcelLookup {
    constructor(filePath) {
        this.data = null;
        this.filePath = filePath;
    }
    async find(make, model, year) {
        const data = await this.getData();
        return (0, match_1.matchVehicle)(data, make, model, year);
    }
    async getAllVehicles() {
        return this.getData();
    }
    // Clear cached data to force reload (useful after updates)
    clearCache() {
        console.log('🔄 Clearing Excel data cache');
        this.data = null;
    }
    async getData() {
        if (this.data) {
            console.log(`📊 Using cached data: ${this.data.length} records`);
            return this.data;
        }
        try {
            console.log(`📁 Reading Excel file: ${this.filePath}`);
            const workbook = XLSX.readFile(this.filePath);
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new Error('No sheets found in the Excel file');
            }
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error(`Sheet '${sheetName}' not found in Excel file`);
            }
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            console.log(`📋 Raw data rows: ${rawData.length}`);
            if (rawData.length < 2) {
                throw new Error('Excel file must contain at least a header row and one data row');
            }
            // Skip header row and parse data (columns A, B, C, F, H, J, L, N)
            this.data = rawData.slice(1).map((row) => ({
                yearRange: String(row[0] || '').trim(),
                make: String(row[1] || '').trim(),
                model: String(row[2] || '').trim(),
                key: String(row[5] || '').trim(),
                keyMinPrice: String(row[7] || '').trim(),
                remoteMinPrice: String(row[9] || '').trim(),
                p2sMinPrice: String(row[11] || '').trim(),
                ignitionMinPrice: String(row[13] || '').trim(),
            }));
            console.log(`✅ Loaded ${this.data.length} vehicle records`);
            return this.data;
        }
        catch (error) {
            console.error(`❌ Error reading Excel file ${this.filePath}:`, error);
            throw error;
        }
    }
}
exports.ExcelLookup = ExcelLookup;
