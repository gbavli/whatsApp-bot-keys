"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const match_1 = require("../src/logic/match");
const mockData = [
    {
        yearRange: '2010-2015',
        make: 'Toyota',
        model: 'Corolla',
        key: 'TOY43',
        keyMinPrice: '120',
        remoteMinPrice: '80',
        p2sMinPrice: '200',
        ignitionMinPrice: '150',
    },
    {
        yearRange: '2012-2014',
        make: 'Toyota',
        model: 'Corolla',
        key: 'TOY43AT',
        keyMinPrice: '130',
        remoteMinPrice: '90',
        p2sMinPrice: '220',
        ignitionMinPrice: '160',
    },
    {
        yearRange: '2020',
        make: 'Honda',
        model: 'Civic',
        key: 'HON66',
        keyMinPrice: '140',
        remoteMinPrice: '95',
        p2sMinPrice: '240',
        ignitionMinPrice: '180',
    },
];
(0, vitest_1.describe)('matchVehicle', () => {
    (0, vitest_1.it)('should find exact match for single year', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'Honda', 'Civic', 2020);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.make).toBe('Honda');
        (0, vitest_1.expect)(result?.model).toBe('Civic');
        (0, vitest_1.expect)(result?.year).toBe(2020);
        (0, vitest_1.expect)(result?.key).toBe('HON66');
    });
    (0, vitest_1.it)('should find match within year range', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'Toyota', 'Corolla', 2013);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.make).toBe('Toyota');
        (0, vitest_1.expect)(result?.model).toBe('Corolla');
        (0, vitest_1.expect)(result?.year).toBe(2013);
    });
    (0, vitest_1.it)('should prefer more specific year range', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'Toyota', 'Corolla', 2013);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.key).toBe('TOY43AT'); // More specific 2012-2014 range
    });
    (0, vitest_1.it)('should handle make aliases', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'toyota', 'corolla', 2013);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.make).toBe('Toyota');
    });
    (0, vitest_1.it)('should return null for non-matching vehicle', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'Ford', 'Mustang', 2020);
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('should return null for year outside range', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'Toyota', 'Corolla', 2025);
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('should be case insensitive', () => {
        const result = (0, match_1.matchVehicle)(mockData, 'TOYOTA', 'COROLLA', 2013);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result?.make).toBe('Toyota');
    });
});
//# sourceMappingURL=match.test.js.map