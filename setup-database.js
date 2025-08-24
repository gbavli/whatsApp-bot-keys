// Database setup script for new PostgreSQL service - Updated 2025-08-24
require('dotenv/config');
const { Client } = require('pg');
const XLSX = require('xlsx');

console.log('🚀 Setting up PostgreSQL database...');

async function setupDatabase() {
  console.log('🔍 Environment check:');
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found!');
    console.log('💡 Make sure your PostgreSQL service is connected to this bot service in Railway');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create vehicles table
    console.log('📋 Creating vehicles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        year_range VARCHAR(20) NOT NULL,
        make VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        key_type TEXT,
        key_min_price VARCHAR(20),
        remote_min_price VARCHAR(20),
        p2s_min_price VARCHAR(20),
        ignition_min_price VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Vehicles table created');

    // Create price_updates audit table
    console.log('📋 Creating price_updates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_updates (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id),
        user_id VARCHAR(50) NOT NULL,
        field_changed VARCHAR(30) NOT NULL,
        old_value VARCHAR(20),
        new_value VARCHAR(20),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Price updates table created');

    // Check if we have existing data
    const countResult = await client.query('SELECT COUNT(*) as count FROM vehicles');
    const existingCount = parseInt(countResult.rows[0].count);
    
    if (existingCount > 0) {
      console.log(`ℹ️  Database already has ${existingCount} vehicles. Skipping import.`);
    } else {
      console.log('📊 Importing data from Excel file...');
      await importFromExcel(client);
    }

    console.log('🎉 Database setup complete!');
    
    // Keep running so we can see the results in Railway logs
    console.log('✅ Keeping process alive to view results...');
    setInterval(() => {
      console.log(`💓 Database setup completed at ${new Date().toLocaleTimeString()}`);
    }, 30000); // Every 30 seconds

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.error('Full error details:', error);
    
    // Keep running to see error logs
    setInterval(() => {
      console.log(`❌ Setup failed - check logs above`);
    }, 30000);
  } finally {
    // Don't close the connection immediately so Railway keeps the container running
    // await client.end();
  }
}

async function importFromExcel(client) {
  try {
    // Try to load the Excel file
    let excelPath = './keys.xlsx';
    if (!require('fs').existsSync(excelPath)) {
      excelPath = './data/pricebook.xlsx';
    }
    
    if (!require('fs').existsSync(excelPath)) {
      console.log('⚠️  No Excel file found. You can manually add data later.');
      return;
    }

    console.log(`📁 Reading Excel file: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`📊 Found ${data.length} rows in Excel file`);

    let imported = 0;
    for (let i = 1; i < data.length; i++) { // Skip header row
      const row = data[i];
      if (!row || row.length < 6) continue; // Skip empty/incomplete rows

      const [yearRange, make, model, , , key, , keyMinPrice, , remoteMinPrice, , p2sMinPrice, , ignitionMinPrice] = row;
      
      if (!yearRange || !make || !model) continue;

      try {
        await client.query(`
          INSERT INTO vehicles (year_range, make, model, key_type, key_min_price, remote_min_price, p2s_min_price, ignition_min_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          yearRange?.toString() || '',
          make?.toString() || '',
          model?.toString() || '',
          key?.toString() || '',
          keyMinPrice?.toString() || '',
          remoteMinPrice?.toString() || '',
          p2sMinPrice?.toString() || '',
          ignitionMinPrice?.toString() || ''
        ]);
        imported++;
      } catch (error) {
        console.error(`Error importing row ${i}:`, error.message);
      }
    }

    console.log(`✅ Imported ${imported} vehicles from Excel`);
  } catch (error) {
    console.error('❌ Excel import failed:', error);
    console.log('💡 You can add data manually or upload an Excel file later.');
  }
}

setupDatabase();