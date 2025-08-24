// Diagnostic bot to identify Railway deployment issues
require('dotenv/config');

console.log('🔍 DIAGNOSTIC MODE - Railway Bot Analysis');
console.log('📊 Node.js:', process.version);
console.log('📊 Platform:', process.platform);
console.log('📊 Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');

// Test each component step by step
async function runDiagnostics() {
  try {
    console.log('\n=== STEP 1: Environment Variables ===');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
    console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');
    
    console.log('\n=== STEP 2: Module Loading ===');
    const { Client } = require('pg');
    console.log('✅ pg module loaded');
    
    const { WhatsAppBot } = require('./dist/src/bot/whatsapp');
    console.log('✅ WhatsApp bot module loaded');
    
    const { PostgresLookup } = require('./dist/src/data/postgresLookup');
    console.log('✅ PostgreSQL lookup module loaded');

    console.log('\n=== STEP 3: Database Connection Test ===');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000, // 5 second timeout
    });
    
    console.log('🔌 Testing direct database connection...');
    const connectStart = Date.now();
    await client.connect();
    const connectTime = Date.now() - connectStart;
    console.log(`✅ Connected to database in ${connectTime}ms`);
    
    console.log('🔍 Testing simple query...');
    const queryStart = Date.now();
    const result = await client.query('SELECT COUNT(*) as count FROM vehicles');
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query completed in ${queryTime}ms - Found ${result.rows[0].count} vehicles`);
    
    await client.end();
    console.log('✅ Database connection closed');

    console.log('\n=== STEP 4: PostgresLookup Test ===');
    const lookup = new PostgresLookup();
    console.log('✅ PostgresLookup instance created');
    
    console.log('🔍 Testing single vehicle lookup...');
    const lookupStart = Date.now();
    const vehicleResult = await lookup.find('Toyota', 'Corolla', 2015);
    const lookupTime = Date.now() - lookupStart;
    
    if (vehicleResult) {
      console.log(`✅ Vehicle lookup successful in ${lookupTime}ms`);
      console.log(`📋 Found: ${vehicleResult.make} ${vehicleResult.model} ${vehicleResult.year}`);
    } else {
      console.log(`❌ No vehicle found for Toyota Corolla 2015 (${lookupTime}ms)`);
    }

    console.log('\n=== STEP 5: WhatsApp Bot Creation ===');
    const bot = new WhatsAppBot(lookup);
    console.log('✅ WhatsApp bot instance created');

    console.log('\n=== STEP 6: WhatsApp Connection ===');
    console.log('🚀 Starting WhatsApp connection...');
    await bot.start();
    
    console.log('\n🎉 ALL DIAGNOSTICS PASSED - Bot should be working!');
    
    // Keep alive
    setInterval(() => {
      const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`💓 Bot alive - Memory: ${memory}MB - ${new Date().toLocaleTimeString()}`);
    }, 60000); // Every minute
    
  } catch (error) {
    console.error('\n💥 DIAGNOSTIC FAILED AT:', error.message);
    console.error('📍 Stack trace:', error.stack);
    console.error('📊 Memory at failure:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');
    process.exit(1);
  }
}

runDiagnostics();