// Test script to check what happens when looking up a vehicle that doesn't exist
require('dotenv/config');
const { PostgresLookup } = require('./dist/src/data/postgresLookup');

async function testMissingVehicle() {
  console.log('🧪 Testing missing vehicle lookup...\n');
  
  const lookup = new PostgresLookup();
  
  // Test vehicles that likely don't exist in the database
  const testCases = [
    { make: 'BMW', model: 'i8', year: 2023 },
    { make: 'BMW', model: 'M8', year: 2022 },
    { make: 'BMW', model: 'X7', year: 2024 },
    { make: 'BMW', model: 'Z4', year: 2021 },
    { make: 'BMW', model: '850i', year: 2020 }
  ];
  
  console.log('Testing these BMW models that might not exist:');
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
        console.log(`   Prices: $${result.keyMinPrice} | $${result.remoteMinPrice} | $${result.p2sMinPrice} | $${result.ignitionMinPrice}`);
      } else {
        console.log(`❌ Not found: ${testCase.make} ${testCase.model} ${testCase.year}`);
        console.log('   This would be good for testing the "add new vehicle" flow');
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
    console.log();
  }
  
  // Check what BMW models actually exist
  console.log('📋 Let\'s see what BMW models DO exist in the database:');
  try {
    const allVehicles = await lookup.getAllVehicles();
    const bmwModels = allVehicles
      .filter(v => v.make.toLowerCase() === 'bmw')
      .map(v => `${v.model} (${v.yearRange})`)
      .filter((model, index, self) => self.indexOf(model) === index)
      .sort();
    
    if (bmwModels.length > 0) {
      console.log('Existing BMW models:');
      bmwModels.forEach((model, index) => {
        console.log(`${index + 1}. BMW ${model}`);
      });
    } else {
      console.log('❌ No BMW models found in database');
    }
  } catch (error) {
    console.log(`💥 Error getting BMW models: ${error.message}`);
  }
  
  console.log('\n🎯 For testing the "add new vehicle" flow, try one of the missing vehicles above!');
}

testMissingVehicle().catch(console.error);