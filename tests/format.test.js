"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const format_1 = require("../src/logic/format");
(0, vitest_1.describe)('parseUserInput', () => {
    (0, vitest_1.it)('should parse valid input with 3 parts', () => {
        const result = (0, format_1.parseUserInput)('Toyota Corolla 2015');
        (0, vitest_1.expect)(result).toEqual({
            make: 'Toyota',
            model: 'Corolla',
            year: 2015,
        });
    });
    (0, vitest_1.it)('should parse valid input with multi-word model', () => {
        const result = (0, format_1.parseUserInput)('Mercedes-Benz C Class 2020');
        (0, vitest_1.expect)(result).toEqual({
            make: 'Mercedes-Benz',
            model: 'C Class',
            year: 2020,
        });
    });
    (0, vitest_1.it)('should handle extra whitespace', () => {
        const result = (0, format_1.parseUserInput)('  Toyota   Corolla   2015  ');
        (0, vitest_1.expect)(result).toEqual({
            make: 'Toyota',
            model: 'Corolla',
            year: 2015,
        });
    });
    (0, vitest_1.it)('should return null for insufficient parts', () => {
        const result = (0, format_1.parseUserInput)('Toyota 2015');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('should return null for invalid year', () => {
        const result = (0, format_1.parseUserInput)('Toyota Corolla abc');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('should return null for year out of reasonable range', () => {
        const result = (0, format_1.parseUserInput)('Toyota Corolla 1800');
        (0, vitest_1.expect)(result).toBeNull();
    });
});
(0, vitest_1.describe)('formatVehicleResult', () => {
    (0, vitest_1.it)('should format result exactly as specified', () => {
        const result = {
            make: 'Toyota',
            model: 'Corolla',
            year: 2015,
            key: 'TOY43',
            keyMinPrice: '120',
            remoteMinPrice: '80',
            p2sMinPrice: '200',
            ignitionMinPrice: '150',
        };
        const formatted = (0, format_1.formatVehicleResult)(result);
        const expected = `Toyota Corolla 2015

Key: TOY43
Key Min: $120
Remote Min: $80
Push-to-Start Min: $200
Ignition Change/Fix Min: $150`;
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
    (0, vitest_1.it)('should handle empty values correctly', () => {
        const result = {
            make: 'Honda',
            model: 'Civic',
            year: 2020,
            key: '',
            keyMinPrice: '',
            remoteMinPrice: '95',
            p2sMinPrice: '',
            ignitionMinPrice: '180',
        };
        const formatted = (0, format_1.formatVehicleResult)(result);
        const expected = `Honda Civic 2020

Key: 
Key Min: $
Remote Min: $95
Push-to-Start Min: $
Ignition Change/Fix Min: $180`;
        (0, vitest_1.expect)(formatted).toBe(expected);
    });
});
(0, vitest_1.describe)('formatNotFoundMessage', () => {
    (0, vitest_1.it)('should return exact message', () => {
        (0, vitest_1.expect)((0, format_1.formatNotFoundMessage)()).toBe('No matching record found for that vehicle.');
    });
});
(0, vitest_1.describe)('formatInvalidInputMessage', () => {
    (0, vitest_1.it)('should return exact message', () => {
        (0, vitest_1.expect)((0, format_1.formatInvalidInputMessage)()).toBe('Please send: Make Model Year (e.g., "Toyota Corolla 2015")');
    });
});
//# sourceMappingURL=format.test.js.map