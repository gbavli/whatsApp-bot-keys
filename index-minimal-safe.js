// Minimal safe bot - no enhanced features, basic parsing only
require('dotenv/config');

console.log('🚀 Starting MINIMAL SAFE WhatsApp bot...');

async function createMinimalSafeBot() {
  try {
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    const { PostgresLookup } = require('./dist/src/data/postgresLookup');
    
    const lookup = new PostgresLookup();
    
    // Create a minimal bot wrapper that doesn't use enhanced features
    class SafeWhatsAppBot {
      constructor(lookup) {
        this.lookup = lookup;
      }
      
      async start() {
        const { default: makeWASocket, useMultiFileAuthState } = await import('@whiskeysockets/baileys');
        const P = await import('pino');
        const QRCode = await import('qrcode-terminal');
        
        const { state, saveCreds } = await useMultiFileAuthState('./auth');

        const sock = makeWASocket({
          auth: state,
          logger: P.default({ level: 'silent' }),
          printQRInTerminal: false,
        });

        sock.ev.on('connection.update', (update) => {
          const { connection, qr } = update;
          if (qr) {
            console.log('🔳 QR CODE FOR WHATSAPP:');
            QRCode.default.generate(qr, { small: false });
          }
          if (connection === 'open') {
            console.log('✅ WhatsApp bot connected successfully');
          }
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async ({ messages }) => {
          for (const message of messages) {
            if (!message.message || message.key.fromMe || !message.key.remoteJid) continue;

            const messageText = message.message.conversation || message.message.extendedTextMessage?.text || '';
            if (!messageText.trim()) continue;

            console.log(`📩 Received: "${messageText}"`);

            try {
              // Simple parsing only - no intelligent features
              const response = await this.processSimple(messageText);
              await sock.sendMessage(message.key.remoteJid, { text: response });
              console.log(`📤 Sent response`);
            } catch (error) {
              console.error('Error:', error);
              await sock.sendMessage(message.key.remoteJid, { 
                text: 'Sorry, there was an error. Please try: Make Model Year (e.g., "Toyota Corolla 2015")' 
              });
            }
          }
        });
      }
      
      async processSimple(text) {
        // Skip greetings
        if (text.toLowerCase().match(/^(hi|hello|hey|test)$/i)) {
          return 'Hello! Send me vehicle info like "Toyota Corolla 2015" to get pricing.';
        }
        
        // Simple parsing - extract make model year
        const parts = text.trim().split(/\s+/);
        if (parts.length < 3) {
          return 'Please send: Make Model Year (e.g., "Toyota Corolla 2015")';
        }
        
        const yearStr = parts[parts.length - 1];
        const year = parseInt(yearStr, 10);
        
        if (isNaN(year) || year < 1900 || year > 2050) {
          return 'Please include a valid year (e.g., "Toyota Corolla 2015")';
        }
        
        const make = parts[0];
        const model = parts.slice(1, -1).join(' ');
        
        console.log(`🔎 Looking for: ${make} ${model} ${year}`);
        
        try {
          const result = await this.lookup.find(make, model, year);
          if (result) {
            return `${result.make} ${result.model} ${result.year}

Key: ${result.key}
Turn Key Min: $${result.keyMinPrice}
Remote Min: $${result.remoteMinPrice}
Push-to-Start Min: $${result.p2sMinPrice}
Ignition Change/Fix Min: $${result.ignitionMinPrice}`;
          } else {
            return 'No matching record found for that vehicle.';
          }
        } catch (error) {
          console.error('Lookup error:', error);
          return 'Error looking up vehicle. Please try again.';
        }
      }
    }
    
    const bot = new SafeWhatsAppBot(lookup);
    await bot.start();
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

createMinimalSafeBot();