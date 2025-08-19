import { LookupResult } from '../data/vehicleLookup';
export declare function formatVehicleResult(result: LookupResult): string;
export declare function formatNotFoundMessage(): string;
export declare function formatInvalidInputMessage(): string;
export interface ParsedInput {
    make: string;
    model: string;
    year: number;
}
export declare function parseUserInput(input: string): ParsedInput | null;
//# sourceMappingURL=format.d.ts.map