export interface VehicleData {
  id?: number; // Optional database ID for PostgreSQL
  yearRange: string;
  make: string;
  model: string;
  key: string;
  keyMinPrice: string;
  remoteMinPrice: string;
  p2sMinPrice: string;
  ignitionMinPrice: string;
}

export interface LookupResult {
  id?: number; // Optional database ID for PostgreSQL
  make: string;
  model: string;
  year: number;
  yearRange?: string; // Optional year range info
  key: string;
  keyMinPrice: string;
  remoteMinPrice: string;
  p2sMinPrice: string;
  ignitionMinPrice: string;
}

export interface VehicleLookup {
  find(make: string, model: string, year: number): Promise<LookupResult | null>;
}

export type DataProvider = 'sheets' | 'excel' | 'postgres';