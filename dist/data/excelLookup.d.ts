import { VehicleLookup, LookupResult } from './vehicleLookup';
export declare class ExcelLookup implements VehicleLookup {
    private data;
    private readonly filePath;
    constructor(filePath: string);
    find(make: string, model: string, year: number): Promise<LookupResult | null>;
    private getData;
}
//# sourceMappingURL=excelLookup.d.ts.map