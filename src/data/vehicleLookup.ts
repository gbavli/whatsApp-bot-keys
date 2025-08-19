export interface VehicleData {
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
  make: string;
  model: string;
  year: number;
  key: string;
  keyMinPrice: string;
  remoteMinPrice: string;
  p2sMinPrice: string;
  ignitionMinPrice: string;
}

export interface VehicleLookup {
  find(make: string, model: string, year: number): Promise<LookupResult | null>;
}

export type DataProvider = 'sheets' | 'excel';