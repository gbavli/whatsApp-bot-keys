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
const priceUpdateCommand_1 = require("../commands/priceUpdateCommand");
class WhatsAppBot {
    constructor(lookup, excelFilePath) {
        this.vehicleData = [];
        this.lookup = lookup;
        this.loadVehicleData();
        // Initialize price update command if Excel file path is provided
        if (excelFilePath) {
            this.priceUpdateCommand = new priceUpdateCommand_1.PriceUpdateCommand(lookup, excelFilePath);
        }
    }
    async loadVehicleData() {
        try {
            console.log('🔄 Loading vehicle data for intelligent parsing...');
            // Load all vehicle data for intelligent parsing
            if ('getAllVehicles' in this.lookup) {
                this.vehicleData = await this.lookup.getAllVehicles();
                console.log(`✅ Loaded ${this.vehicleData.length} vehicles for intelligent parsing`);
            }
            else {
                console.log('⚠️ Lookup provider does not support getAllVehicles');
            }
        }
        catch (error) {
            console.error('❌ Failed to load vehicle data for intelligent parsing:', error);
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
            console.log('🔳 QR CODE FOR WHATSAPP:');
            QRCode.generate(qr, { small: false });
            // Also save QR as URL for easier access
            console.log('📱 QR Code Text (copy this to any QR generator website):');
            console.log('─'.repeat(60));
            console.log(qr);
            console.log('─'.repeat(60));
            console.log('');
            console.log('💡 ALTERNATIVE METHODS TO SCAN:');
            console.log('1. Copy the text above to https://qr-code-generator.com');
            console.log('2. Generate QR code from that text');
            console.log('3. Scan the generated QR with WhatsApp');
            console.log('');
            console.log('OR visit: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qr));
            console.log('');
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
                const response = await this.processMessage(messageText, message.key.remoteJid);
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
    async processMessage(text, userId) {
        console.log(`🔍 Processing: "${text}"`);
        // Handle price update commands first (if price update command is available)
        if (this.priceUpdateCommand && userId) {
            if (this.priceUpdateCommand.isCommand(text)) {
                console.log(`🔧 Processing price update command`);
                return this.priceUpdateCommand.processCommand(userId, text);
            }
        }
        // Skip greetings
        if (text.toLowerCase().match(/^(hi|hello|hey|test)$/i)) {
            const greeting = 'Hello! Send me vehicle info like "Toyota Corolla 2015" to get pricing.';
            if (this.priceUpdateCommand) {
                return greeting + '\n\nType `help` for price update commands.';
            }
            return greeting;
        }
        // Try intelligent parsing first (handles any order)
        if (this.vehicleData.length > 0) {
            console.log(`🧠 Trying intelligent parsing with ${this.vehicleData.length} vehicle records`);
            const smartResults = (0, intelligentParser_1.smartParseVehicle)(text, this.vehicleData);
            if (smartResults.length > 0) {
                console.log(`🎯 Smart parser found ${smartResults.length} potential matches:`);
                smartResults.forEach((match, i) => {
                    console.log(`   ${i + 1}. ${match.make} ${match.model} ${match.year} (confidence: ${match.confidence})`);
                });
                // Try the best match first
                for (const match of smartResults) {
                    console.log(`🔎 Trying smart match: ${match.make} ${match.model} ${match.year}`);
                    const result = await this.lookup.find(match.make, match.model, match.year);
                    if (result) {
                        console.log(`✅ Smart parser success!`);
                        return (0, format_1.formatVehicleResult)(result);
                    }
                }
                console.log(`❌ Smart parser matches found but no data results`);
            }
            else {
                console.log(`❌ Smart parser found no matches`);
            }
        }
        // Fallback to simple parsing (Make Model Year only)
        console.log(`📝 Trying simple parsing...`);
        const parsed = (0, format_1.parseUserInput)(text);
        console.log(`📋 Simple parsed:`, parsed);
        if (parsed) {
            const { make, model, year } = parsed;
            console.log(`🔎 Looking for: ${make} ${model} ${year}`);
            const result = await this.lookup.find(make, model, year);
            console.log(`📊 Result:`, result);
            if (result) {
                return (0, format_1.formatVehicleResult)(result);
            }
        }
        else {
            return (0, format_1.formatInvalidInputMessage)();
        }
        console.log(`❌ No match found for: "${text}"`);
        return (0, format_1.formatNotFoundMessage)();
    }
}
exports.WhatsAppBot = WhatsAppBot;
