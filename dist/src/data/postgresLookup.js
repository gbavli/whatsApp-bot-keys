"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresLookup = void 0;
const pg_1 = require("pg");
const match_1 = require("../logic/match");
class PostgresLookup {
    constructor() {
        this.data = null;
        this.connected = false;
        this.client = new pg_1.Client(process.env.DATABASE_URL ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        } : {
            host: process.env.PGHOST,
            port: parseInt(process.env.PGPORT || '5432'),
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }
    async connect() {
        if (!this.connected) {
            try {
                await this.client.connect();
                this.connected = true;
                console.log('🔌 Connected to PostgreSQL');
            }
            catch (error) {
                if (error.message && error.message.includes('already been connected')) {
                    console.log('ℹ️  PostgreSQL client already connected');
                    this.connected = true;
                }
                else {
                    throw error;
                }
            }
        }
    }
    async find(make, model, year) {
        const data = await this.getAllVehicles();
        return (0, match_1.matchVehicle)(data, make, model, year);
    }
    async getAllVehicles() {
        if (this.data) {
            console.log(`📊 Using cached data: ${this.data.length} records`);
            return this.data;
        }
        try {
            await this.connect();
            console.log('📁 Loading vehicle data from PostgreSQL...');
            const result = await this.client.query(`
        SELECT 
          id,
          year_range,
          make,
          model,
          key_type,
          key_min_price,
          remote_min_price,
          p2s_min_price,
          ignition_min_price
        FROM vehicles
        ORDER BY make, model, year_range
      `);
            this.data = result.rows.map(row => ({
                id: row.id, // Add database ID for updates
                yearRange: row.year_range || '',
                make: row.make || '',
                model: row.model || '',
                key: row.key_type || '',
                keyMinPrice: row.key_min_price || '',
                remoteMinPrice: row.remote_min_price || '',
                p2sMinPrice: row.p2s_min_price || '',
                ignitionMinPrice: row.ignition_min_price || '',
            }));
            console.log(`✅ Loaded ${this.data.length} vehicle records from PostgreSQL`);
            return this.data;
        }
        catch (error) {
            console.error('❌ Error loading data from PostgreSQL:', error);
            throw error;
        }
    }
    // Update a specific vehicle's pricing
    async updateVehiclePrice(vehicleId, field, newPrice, userId) {
        try {
            await this.connect();
            // Get current price for audit log
            const currentResult = await this.client.query(`SELECT ${field} FROM vehicles WHERE id = $1`, [vehicleId]);
            const oldPrice = currentResult.rows[0]?.[field] || '';
            // Update the price
            await this.client.query(`UPDATE vehicles SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newPrice, vehicleId]);
            // Log the change in audit table
            await this.client.query(`
        INSERT INTO price_updates (vehicle_id, user_id, field_changed, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5)
      `, [vehicleId, userId, field, oldPrice, newPrice]);
            // Clear cache to force reload
            this.clearCache();
            console.log(`✅ Updated vehicle ${vehicleId} ${field}: ${oldPrice} → ${newPrice}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Error updating vehicle price:`, error);
            return false;
        }
    }
    // Get vehicle by exact make, model, and year match
    async findVehicleRecord(make, model, year) {
        const vehicles = await this.getAllVehicles();
        // Use the same matching logic as the main lookup
        const potentialMatches = vehicles.filter((row) => row.make.toLowerCase() === make.toLowerCase() &&
            row.model.toLowerCase() === model.toLowerCase());
        // Find the record that matches the specific year
        const matchingRecord = potentialMatches.find((vehicle) => {
            const yearRange = vehicle.yearRange;
            if (!yearRange)
                return false;
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
        return matchingRecord || null;
    }
    // Clear cached data to force reload
    clearCache() {
        console.log('🔄 Clearing PostgreSQL data cache');
        this.data = null;
    }
    // Get price update history for a vehicle
    async getPriceHistory(vehicleId) {
        try {
            await this.connect();
            const result = await this.client.query(`
        SELECT 
          field_changed,
          old_value,
          new_value,
          user_id,
          changed_at
        FROM price_updates 
        WHERE vehicle_id = $1 
        ORDER BY changed_at DESC
        LIMIT 10
      `, [vehicleId]);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error fetching price history:', error);
            return [];
        }
    }
    async disconnect() {
        if (this.connected) {
            await this.client.end();
            this.connected = false;
            console.log('👋 Disconnected from PostgreSQL');
        }
    }
}
exports.PostgresLookup = PostgresLookup;
