import { VehicleLookup, DataProvider } from './vehicleLookup';
import { ExcelLookup } from './excelLookup';
import { PostgresLookup } from './postgresLookup';

export async function getVehicleLookup(): Promise<VehicleLookup> {
  const provider = (process.env.DATA_PROVIDER as DataProvider) || 'postgres';
  
  console.log(`📊 Data Provider: ${provider}`);

  switch (provider) {
    case 'postgres': {
      return new PostgresLookup();
    }

    case 'excel': {
      const filePath = process.env.EXCEL_PATH || './keys.xlsx';
      console.log(`📁 Using Excel file: ${filePath}`);
      return new ExcelLookup(filePath);
    }

    default:
      throw new Error(`Unknown data provider: ${provider}. Use 'postgres' or 'excel'.`);
  }
}