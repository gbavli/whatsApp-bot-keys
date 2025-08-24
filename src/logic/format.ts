import { LookupResult } from '../data/vehicleLookup';

export function formatVehicleResult(result: LookupResult, showPricingAction = true): string {
  const { make, model, year, key, keyMinPrice, remoteMinPrice, p2sMinPrice, ignitionMinPrice } =
    result;

  let message = `${make} ${model} ${year}

Key: ${key}
Turn Key Min: $${keyMinPrice}
Remote Min: $${remoteMinPrice}
Push-to-Start Min: $${p2sMinPrice}
Ignition Change/Fix Min: $${ignitionMinPrice}`;

  if (showPricingAction) {
    message += `\n\n💰 **NEED TO UPDATE PRICING?**\n🔧 Press **9** to change prices for this vehicle`;
  }

  return message;
}

export function formatNotFoundMessage(): string {
  return 'No matching record found for that vehicle.';
}

export function formatInvalidInputMessage(): string {
  return 'Please send: Make Model Year (e.g., "Toyota Corolla 2015")';
}

export interface ParsedInput {
  make: string;
  model: string;
  year: number;
}

export function parseUserInput(input: string): ParsedInput | null {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 3) {
    return null;
  }

  // Last part should be the year
  const yearStr = parts[parts.length - 1];
  if (!yearStr) {
    return null;
  }
  const year = parseInt(yearStr, 10);

  if (isNaN(year) || year < 1900 || year > 2050) {
    return null;
  }

  // First part is make, everything in between is model
  const make = parts[0];
  const model = parts.slice(1, -1).join(' ');

  if (!make || !model) {
    return null;
  }

  return { make, model, year };
}