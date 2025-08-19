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
      QRCode.generate(qr, { small: true });
      console.log('📱 Scan the QR code above to connect');
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
    // Try intelligent parsing first
    if (this.vehicleData.length > 0) {
      const smartResults = smartParseVehicle(text, this.vehicleData);
      
      if (smartResults.length > 0) {
        // Try the best match first
        const bestMatch = smartResults[0];
        if (bestMatch) {
          const result = await this.lookup.find(bestMatch.make, bestMatch.model, bestMatch.year);
          
          if (result) {
            return formatVehicleResult(result);
          }
        }
        
        // If best match didn't work, try other matches
        for (let i = 1; i < smartResults.length; i++) {
          const match = smartResults[i];
          if (match) {
            const result = await this.lookup.find(match.make, match.model, match.year);
            if (result) {
              return formatVehicleResult(result);
            }
          }
        }
      }
    }
    
    // Fallback to simple parsing
    const parsed = parseUserInput(text);
    if (parsed) {
      const { make, model, year } = parsed;
      const result = await this.lookup.find(make, model, year);
      
      if (result) {
        return formatVehicleResult(result);
      }
    }

    return formatNotFoundMessage();
  }
}