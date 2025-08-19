"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppBot = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const QRCode = __importStar(require("qrcode-terminal"));
const format_1 = require("../logic/format");
const intelligentParser_1 = require("../logic/intelligentParser");
class WhatsAppBot {
    constructor(lookup) {
        this.vehicleData = [];
        this.lookup = lookup;
        this.loadVehicleData();
    }
    async loadVehicleData() {
        try {
            // Load all vehicle data for intelligent parsing
            if ('getAllVehicles' in this.lookup) {
                this.vehicleData = await this.lookup.getAllVehicles();
            }
        }
        catch (error) {
            console.error('Failed to load vehicle data for intelligent parsing:', error);
        }
    }
    async start() {
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)('./auth');
        const sock = (0, baileys_1.default)({
            auth: state,
            logger: (0, pino_1.default)({ level: 'silent' }), // Silent logger using Pino
            printQRInTerminal: false,
        });
        sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update, sock));
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', ({ messages }) => this.handleMessages(messages, sock));
    }
    async handleConnectionUpdate(update, sock) {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            QRCode.generate(qr, { small: true });
            console.log('📱 Scan the QR code above to connect');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error);
            if (shouldReconnect) {
                console.log('Reconnecting...');
                this.start();
            }
        }
        else if (connection === 'open') {
            console.log('✅ WhatsApp bot connected successfully');
        }
    }
    async handleMessages(messages, sock) {
        for (const message of messages) {
            if (!message.message || message.key.fromMe || !message.key.remoteJid) {
                continue;
            }
            const messageText = message.message.conversation ||
                message.message.extendedTextMessage?.text ||
                '';
            if (!messageText.trim()) {
                continue;
            }
            console.log(`📩 Received: "${messageText}" from ${message.key.remoteJid}`);
            try {
                const response = await this.processMessage(messageText);
                await sock.sendMessage(message.key.remoteJid, { text: response });
                console.log(`📤 Sent: "${response}"`);
            }
            catch (error) {
                console.error('Error processing message:', error);
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Sorry, there was an error processing your request. Please try again.',
                });
            }
        }
    }
    async processMessage(text) {
        // Try intelligent parsing first
        if (this.vehicleData.length > 0) {
            const smartResults = (0, intelligentParser_1.smartParseVehicle)(text, this.vehicleData);
            if (smartResults.length > 0) {
                // Try the best match first
                const bestMatch = smartResults[0];
                if (bestMatch) {
                    const result = await this.lookup.find(bestMatch.make, bestMatch.model, bestMatch.year);
                    if (result) {
                        return (0, format_1.formatVehicleResult)(result);
                    }
                }
                // If best match didn't work, try other matches
                for (let i = 1; i < smartResults.length; i++) {
                    const match = smartResults[i];
                    if (match) {
                        const result = await this.lookup.find(match.make, match.model, match.year);
                        if (result) {
                            return (0, format_1.formatVehicleResult)(result);
                        }
                    }
                }
            }
        }
        // Fallback to simple parsing
        const parsed = (0, format_1.parseUserInput)(text);
        if (parsed) {
            const { make, model, year } = parsed;
            const result = await this.lookup.find(make, model, year);
            if (result) {
                return (0, format_1.formatVehicleResult)(result);
            }
        }
        return (0, format_1.formatNotFoundMessage)();
    }
}
exports.WhatsAppBot = WhatsAppBot;
