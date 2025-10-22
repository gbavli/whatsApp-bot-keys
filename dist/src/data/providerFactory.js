"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVehicleLookup = getVehicleLookup;
const excelLookup_1 = require("./excelLookup");
const postgresLookup_1 = require("./postgresLookup");
async function getVehicleLookup() {
    const provider = process.env.DATA_PROVIDER || 'postgres';
    console.log(`📊 Data Provider: ${provider}`);
    switch (provider) {
        case 'postgres': {
            return new postgresLookup_1.PostgresLookup();
        }
        case 'excel': {
            const filePath = process.env.EXCEL_PATH || './keys.xlsx';
            console.log(`📁 Using Excel file: ${filePath}`);
            return new excelLookup_1.ExcelLookup(filePath);
        }
        default:
            throw new Error(`Unknown data provider: ${provider}. Use 'postgres' or 'excel'.`);
    }
}
