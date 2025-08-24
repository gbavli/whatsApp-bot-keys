// Migration script to transfer Excel data to PostgreSQL
const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');

// Database connection - use Railway's DATABASE_URL or individual env vars
const client = new Client(
  process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  } : {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
);

async function createTables() {
  console.log('🔧 Creating database tables...');
  
  const schema = fs.readFileSync('./database/schema.sql', 'utf8');
  await client.query(schema);
  
  console.log('✅ Database tables created successfully');
}

async function importExcelData() {
  console.log('📁 Reading Excel file...');
  
  // Read Excel file
  const workbook = XLSX.readFile('./keys.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📋 Found ${rawData.length} rows in Excel`);
  
  // Skip header row and process data
  const vehicles = rawData.slice(1).map((row, index) => {
    return {
      year_range: String(row[0] || '').trim(),
      make: String(row[1] || '').trim(), 
      model: String(row[2] || '').trim(),
      key_type: String(row[5] || '').trim(),
      key_min_price: String(row[7] || '').trim(),
      remote_min_price: String(row[9] || '').trim(),
      p2s_min_price: String(row[11] || '').trim(),
      ignition_min_price: String(row[13] || '').trim()
    };
  }).filter(vehicle => 
    // Only include rows with make and model
    vehicle.make && vehicle.model && vehicle.year_range
  );
  
  console.log(`📊 Processing ${vehicles.length} valid vehicle records...`);
  
  // Clear existing data
  await client.query('DELETE FROM vehicles');
  console.log('🗑️  Cleared existing vehicle data');
  
  // Insert data in batches for better performance
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < vehicles.length; i += batchSize) {
    const batch = vehicles.slice(i, i + batchSize);
    
    // Build multi-row insert query
    const values = [];
    const placeholders = [];
    
    batch.forEach((vehicle, batchIndex) => {
      const baseIndex = batchIndex * 8;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`);
      
      values.push(
        vehicle.year_range,
        vehicle.make,
        vehicle.model, 
        vehicle.key_type,
        vehicle.key_min_price,
        vehicle.remote_min_price,
        vehicle.p2s_min_price,
        vehicle.ignition_min_price
      );
    });
    
    const query = `
      INSERT INTO vehicles (year_range, make, model, key_type, key_min_price, remote_min_price, p2s_min_price, ignition_min_price)
      VALUES ${placeholders.join(', ')}
    `;
    
    await client.query(query, values);
    inserted += batch.length;
    
    console.log(`📦 Imported batch ${Math.ceil((i + batchSize) / batchSize)} - ${inserted}/${vehicles.length} records`);
  }
  
  console.log(`✅ Successfully imported ${inserted} vehicle records to PostgreSQL`);
}

async function verifyImport() {
  console.log('🔍 Verifying import...');
  
  // Count total records
  const countResult = await client.query('SELECT COUNT(*) as count FROM vehicles');
  const totalCount = countResult.rows[0].count;
  
  console.log(`📊 Total records in database: ${totalCount}`);
  
  // Show sample of imported data
  const sampleResult = await client.query(`
    SELECT year_range, make, model, key_min_price 
    FROM vehicles 
    ORDER BY id 
    LIMIT 5
  `);
  
  console.log('📋 Sample records:');
  sampleResult.rows.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.year_range} ${row.make} ${row.model} - $${row.key_min_price}`);
  });
  
  // Test a specific query (Toyota Corolla)
  const testResult = await client.query(`
    SELECT year_range, make, model, key_min_price
    FROM vehicles 
    WHERE LOWER(make) = 'toyota' AND LOWER(model) = 'corolla'
    ORDER BY year_range
  `);
  
  console.log(`🧪 Test query - Toyota Corolla records: ${testResult.rows.length}`);
  testResult.rows.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.year_range} ${row.make} ${row.model} - $${row.key_min_price}`);
  });
}

async function migrate() {
  try {
    console.log('🚀 Starting Excel to PostgreSQL migration...');
    
    // Connect to database
    await client.connect();
    console.log('🔌 Connected to PostgreSQL');
    
    // Run migration steps
    await createTables();
    await importExcelData();
    await verifyImport();
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };