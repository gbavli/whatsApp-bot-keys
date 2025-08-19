import { VehicleLookup } from '../data/vehicleLookup';
export declare class WhatsAppBot {
    private lookup;
    constructor(lookup: VehicleLookup);
    start(): Promise<void>;
    private handleConnectionUpdate;
    private handleMessages;
    private processMessage;
}
//# sourceMappingURL=whatsapp.d.ts.map