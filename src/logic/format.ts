import { LookupResult } from '../data/vehicleLookup';

export function formatVehicleResult(result: LookupResult, showPricingAction = true): string {
  const { make, model, year, key, keyMinPrice, remoteMinPrice, p2sMinPrice, ignitionMinPrice } =
    result;

  // Helper function to format price with fallback
  const formatPrice = (price: string | undefined): string => {
    return price && price.trim() !== '' ? `$${price}` : 'N/A';
  };

  // Format key with fallback
  const formatKey = (key: string | undefined): string => {
    return key && key.trim() !== '' ? key : 'N/A';
  };

  let message = `${make} ${model} ${year}

Key: ${formatKey(key)}
Turn Key Min: ${formatPrice(keyMinPrice)}
Remote Min: ${formatPrice(remoteMinPrice)}
Push-to-Start Min: ${formatPrice(p2sMinPrice)}
Ignition Change/Fix Min: ${formatPrice(ignitionMinPrice)}`;

  if (showPricingAction) {
    message += `\n\nupdate pricing ? press 9`;
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
  model?: string;
  year?: number;
  type: 'full' | 'make_model' | 'make_only';
}

export function parseUserInput(input: string): ParsedInput | null {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 1) {
    return null;
  }

  const make = parts[0];
  if (!make) {
    return null;
  }

  // Single word - check if it's a year (should return null) or make
  if (parts.length === 1) {
    const singleYear = parseInt(make, 10);
    if (!isNaN(singleYear) && singleYear >= 1900 && singleYear <= 2050) {
      return null; // Single year is not valid input
    }
    return { make, type: 'make_only' };
  }

  // Check if first part is a year (Year Make Model format)
  const firstYear = parseInt(parts[0]!, 10);
  const hasYearFirst = !isNaN(firstYear) && firstYear >= 1900 && firstYear <= 2050;

  if (hasYearFirst && parts.length >= 3) {
    // Format: Year Make Model -> convert to Make Model Year
    const make = parts[1]!;
    const model = parts.slice(2).join(' ');
    return { make, model, year: firstYear, type: 'full' };
  }

  // Check if last part is a year (Make Model Year format)
  const lastPart = parts[parts.length - 1];
  if (!lastPart) {
    return null;
  }
  const year = parseInt(lastPart, 10);
  const hasYearLast = !isNaN(year) && year >= 1900 && year <= 2050;

  if (hasYearLast && parts.length >= 3) {
    // Full format: Make Model Year
    const model = parts.slice(1, -1).join(' ');
    return { make, model, year, type: 'full' };
  } else if (!hasYearLast && parts.length >= 2) {
    // Make Model (no year)
    const model = parts.slice(1).join(' ');
    return { make, model: model, type: 'make_model' };
  }

  // Invalid format
  return null;
}