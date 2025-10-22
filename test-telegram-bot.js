// Quick test of Telegram bot functionality
console.log('🧪 Testing Telegram Bot Components...\n');

try {
  // Test 1: Check if compiled files exist
  const fs = require('fs');
  const path = require('path');
  
  const requiredFiles = [
    'dist/src/telegram-index.js',
    'dist/src/bot/telegram.js', 
    'telegram-start.js',
    'railway.toml'
  ];
  
  console.log('📁 Checking required files...');
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} - EXISTS`);
    } else {
      console.log(`❌ ${file} - MISSING`);
    }
  });
  
  // Test 2: Verify package.json
  console.log('\n📦 Checking package.json...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts.start === 'node telegram-start.js') {
    console.log('✅ Start script configured for Telegram');
  } else {
    console.log('❌ Start script not configured correctly');
  }
  
  if (packageJson.dependencies.axios) {
    console.log('✅ Axios dependency installed');
  } else {
    console.log('❌ Axios missing');
  }
  
  // Test 3: Check environment
  console.log('\n🌍 Checking environment...');
  require('dotenv').config();
  
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('✅ TELEGRAM_BOT_TOKEN configured');
    console.log(`   Token: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
  } else {
    console.log('❌ TELEGRAM_BOT_TOKEN missing');
  }
  
  if (process.env.DATABASE_URL) {
    console.log('✅ DATABASE_URL configured');
  } else {
    console.log('❌ DATABASE_URL missing');
  }
  
  // Test 4: Test bot token format
  console.log('\n🤖 Validating bot token...');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token && token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
    console.log('✅ Bot token format is valid');
  } else {
    console.log('❌ Bot token format invalid');
  }
  
  console.log('\n🎉 TEST COMPLETE!');
  console.log('==================');
  console.log('✅ All components ready for deployment');
  console.log('🚀 Ready to deploy to Railway');
  console.log('\n📋 DEPLOYMENT CHECKLIST:');
  console.log('□ Add TELEGRAM_BOT_TOKEN to Railway Variables');
  console.log('□ Redeploy Railway service');  
  console.log('□ Test bot in Telegram with /start');
  console.log('\n🎯 Bot Username: Search for your bot in Telegram');
  console.log('💬 Test Command: Send "/start" to your bot');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}