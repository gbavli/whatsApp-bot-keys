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
exports.createSampleExcel = createSampleExcel;
const XLSX = __importStar(require("xlsx"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Sample vehicle data
const sampleData = [
    // Header row
    [
        'Year Range', // A
        'Make', // B  
        'Model', // C
        '', // D - Empty
        '', // E - Empty
        'Key', // F
        '', // G - Empty  
        'Key Minimum Price', // H
        '', // I - Empty
        'Remote Minimum Price', // J
        '', // K - Empty
        'P2S Minimum Price', // L
        '', // M - Empty
        'Ignition Change/Fix Minimum Price', // N
    ],
    // Data rows
    ['2015-2020', 'Toyota', 'Corolla', '', '', 'TOY43', '', '120', '', '80', '', '200', '', '150'],
    ['2012-2014', 'Toyota', 'Corolla', '', '', 'TOY43AT', '', '130', '', '90', '', '220', '', '160'],
    ['2020', 'Honda', 'Civic', '', '', 'HON66', '', '140', '', '95', '', '240', '', '180'],
    ['2018-2022', 'Ford', 'F150', '', '', 'FO38', '', '110', '', '75', '', '190', '', '140'],
    ['2016-2019', 'Chevrolet', 'Camaro', '', '', 'GM46', '', '135', '', '85', '', '210', '', '165'],
    ['2017-2021', 'BMW', 'X3', '', '', 'BMW202', '', '200', '', '150', '', '350', '', '280'],
    ['2019-2023', 'Mercedes-Benz', 'C Class', '', '', 'MB906', '', '250', '', '180', '', '400', '', '320'],
];
function createSampleExcel() {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    // Add some basic styling (column widths)
    ws['!cols'] = [
        { wch: 12 }, // A - Year Range
        { wch: 15 }, // B - Make
        { wch: 15 }, // C - Model
        { wch: 8 }, // D
        { wch: 8 }, // E
        { wch: 12 }, // F - Key
        { wch: 8 }, // G
        { wch: 18 }, // H - Key Min Price
        { wch: 8 }, // I
        { wch: 18 }, // J - Remote Min Price
        { wch: 8 }, // K
        { wch: 18 }, // L - P2S Min Price
        { wch: 8 }, // M
        { wch: 25 }, // N - Ignition Min Price
    ];
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    const filePath = path.join(dataDir, 'pricebook.xlsx');
    try {
        // Create the data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Write file
        XLSX.writeFile(wb, filePath);
        console.log(`✅ Sample Excel file created at: ${filePath}`);
        console.log('📊 Contains 7 sample vehicle records for testing');
    }
    catch (error) {
        console.error('❌ Error creating sample Excel file:', error);
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    createSampleExcel();
}
//# sourceMappingURL=createSampleData.js.map