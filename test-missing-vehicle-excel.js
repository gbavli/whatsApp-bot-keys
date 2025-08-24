// Test script to check what happens when looking up a vehicle that doesn't exist
require('dotenv/config');
const { ExcelLookup } = require('./dist/src/data/excelLookup');

async function testMissingVehicle() {
  console.log('🧪 Testing missing vehicle lookup with Excel data...\n');
  
  const lookup = new ExcelLookup('./keys.xlsx');
  
  // Test vehicles that likely don't exist in the database
  const testCases = [
    { make: 'BMW', model: 'i8', year: 2023 },
    { make: 'BMW', model: 'M8', year: 2022 },
    { make: 'BMW', model: 'X7', year: 2024 },
    { make: 'BMW', model: 'Z4', year: 2021 },
    { make: 'BMW', model: '850i', year: 2020 },
    { make: 'Tesla', model: 'Cybertruck', year: 2024 },
    { make: 'Lamborghini', model: 'Huracan', year: 2023 }
  ];
  
  console.log('Testing these vehicles that might not exist:');
  testCases.forEach((test, index) => {
    console.log(`${index + 1}. ${test.make} ${test.model} ${test.year}`);
  });
  console.log();
  
  for (const testCase of testCases) {
    console.log(`🔍 Looking up: ${testCase.make} ${testCase.model} ${testCase.year}`);
    
    try {
      const result = await lookup.find(testCase.make, testCase.model, testCase.year);
      
      if (result) {
        console.log(`✅ Found: ${result.make} ${result.model} ${result.year}`);
        console.log(`   Key: ${result.key}`);
        console.log(`   Prices: Key=$${result.keyMinPrice} | Remote=$${result.remoteMinPrice} | P2S=$${result.p2sMinPrice} | Ignition=$${result.ignitionMinPrice}`);
      } else {
        console.log(`❌ Not found: ${testCase.make} ${testCase.model} ${testCase.year}`);
        console.log('   🎯 This would be perfect for testing the "add new vehicle" flow!');
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
    console.log();
  }
  
  // Check what BMW models actually exist
  console.log('📋 Let\'s see what BMW models DO exist in the Excel file:');
  try {
    const allVehicles = await lookup.getAllVehicles();
    const bmwModels = allVehicles
      .filter(v => v.make.toLowerCase().includes('bmw'))
      .map(v => `${v.model} (${v.yearRange}) - ${v.key}`)
      .slice(0, 10); // Just show first 10
    
    if (bmwModels.length > 0) {
      console.log('Sample BMW models in database:');
      bmwModels.forEach((model, index) => {
        console.log(`${index + 1}. BMW ${model}`);
      });
      if (allVehicles.filter(v => v.make.toLowerCase().includes('bmw')).length > 10) {
        console.log('... and more');
      }
    } else {
      console.log('❌ No BMW models found in database');
    }
  } catch (error) {
    console.log(`💥 Error getting BMW models: ${error.message}`);
  }
  
  console.log('\n🎯 TESTING RECOMMENDATION:');
  console.log('Try sending this to your WhatsApp bot: "BMW i8 2023"');
  console.log('Expected response: "No matching record found for that vehicle."');
  console.log('Then we can add a feature to handle adding new vehicles!');
}

testMissingVehicle().catch(console.error);