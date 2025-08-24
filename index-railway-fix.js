// Railway-specific connection fix
require('dotenv/config');

console.log('🚀 Starting Railway-optimized bot...');
console.log('📊 Environment check:');

// Log all environment variables that start with PG or DATABASE
Object.keys(process.env).forEach(key => {
  if (key.startsWith('PG') || key.startsWith('DATABASE')) {
    console.log(`- ${key}: ${key.includes('PASSWORD') ? '[hidden]' : process.env[key]}`);
  }
});

// Try multiple connection approaches
const { Client } = require('pg');

async function testConnections() {
  console.log('🔗 Testing multiple connection methods...');
  
  // Method 1: DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    console.log('1️⃣ Trying DATABASE_URL connection...');
    try {
      const client1 = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client1.connect();
      console.log('✅ DATABASE_URL connection works!');
      await client1.end();
      return 'DATABASE_URL';
    } catch (error) {
      console.log('❌ DATABASE_URL failed:', error.message);
    }
  }
  
  // Method 2: Individual variables
  if (process.env.PGHOST) {
    console.log('2️⃣ Trying individual PG variables...');
    try {
      const client2 = new Client({
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false }
      });
      await client2.connect();
      console.log('✅ Individual variables connection works!');
      await client2.end();
      return 'individual';
    } catch (error) {
      console.log('❌ Individual variables failed:', error.message);
    }
  }
  
  // Method 3: Hardcoded (for testing)
  console.log('3️⃣ Trying hardcoded connection...');
  try {
    const client3 = new Client({
      connectionString: 'postgresql://postgres:EKyqYxvYvjhubiHaUUcLRIMkmfBjJBkp@yamabiko.proxy.rlwy.net:46905/railway',
      ssl: { rejectUnauthorized: false }
    });
    await client3.connect();
    console.log('✅ Hardcoded connection works!');
    await client3.end();
    return 'hardcoded';
  } catch (error) {
    console.log('❌ Hardcoded failed:', error.message);
  }
  
  return null;
}

testConnections().then(method => {
  if (method) {
    console.log(`🎉 Success with method: ${method}`);
    console.log('🚀 Now starting WhatsApp bot...');
    
    // Import and start bot with working connection
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    const { PostgresLookup } = require('./dist/src/data/postgresLookup');
    
    const lookup = new PostgresLookup();
    const bot = new WhatsAppBot(lookup);
    bot.start();
    
  } else {
    console.log('💥 All connection methods failed!');
  }
}).catch(error => {
  console.error('💥 Connection test crashed:', error);
});