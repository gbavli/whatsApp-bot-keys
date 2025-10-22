import axios from 'axios';
import { VehicleLookup, VehicleData } from '../data/vehicleLookup';
import {
  parseUserInput,
  formatVehicleResult,
  formatNotFoundMessage,
  formatInvalidInputMessage,
} from '../logic/format';
import { smartParseVehicle } from '../logic/intelligentParser';
import { PostgresLookup } from '../data/postgresLookup';
import { InteractiveVehicleCommand } from '../commands/interactiveVehicleCommand';
import { AddVehicleCommand } from '../commands/addVehicleCommand';

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export class TelegramBot {
  private lookup: VehicleLookup;
  private vehicleData: VehicleData[] = [];
  private interactiveCommand: InteractiveVehicleCommand;
  private addVehicleCommand: AddVehicleCommand;
  private botToken: string;
  private apiUrl: string;

  constructor(lookup: VehicleLookup, botToken: string) {
    this.lookup = lookup;
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    
    // Initialize interactive commands (same as WhatsApp)
    this.interactiveCommand = new InteractiveVehicleCommand(lookup);
    this.addVehicleCommand = new AddVehicleCommand(lookup);
    
    this.loadVehicleData();
  }

  private async loadVehicleData(): Promise<void> {
    try {
      console.log('🔄 Loading vehicle data for Telegram bot...');
      if ('getAllVehicles' in this.lookup) {
        this.vehicleData = await (this.lookup as any).getAllVehicles();
        console.log(`✅ Loaded ${this.vehicleData.length} vehicles for Telegram bot`);
      }
    } catch (error) {
      console.error('❌ Failed to load vehicle data for Telegram bot:', error);
    }
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Telegram Vehicle Pricing Bot...');
    console.log('🤖 Bot is ready and waiting for messages!');
    
    // Set up bot commands
    await this.setCommands();
    
    // Start polling for messages
    await this.startPolling();
  }

  private async setCommands(): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/setMyCommands`, {
        commands: [
          {
            command: 'start',
            description: 'Start the bot and get help'
          },
          {
            command: 'help',
            description: 'Show usage instructions'
          },
          {
            command: 'cancel',
            description: 'Cancel current operation'
          }
        ]
      });
      console.log('✅ Bot commands set successfully');
    } catch (error) {
      console.error('❌ Failed to set bot commands:', error);
    }
  }

  private async startPolling(): Promise<void> {
    let lastUpdateId = 0;

    while (true) {
      try {
        const response = await axios.get(`${this.apiUrl}/getUpdates`, {
          params: {
            offset: lastUpdateId + 1,
            timeout: 10
          }
        });

        const updates: TelegramUpdate[] = response.data.result;

        for (const update of updates) {
          if (update.message) {
            await this.handleMessage(update.message);
          }
          lastUpdateId = update.update_id;
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
        // Wait 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    const text = message.text?.trim() || '';

    console.log(`📩 Received from @${message.from.username || message.from.first_name}: "${text}"`);

    try {
      const response = await this.processMessage(text, userId);
      await this.sendMessage(chatId, response);
      console.log(`📤 Sent: "${response.substring(0, 100)}..."`);
    } catch (error) {
      console.error('❌ Error processing message:', error);
      await this.sendMessage(chatId, 'Sorry, there was an error processing your request. Please try again.');
    }
  }

  private async processMessage(text: string, userId: string): Promise<string> {
    console.log(`🔍 Processing: "${text}"`);

    // Handle bot commands
    if (text.startsWith('/')) {
      return this.handleCommand(text);
    }

    // Handle add vehicle flow (same as WhatsApp)
    if (this.addVehicleCommand.isInAddVehicleFlow(userId)) {
      console.log(`🆕 Processing add vehicle flow`);
      const addResult = await this.addVehicleCommand.processMessage(userId, text);
      if (addResult !== null) {
        return addResult;
      }
    }

    // Try interactive vehicle command system (same as WhatsApp)
    if (userId) {
      console.log(`🎯 Trying interactive vehicle command`);
      const interactiveResult = await this.interactiveCommand.processMessage(userId, text);
      if (interactiveResult !== null) {
        console.log(`✅ Interactive vehicle command handled the message`);
        return interactiveResult;
      }
    }

    // Check if user wants to add a new vehicle
    if (this.addVehicleCommand.canStartAddVehicle(text)) {
      console.log(`🆕 User wants to add a vehicle`);
      return this.addVehicleCommand.startAddVehicle(userId);
    }

    // Fallback to simple parsing for basic cases (same as WhatsApp)
    console.log(`📝 Trying simple parsing fallback...`);
    const parsed = parseUserInput(text);
    
    if (parsed && parsed.type === 'full') {
      const { make, model, year } = parsed;
      console.log(`🔎 Looking for: ${make} ${model} ${year}`);
      const result = await this.lookup.find(make!, model!, year!);
      
      if (result) {
        // Store vehicle data for potential price updates
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
        this.interactiveCommand.storeVehicleForPricing(userId, vehicleData);
        return formatVehicleResult(result);
      } else {
        return `No matching record found for ${make} ${model} ${year}.\n\n` +
               `💡 **Want to add this vehicle?**\n` +
               `Send "add" to add ${make} ${model} ${year} to the database.\n\n` +
               `Or try sending just the make (e.g., "${make}") to see available models.`;
      }
    }

    console.log(`❌ No match found for: "${text}"`);
    return 'No matching record found.\n\n💡 **TIP:** Try sending just the make (e.g., "Toyota") to see available models!\n\nOr send "add" to add a new vehicle.';
  }

  private handleCommand(command: string): string {
    switch (command.toLowerCase()) {
      case '/start':
        return `🚗 **Welcome to Vehicle Key Pricing Bot!**\n\n` +
               `Send me vehicle info to get pricing:\n\n` +
               `📝 **Examples:**\n` +
               `• "Toyota" - see all Toyota models\n` +
               `• "Toyota Corolla" - see available years\n` +
               `• "Toyota Corolla 2015" - get pricing\n` +
               `• "2015 Toyota Corolla" - also works!\n\n` +
               `🔧 **Features:**\n` +
               `• Press **9** after any result to update prices\n` +
               `• Send "add" to add new vehicles\n` +
               `• Use /cancel to exit any operation\n\n` +
               `Need help? Use /help`;

      case '/help':
        return `🆘 **Help - How to Use This Bot**\n\n` +
               `**Search for Vehicle Pricing:**\n` +
               `• Send make only: "BMW"\n` +
               `• Send make + model: "BMW X5"\n` +
               `• Send full info: "BMW X5 2020"\n` +
               `• Works with year first: "2020 BMW X5"\n\n` +
               `**Update Pricing:**\n` +
               `• After getting results, press "9"\n` +
               `• Follow prompts to update prices\n` +
               `• Type "cancel" to exit pricing mode\n\n` +
               `**Add New Vehicle:**\n` +
               `• Send "add" to start adding process\n` +
               `• Follow step-by-step prompts\n\n` +
               `**Commands:**\n` +
               `• /start - Start the bot\n` +
               `• /help - Show this help\n` +
               `• /cancel - Cancel current operation`;

      case '/cancel':
        return 'Operation cancelled. You can now send any vehicle request.';

      default:
        return `Unknown command. Use /help for instructions.`;
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Try without markdown if it fails
      try {
        await axios.post(`${this.apiUrl}/sendMessage`, {
          chat_id: chatId,
          text: text
        });
      } catch (retryError) {
        console.error('❌ Failed to send message even without markdown:', retryError);
      }
    }
  }
}