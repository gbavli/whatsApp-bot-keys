// Test direct database connection
const { Client } = require('pg');

async function testDirectConnection() {
  console.log('🔗 Testing DIRECT database connection...');
  
  const client = new Client({
    connectionString: 'postgresql://postgres:EKyqYxvYvjhubiHaUUcLRIMkmfBjJBkp@yamabiko.proxy.rlwy.net:46905/railway',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Direct connection successful!');
    
    const result = await client.query('SELECT COUNT(*) FROM vehicles');
    console.log('📊 Vehicle count:', result.rows[0].count);
    
    await client.end();
    console.log('👋 Connection closed');
    
  } catch (error) {
    console.error('❌ Direct connection failed:', error.message);
  }
}

testDirectConnection();