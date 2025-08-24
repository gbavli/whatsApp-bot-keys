"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatVehicleResult = formatVehicleResult;
exports.formatNotFoundMessage = formatNotFoundMessage;
exports.formatInvalidInputMessage = formatInvalidInputMessage;
exports.parseUserInput = parseUserInput;
function formatVehicleResult(result, showPricingAction = true) {
    const { make, model, year, key, keyMinPrice, remoteMinPrice, p2sMinPrice, ignitionMinPrice } = result;
    let message = `${make} ${model} ${year}

Key: ${key}
Turn Key Min: $${keyMinPrice}
Remote Min: $${remoteMinPrice}
Push-to-Start Min: $${p2sMinPrice}
Ignition Change/Fix Min: $${ignitionMinPrice}`;
    if (showPricingAction) {
        message += `\n\nupdate pricing ? press 9`;
    }
    return message;
}
function formatNotFoundMessage() {
    return 'No matching record found for that vehicle.';
}
function formatInvalidInputMessage() {
    return 'Please send: Make Model Year (e.g., "Toyota Corolla 2015")';
}
function parseUserInput(input) {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length < 1) {
        return null;
    }
    const make = parts[0];
    if (!make) {
        return null;
    }
    // Single word - make only
    if (parts.length === 1) {
        return { make, type: 'make_only' };
    }
    // Check if last part is a year
    const lastPart = parts[parts.length - 1];
    if (!lastPart) {
        return null;
    }
    const year = parseInt(lastPart, 10);
    const hasYear = !isNaN(year) && year >= 1900 && year <= 2050;
    if (hasYear && parts.length >= 3) {
        // Full format: Make Model Year
        const model = parts.slice(1, -1).join(' ');
        return { make, model, year, type: 'full' };
    }
    else if (!hasYear && parts.length >= 2) {
        // Make Model (no year)
        const model = parts.slice(1).join(' ');
        return { make, model: model, type: 'make_model' };
    }
    // Invalid format
    return null;
}
