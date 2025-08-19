const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const getVehicleInfo = require('./getVehicleInfo');
const { Boom } = require('@hapi/boom');

const { state, saveState } = useSingleFileAuthState('./creds.json');

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    const from = msg.key.remoteJid;
    const text = msg.message?.conversation || '';

    if (!text) return;

    const parts = text.trim().split(' ');
    if (parts.length < 3) {
      await sock.sendMessage(from, {
        text: 'Please send in format: Make Model Year\nExample: Toyota Camry 2015',
      });
      return;
    }

    const year = parseInt(parts.pop(), 10);
    const make = parts.shift();
    const model = parts.join(' ');

    const response = getVehicleInfo(make, model, year);
    await sock.sendMessage(from, { text: response });
  });
}

startBot();