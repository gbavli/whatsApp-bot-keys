import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
} from '@whiskeysockets/baileys';
import P from 'pino';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode-terminal';
import { VehicleLookup, VehicleData } from '../data/vehicleLookup';
import {
  parseUserInput,
  formatVehicleResult,
  formatNotFoundMessage,
  formatInvalidInputMessage,
} from '../logic/format';
import { smartParseVehicle, SmartParseResult } from '../logic/intelligentParser';

export class WhatsAppBot {
  private lookup: VehicleLookup;
  private vehicleData: VehicleData[] = [];

  constructor(lookup: VehicleLookup) {
    this.lookup = lookup;
    this.loadVehicleData();
  }

  private async loadVehicleData(): Promise<void> {
    try {
      // Load all vehicle data for intelligent parsing
      if ('getAllVehicles' in this.lookup) {
        this.vehicleData = await (this.lookup as any).getAllVehicles();
      }
    } catch (error) {
      console.error('Failed to load vehicle data for intelligent parsing:', error);
    }
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
      auth: state,
      logger: P({ level: 'silent' }), // Silent logger using Pino
      printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update, sock));
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', ({ messages }) => this.handleMessages(messages, sock));
  }


  private async handleConnectionUpdate(
    update: Partial<ConnectionState>,
    sock: ReturnType<typeof makeWASocket>
  ): Promise<void> {
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
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      console.log('Connection closed due to:', lastDisconnect?.error);
      
      if (shouldReconnect) {
        console.log('Reconnecting...');
        this.start();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp bot connected successfully');
    }
  }

  private async handleMessages(
    messages: WAMessage[],
    sock: ReturnType<typeof makeWASocket>
  ): Promise<void> {
    for (const message of messages) {
      if (!message.message || message.key.fromMe || !message.key.remoteJid) {
        continue;
      }

      const messageText =
        message.message.conversation ||
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
      } catch (error) {
        console.error('Error processing message:', error);
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Sorry, there was an error processing your request. Please try again.',
        });
      }
    }
  }

  private async processMessage(text: string): Promise<string> {
    console.log(`🔍 Processing: "${text}"`);
    
    // Skip greetings
    if (text.toLowerCase().match(/^(hi|hello|hey|test)$/i)) {
      return 'Hello! Send me vehicle info like "Toyota Corolla 2015" to get pricing.';
    }
    
    // Fallback to simple parsing
    const parsed = parseUserInput(text);
    console.log(`📋 Parsed:`, parsed);
    
    if (!parsed) {
      return formatInvalidInputMessage();
    }
    
    const { make, model, year } = parsed;
    console.log(`🔎 Looking for: ${make} ${model} ${year}`);
    const result = await this.lookup.find(make, model, year);
    console.log(`📊 Result:`, result);
    
    if (result) {
      return formatVehicleResult(result);
    }

    console.log(`❌ No match found for: "${text}"`);
    return formatNotFoundMessage();
  }
}