import { describe, it, expect } from 'vitest';
import {
  parseUserInput,
  formatVehicleResult,
  formatNotFoundMessage,
  formatInvalidInputMessage,
} from '../src/logic/format';
import { LookupResult } from '../src/data/vehicleLookup';

describe('parseUserInput', () => {
  it('should parse valid input with 3 parts', () => {
    const result = parseUserInput('Toyota Corolla 2015');
    expect(result).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      year: 2015,
      type: 'full',
    });
  });

  it('should parse valid input with multi-word model', () => {
    const result = parseUserInput('Mercedes-Benz C Class 2020');
    expect(result).toEqual({
      make: 'Mercedes-Benz',
      model: 'C Class',
      year: 2020,
      type: 'full',
    });
  });

  it('should handle extra whitespace', () => {
    const result = parseUserInput('  Toyota   Corolla   2015  ');
    expect(result).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      year: 2015,
      type: 'full',
    });
  });

  it('should parse make only', () => {
    const result = parseUserInput('Toyota');
    expect(result).toEqual({
      make: 'Toyota',
      type: 'make_only',
    });
  });

  it('should parse make and model', () => {
    const result = parseUserInput('Toyota Corolla');
    expect(result).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      type: 'make_model',
    });
  });

  it('should parse make and model even with non-year text', () => {
    const result = parseUserInput('Toyota Corolla abc');
    expect(result).toEqual({
      make: 'Toyota',
      model: 'Corolla abc',
      type: 'make_model',
    });
  });

  it('should parse make and model for year out of range', () => {
    const result = parseUserInput('Toyota Corolla 1800');
    expect(result).toEqual({
      make: 'Toyota',
      model: 'Corolla 1800',
      type: 'make_model',
    });
  });
});

describe('formatVehicleResult', () => {
  it('should format result exactly as specified', () => {
    const result: LookupResult = {
      make: 'Toyota',
      model: 'Corolla',
      year: 2015,
      key: 'TOY43',
      keyMinPrice: '120',
      remoteMinPrice: '80',
      p2sMinPrice: '200',
      ignitionMinPrice: '150',
    };

    const formatted = formatVehicleResult(result);
    const expected = `Toyota Corolla 2015

Key: TOY43
Turn Key Min: $120
Remote Min: $80
Push-to-Start Min: $200
Ignition Change/Fix Min: $150

update pricing ? press 9`;

    expect(formatted).toBe(expected);
  });

  it('should handle empty values correctly', () => {
    const result: LookupResult = {
      make: 'Honda',
      model: 'Civic',
      year: 2020,
      key: '',
      keyMinPrice: '',
      remoteMinPrice: '95',
      p2sMinPrice: '',
      ignitionMinPrice: '180',
    };

    const formatted = formatVehicleResult(result);
    const expected = `Honda Civic 2020

Key: N/A
Turn Key Min: N/A
Remote Min: $95
Push-to-Start Min: N/A
Ignition Change/Fix Min: $180

update pricing ? press 9`;

    expect(formatted).toBe(expected);
  });
});

describe('formatNotFoundMessage', () => {
  it('should return exact message', () => {
    expect(formatNotFoundMessage()).toBe('No matching record found for that vehicle.');
  });
});

describe('formatInvalidInputMessage', () => {
  it('should return exact message', () => {
    expect(formatInvalidInputMessage()).toBe(
      'Please send: Make Model Year (e.g., "Toyota Corolla 2015")'
    );
  });
});