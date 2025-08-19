const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const { getPrice } = require('./sheet'); // ← add this line

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('📱 Scan the QR code above to connect');
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    } else if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('❌ Disconnected, reconnect?', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const jid = m.key.remoteJid;

    console.log(`📩 Message from ${jid}:`, text);

    const parts = text.trim().split(' ');
    if (parts.length >= 3) {
      const [make, model, year] = parts;
      const price = await getPrice(make, model, year);
      if (price) {
        await sock.sendMessage(jid, { text: `🔑 Minimum key price for ${make} ${model} ${year} is: $${price}` });
      } else {
        await sock.sendMessage(jid, { text: '❌ No match found. Please use format: make model year' });
      }
    } else {
      await sock.sendMessage(jid, { text: '📌 Invalid format. Send: make model year (example: Ford F150 2016)' });
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

startBot();