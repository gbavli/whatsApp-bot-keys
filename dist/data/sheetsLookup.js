"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsLookup = void 0;
const googleapis_1 = require("googleapis");
const match_1 = require("../logic/match");
class SheetsLookup {
    constructor(sheetsId, range, cacheTTLMinutes = 5) {
        this.cache = null;
        this.sheetsId = sheetsId;
        this.range = range;
        this.cacheTTL = cacheTTLMinutes * 60 * 1000; // Convert to milliseconds
    }
    async find(make, model, year) {
        const data = await this.getData();
        return (0, match_1.matchVehicle)(data, make, model, year);
    }
    async getData() {
        // Check cache validity
        if (this.cache && Date.now() - this.cache.timestamp < this.cacheTTL) {
            return this.cache.data;
        }
        // Fetch fresh data
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetsId,
                range: this.range,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                throw new Error('No data found in the specified range');
            }
            // Skip header row and parse data
            const data = rows.slice(1).map((row) => ({
                yearRange: String(row[0] || '').trim(),
                make: String(row[1] || '').trim(),
                model: String(row[2] || '').trim(),
                key: String(row[5] || '').trim(),
                keyMinPrice: String(row[7] || '').trim(),
                remoteMinPrice: String(row[9] || '').trim(),
                p2sMinPrice: String(row[11] || '').trim(),
                ignitionMinPrice: String(row[13] || '').trim(),
            }));
            // Update cache
            this.cache = {
                data,
                timestamp: Date.now(),
            };
            return data;
        }
        catch (error) {
            console.error('Error fetching data from Google Sheets:', error);
            throw error;
        }
    }
}
exports.SheetsLookup = SheetsLookup;
//# sourceMappingURL=sheetsLookup.js.map