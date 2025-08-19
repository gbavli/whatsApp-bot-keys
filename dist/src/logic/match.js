"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchVehicle = matchVehicle;
const aliases_1 = require("../config/aliases");
function matchVehicle(data, make, model, year) {
    // Normalize inputs
    const normalizedMake = normalizeMake(make.trim());
    const normalizedModel = model.trim().toLowerCase();
    // Find all potential matches for make and model
    const potentialMatches = data.filter((row) => normalizeString(row.make) === normalizeString(normalizedMake) &&
        normalizeString(row.model) === normalizeString(normalizedModel));
    if (potentialMatches.length === 0) {
        return null;
    }
    // Find matches that include the requested year
    const yearMatches = potentialMatches.filter((row) => isYearInRange(year, row.yearRange));
    if (yearMatches.length === 0) {
        return null;
    }
    // If multiple matches, pick the most specific (smallest year range)
    const bestMatch = yearMatches.reduce((best, current) => {
        const bestSpan = getRangeSpan(best.yearRange);
        const currentSpan = getRangeSpan(current.yearRange);
        return currentSpan < bestSpan ? current : best;
    });
    return {
        make: bestMatch.make,
        model: bestMatch.model,
        year,
        key: bestMatch.key,
        keyMinPrice: bestMatch.keyMinPrice,
        remoteMinPrice: bestMatch.remoteMinPrice,
        p2sMinPrice: bestMatch.p2sMinPrice,
        ignitionMinPrice: bestMatch.ignitionMinPrice,
    };
}
function normalizeMake(make) {
    const normalized = make.toLowerCase().trim();
    return aliases_1.MAKE_ALIASES[normalized] || capitalizeFirst(normalized);
}
function normalizeString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function isYearInRange(year, yearRange) {
    if (!yearRange)
        return false;
    // Handle single year
    if (/^\d{4}$/.test(yearRange.trim())) {
        return parseInt(yearRange.trim(), 10) === year;
    }
    // Handle year range (e.g., "2012–2015", "2012-2015")
    const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        const startYear = parseInt(rangeMatch[1], 10);
        const endYear = parseInt(rangeMatch[2], 10);
        return year >= startYear && year <= endYear;
    }
    return false;
}
function getRangeSpan(yearRange) {
    // Single year has span of 1
    if (/^\d{4}$/.test(yearRange.trim())) {
        return 1;
    }
    // Year range span
    const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
        const startYear = parseInt(rangeMatch[1], 10);
        const endYear = parseInt(rangeMatch[2], 10);
        return endYear - startYear + 1;
    }
    return Number.MAX_SAFE_INTEGER; // Invalid ranges get lowest priority
}
