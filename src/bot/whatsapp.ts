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
import { PriceUpdateCommand } from '../commands/priceUpdateCommand';

export class WhatsAppBot {
  private lookup: VehicleLookup;
  private vehicleData: VehicleData[] = [];
  private priceUpdateCommand?: PriceUpdateCommand;

  constructor(lookup: VehicleLookup, excelFilePath?: string) {
    this.lookup = lookup;
    this.loadVehicleData();
    
    // Initialize price update command if Excel file path is provided
    if (excelFilePath) {
      this.priceUpdateCommand = new PriceUpdateCommand(lookup, excelFilePath);
    }
  }

  private async loadVehicleData(): Promise<void> {
    try {
      console.log('🔄 Loading vehicle data for intelligent parsing...');
      // Load all vehicle data for intelligent parsing
      if ('getAllVehicles' in this.lookup) {
        this.vehicleData = await (this.lookup as any).getAllVehicles();
        console.log(`✅ Loaded ${this.vehicleData.length} vehicles for intelligent parsing`);
      } else {
        console.log('⚠️ Lookup provider does not support getAllVehicles');
      }
    } catch (error) {
      console.error('❌ Failed to load vehicle data for intelligent parsing:', error);
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
        const response = await this.processMessage(messageText, message.key.remoteJid);
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

  private async processMessage(text: string, userId?: string): Promise<string> {
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
      const smartResults = smartParseVehicle(text, this.vehicleData);
      
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
            return formatVehicleResult(result);
          }
        }
        console.log(`❌ Smart parser matches found but no data results`);
      } else {
        console.log(`❌ Smart parser found no matches`);
      }
    }
    
    // Fallback to simple parsing (Make Model Year only)
    console.log(`📝 Trying simple parsing...`);
    const parsed = parseUserInput(text);
    console.log(`📋 Simple parsed:`, parsed);
    
    if (parsed) {
      const { make, model, year } = parsed;
      console.log(`🔎 Looking for: ${make} ${model} ${year}`);
      const result = await this.lookup.find(make, model, year);
      console.log(`📊 Result:`, result);
      
      if (result) {
        return formatVehicleResult(result);
      }
    } else {
      return formatInvalidInputMessage();
    }

    console.log(`❌ No match found for: "${text}"`);
    return formatNotFoundMessage();
  }
}