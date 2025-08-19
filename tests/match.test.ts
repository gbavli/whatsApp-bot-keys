import { describe, it, expect } from 'vitest';
import { matchVehicle } from '../src/logic/match';
import { VehicleData } from '../src/data/vehicleLookup';

const mockData: VehicleData[] = [
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

describe('matchVehicle', () => {
  it('should find exact match for single year', () => {
    const result = matchVehicle(mockData, 'Honda', 'Civic', 2020);
    expect(result).not.toBeNull();
    expect(result?.make).toBe('Honda');
    expect(result?.model).toBe('Civic');
    expect(result?.year).toBe(2020);
    expect(result?.key).toBe('HON66');
  });

  it('should find match within year range', () => {
    const result = matchVehicle(mockData, 'Toyota', 'Corolla', 2013);
    expect(result).not.toBeNull();
    expect(result?.make).toBe('Toyota');
    expect(result?.model).toBe('Corolla');
    expect(result?.year).toBe(2013);
  });

  it('should prefer more specific year range', () => {
    const result = matchVehicle(mockData, 'Toyota', 'Corolla', 2013);
    expect(result).not.toBeNull();
    expect(result?.key).toBe('TOY43AT'); // More specific 2012-2014 range
  });

  it('should handle make aliases', () => {
    const result = matchVehicle(mockData, 'toyota', 'corolla', 2013);
    expect(result).not.toBeNull();
    expect(result?.make).toBe('Toyota');
  });

  it('should return null for non-matching vehicle', () => {
    const result = matchVehicle(mockData, 'Ford', 'Mustang', 2020);
    expect(result).toBeNull();
  });

  it('should return null for year outside range', () => {
    const result = matchVehicle(mockData, 'Toyota', 'Corolla', 2025);
    expect(result).toBeNull();
  });

  it('should be case insensitive', () => {
    const result = matchVehicle(mockData, 'TOYOTA', 'COROLLA', 2013);
    expect(result).not.toBeNull();
    expect(result?.make).toBe('Toyota');
  });
});