import { VehicleLookup, LookupResult } from './vehicleLookup';
export declare class SheetsLookup implements VehicleLookup {
    private cache;
    private readonly sheetsId;
    private readonly range;
    private readonly cacheTTL;
    constructor(sheetsId: string, range: string, cacheTTLMinutes?: number);
    find(make: string, model: string, year: number): Promise<LookupResult | null>;
    private getData;
}
//# sourceMappingURL=sheetsLookup.d.ts.map