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
const priceUpdateCommand_1 = require("../commands/priceUpdateCommand");
const postgresUpdateCommand_1 = require("../commands/postgresUpdateCommand");
const postgresLookup_1 = require("../data/postgresLookup");
const enhancedVehicleCommand_1 = require("../commands/enhancedVehicleCommand");
const interactiveVehicleCommand_1 = require("../commands/interactiveVehicleCommand");
const addVehicleCommand_1 = require("../commands/addVehicleCommand");
class WhatsAppBot {
    constructor(lookup, excelFilePath) {
        this.vehicleData = [];
        this.lookup = lookup;
        try {
            this.enhancedVehicleCommand = new enhancedVehicleCommand_1.EnhancedVehicleCommand(lookup);
            console.log('✅ Enhanced vehicle command initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize enhanced vehicle command:', error);
            // Create a minimal fallback
            this.enhancedVehicleCommand = {
                processMessage: async () => null,
                cleanupOldSessions: () => { }
            };
        }
        // Initialize interactive command system
        try {
            this.interactiveCommand = new interactiveVehicleCommand_1.InteractiveVehicleCommand(lookup);
            console.log('✅ Interactive vehicle command initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize interactive vehicle command:', error);
            // Create a minimal fallback
            this.interactiveCommand = {
                processMessage: async () => null
            };
        }
        // Initialize add vehicle command system
        try {
            this.addVehicleCommand = new addVehicleCommand_1.AddVehicleCommand(lookup);
            console.log('✅ Add vehicle command initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize add vehicle command:', error);
            // Create a minimal fallback
            this.addVehicleCommand = {
                processMessage: async () => null,
                canStartAddVehicle: () => false,
                isInAddVehicleFlow: () => false,
                startAddVehicle: () => 'Add vehicle not available'
            };
        }
        this.loadVehicleData();
        // Initialize appropriate price update command based on lookup type
        try {
            if (lookup instanceof postgresLookup_1.PostgresLookup) {
                this.priceUpdateCommand = new postgresUpdateCommand_1.PostgresUpdateCommand(lookup);
                console.log('✅ PostgreSQL price update command initialized');
            }
            else if (excelFilePath) {
                this.priceUpdateCommand = new priceUpdateCommand_1.PriceUpdateCommand(lookup, excelFilePath);
                console.log('✅ Excel price update command initialized');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize price update command:', error);
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
        // Handle price update commands first (legacy command system)
        if (this.priceUpdateCommand && userId) {
            if (this.priceUpdateCommand.isCommand(text)) {
                console.log(`🔧 Processing legacy price update command`);
                return this.priceUpdateCommand.processCommand(userId, text);
            }
        }
        // Handle add vehicle flow
        if (userId && this.addVehicleCommand.isInAddVehicleFlow(userId)) {
            console.log(`🆕 Processing add vehicle flow`);
            const addResult = await this.addVehicleCommand.processMessage(userId, text);
            if (addResult !== null) {
                console.log(`✅ Add vehicle command handled the message`);
                return addResult;
            }
        }
        // Skip greetings
        if (text.toLowerCase().match(/^(hi|hello|hey|test)$/i)) {
            const greeting = 'Hello! Send me vehicle info to get pricing.';
            return greeting + '\n\n💡 **EXAMPLES:**\n• "Toyota" - see all Toyota models\n• "Toyota Corolla" - see available years\n• "Toyota Corolla 2015" - get pricing\n• Press **9** after any result to update prices';
        }
        // For long complex text with potential typos, try enhanced parsing first
        const isComplexText = text.split(/\s+/).length > 3;
        if (userId && isComplexText) {
            console.log(`🧠 Complex text detected, trying enhanced parsing first`);
            const enhancedResult = await this.enhancedVehicleCommand.processMessage(userId, text);
            if (enhancedResult !== null) {
                console.log(`✅ Enhanced vehicle command handled complex text`);
                return enhancedResult;
            }
            console.log(`➡️ Enhanced didn't handle complex text, trying interactive`);
        }
        // Try interactive vehicle command system for simple searches
        if (userId) {
            console.log(`🎯 Trying interactive vehicle command`);
            const interactiveResult = await this.interactiveCommand.processMessage(userId, text);
            if (interactiveResult !== null) {
                console.log(`✅ Interactive vehicle command handled the message`);
                return interactiveResult;
            }
            console.log(`➡️ Interactive command didn't handle message, trying enhanced`);
        }
        // Try enhanced vehicle command for remaining cases
        if (userId && !isComplexText) {
            console.log(`🚀 Trying enhanced vehicle command for simple text`);
            const enhancedResult = await this.enhancedVehicleCommand.processMessage(userId, text);
            if (enhancedResult !== null) {
                console.log(`✅ Enhanced vehicle command handled the message`);
                return enhancedResult;
            }
            console.log(`➡️ Enhanced command didn't handle message, trying fallback`);
        }
        // Check if user wants to add a new vehicle
        if (userId && this.addVehicleCommand.canStartAddVehicle(text)) {
            console.log(`🆕 User wants to add a vehicle`);
            // Check if we have pending vehicle info from a previous search
            const pending = this.pendingAddVehicle;
            if (pending && pending.userId === userId) {
                console.log(`📋 Using pending vehicle info: ${pending.make} ${pending.model} ${pending.year}`);
                this.pendingAddVehicle = null; // Clear pending
                return this.addVehicleCommand.startAddVehicle(userId, pending.make, pending.model, pending.year);
            }
            return this.addVehicleCommand.startAddVehicle(userId);
        }
        // Fallback to simple parsing for basic cases
        console.log(`📝 Trying simple parsing fallback...`);
        const parsed = (0, format_1.parseUserInput)(text);
        console.log(`📋 Simple parsed:`, parsed);
        if (parsed && parsed.type === 'full') {
            const { make, model, year } = parsed;
            console.log(`🔎 Looking for: ${make} ${model} ${year}`);
            const result = await this.lookup.find(make, model, year);
            console.log(`📊 Result:`, result);
            if (result) {
                return (0, format_1.formatVehicleResult)(result);
            }
            else {
                // Vehicle not found - offer to add it
                if (userId) {
                    console.log(`❌ Vehicle not found, offering to add: ${make} ${model} ${year}`);
                    // Store the vehicle info for potential addition
                    this.pendingAddVehicle = { userId, make, model, year };
                    return `No matching record found for ${make} ${model} ${year}.\n\n` +
                        `💡 **Want to add this vehicle?**\n` +
                        `Reply "add" to add ${make} ${model} ${year} to the database.\n\n` +
                        `Or try sending just the make (e.g., "${make}") to see available models.`;
                }
            }
        }
        console.log(`❌ No match found for: "${text}"`);
        return 'No matching record found.\n\n💡 **TIP:** Try sending just the make (e.g., "Toyota") to see available models!\n\nOr reply "add" to add a new vehicle.';
    }
}
exports.WhatsAppBot = WhatsAppBot;
