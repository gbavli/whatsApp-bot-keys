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
import { PostgresUpdateCommand } from '../commands/postgresUpdateCommand';
import { PostgresLookup } from '../data/postgresLookup';
import { EnhancedVehicleCommand } from '../commands/enhancedVehicleCommand';
import { InteractiveVehicleCommand } from '../commands/interactiveVehicleCommand';
import { AddVehicleCommand } from '../commands/addVehicleCommand';

export class WhatsAppBot {
  private lookup: VehicleLookup;
  private vehicleData: VehicleData[] = [];
  private priceUpdateCommand?: PriceUpdateCommand | PostgresUpdateCommand;
  private enhancedVehicleCommand: EnhancedVehicleCommand;
  private interactiveCommand: InteractiveVehicleCommand;
  private addVehicleCommand: AddVehicleCommand;

  constructor(lookup: VehicleLookup, excelFilePath?: string) {
    this.lookup = lookup;
    
    try {
      this.enhancedVehicleCommand = new EnhancedVehicleCommand(lookup);
      console.log('✅ Enhanced vehicle command initialized');
    } catch (error) {
      console.error('❌ Failed to initialize enhanced vehicle command:', error);
      // Create a minimal fallback
      this.enhancedVehicleCommand = {
        processMessage: async () => null,
        cleanupOldSessions: () => {}
      } as any;
    }

    // Initialize interactive command system
    try {
      this.interactiveCommand = new InteractiveVehicleCommand(lookup);
      console.log('✅ Interactive vehicle command initialized');
    } catch (error) {
      console.error('❌ Failed to initialize interactive vehicle command:', error);
      // Create a minimal fallback
      this.interactiveCommand = {
        processMessage: async () => null
      } as any;
    }

    // Initialize add vehicle command system
    try {
      this.addVehicleCommand = new AddVehicleCommand(lookup);
      console.log('✅ Add vehicle command initialized');
    } catch (error) {
      console.error('❌ Failed to initialize add vehicle command:', error);
      // Create a minimal fallback
      this.addVehicleCommand = {
        processMessage: async () => null,
        canStartAddVehicle: () => false,
        isInAddVehicleFlow: () => false,
        startAddVehicle: () => 'Add vehicle not available'
      } as any;
    }
    
    this.loadVehicleData();
    
    // Initialize appropriate price update command based on lookup type
    try {
      if (lookup instanceof PostgresLookup) {
        this.priceUpdateCommand = new PostgresUpdateCommand(lookup);
        console.log('✅ PostgreSQL price update command initialized');
      } else if (excelFilePath) {
        this.priceUpdateCommand = new PriceUpdateCommand(lookup, excelFilePath);
        console.log('✅ Excel price update command initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize price update command:', error);
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
      const pending = (this as any).pendingAddVehicle;
      if (pending && pending.userId === userId) {
        console.log(`📋 Using pending vehicle info: ${pending.make} ${pending.model} ${pending.year}`);
        (this as any).pendingAddVehicle = null; // Clear pending
        return this.addVehicleCommand.startAddVehicle(userId, pending.make, pending.model, pending.year);
      }
      return this.addVehicleCommand.startAddVehicle(userId);
    }

    // Fallback to simple parsing for basic cases
    console.log(`📝 Trying simple parsing fallback...`);
    const parsed = parseUserInput(text);
    console.log(`📋 Simple parsed:`, parsed);
    
    if (parsed && parsed.type === 'full') {
      const { make, model, year } = parsed;
      console.log(`🔎 Looking for: ${make} ${model} ${year}`);
      const result = await this.lookup.find(make!, model!, year!);
      console.log(`📊 Result:`, result);
      
      if (result) {
        // Store vehicle data in interactive session for potential price updates
        if (userId) {
          const vehicleData = {
            id: result.id,
            yearRange: result.yearRange || year!.toString(),
            make: result.make,
            model: result.model,
            key: result.key,
            keyMinPrice: result.keyMinPrice,
            remoteMinPrice: result.remoteMinPrice,
            p2sMinPrice: result.p2sMinPrice,
            ignitionMinPrice: result.ignitionMinPrice
          };
          // Store vehicle data for potential price updates
          this.interactiveCommand.storeVehicleForPricing(userId, vehicleData);
        }
        return formatVehicleResult(result);
      } else {
        // Vehicle not found - offer to add it
        if (userId) {
          console.log(`❌ Vehicle not found, offering to add: ${make} ${model} ${year}`);
          // Store the vehicle info for potential addition
          (this as any).pendingAddVehicle = { userId, make, model, year };
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