// Quick test for exit command functionality
const { ExcelLookup } = require('./dist/src/data/excelLookup');
const { InteractiveVehicleCommand } = require('./dist/src/commands/interactiveVehicleCommand');

async function testExitCommands() {
  console.log('🧪 Testing exit command functionality...\n');
  
  try {
    const lookup = new ExcelLookup('./keys.xlsx');
    const interactiveCmd = new InteractiveVehicleCommand(lookup);
    
    const testUserId = 'test-user';
    
    // Step 1: Get a vehicle result first
    console.log('1️⃣ Getting vehicle result...');
    let result = await interactiveCmd.processMessage(testUserId, 'toyota corolla 2015');
    console.log('Result:', result ? 'SUCCESS' : 'FAILED');
    
    // Step 2: Trigger pricing mode with "9"
    console.log('\n2️⃣ Triggering pricing mode with "9"...');
    result = await interactiveCmd.processMessage(testUserId, '9');
    console.log('Result contains "UPDATE PRICING":', result && result.includes('UPDATE PRICING'));
    console.log('Result contains exit info:', result && result.includes('cancel'));
    
    // Step 3: Try to exit with "cancel"
    console.log('\n3️⃣ Trying to exit with "cancel"...');
    result = await interactiveCmd.processMessage(testUserId, 'cancel');
    console.log('Exit result:', result);
    console.log('Contains "Cancelled":', result && result.includes('Cancelled'));
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testExitCommands().catch(console.error);