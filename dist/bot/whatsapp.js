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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppBot = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const format_1 = require("../logic/format");
class WhatsAppBot {
    constructor(lookup) {
        this.lookup = lookup;
    }
    async start() {
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)('./auth');
        const sock = (0, baileys_1.default)({
            auth: state,
            printQRInTerminal: true,
            logger: {
                level: 'silent',
                child: () => this.createSilentLogger(),
            },
        });
        sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', ({ messages }) => this.handleMessages(messages, sock));
    }
    createSilentLogger() {
        return {
            fatal: () => { },
            error: () => { },
            warn: () => { },
            info: () => { },
            debug: () => { },
            trace: () => { },
            child: () => this.createSilentLogger(),
        };
    }
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;
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
        const parsed = (0, format_1.parseUserInput)(text);
        if (!parsed) {
            return (0, format_1.formatInvalidInputMessage)();
        }
        const { make, model, year } = parsed;
        const result = await this.lookup.find(make, model, year);
        if (!result) {
            return (0, format_1.formatNotFoundMessage)();
        }
        return (0, format_1.formatVehicleResult)(result);
    }
}
exports.WhatsAppBot = WhatsAppBot;
//# sourceMappingURL=whatsapp.js.map