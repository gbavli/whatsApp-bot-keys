import * as XLSX from 'xlsx';
import { VehicleLookup, VehicleData, LookupResult } from './vehicleLookup';
import { matchVehicle } from '../logic/match';

export class ExcelLookup implements VehicleLookup {
  private data: VehicleData[] | null = null;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async find(make: string, model: string, year: number): Promise<LookupResult | null> {
    const data = await this.getData();
    return matchVehicle(data, make, model, year);
  }

  async getAllVehicles(): Promise<VehicleData[]> {
    return this.getData();
  }

  private async getData(): Promise<VehicleData[]> {
    if (this.data) {
      return this.data;
    }

    try {
      const workbook = XLSX.readFile(this.filePath);
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new Error('No sheets found in the Excel file');
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found in Excel file`);
      }
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      if (rawData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Skip header row and parse data (columns A, B, C, F, H, J, L, N)
      this.data = rawData.slice(1).map((row) => ({
        yearRange: String(row[0] || '').trim(),
        make: String(row[1] || '').trim(),
        model: String(row[2] || '').trim(),
        key: String(row[5] || '').trim(),
        keyMinPrice: String(row[7] || '').trim(),
        remoteMinPrice: String(row[9] || '').trim(),
        p2sMinPrice: String(row[11] || '').trim(),
        ignitionMinPrice: String(row[13] || '').trim(),
      }));

      return this.data;
    } catch (error) {
      console.error(`Error reading Excel file ${this.filePath}:`, error);
      throw error;
    }
  }
}