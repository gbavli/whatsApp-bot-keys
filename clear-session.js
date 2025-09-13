// Script to clear WhatsApp session on Railway
const fs = require('fs');
const path = require('path');

console.log('🔄 Clearing WhatsApp session...');

const authPath = './auth';

try {
  // Check if auth directory exists
  if (fs.existsSync(authPath)) {
    // Remove all files in auth directory
    const files = fs.readdirSync(authPath);
    console.log(`📁 Found ${files.length} session files`);
    
    files.forEach(file => {
      const filePath = path.join(authPath, file);
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted: ${file}`);
    });
    
    console.log('✅ Session cleared successfully!');
    console.log('🎯 Restart the bot to generate new QR code');
  } else {
    console.log('📁 No auth directory found - session already clear');
  }
} catch (error) {
  console.error('❌ Error clearing session:', error.message);
}

console.log('');
console.log('📱 Next steps:');
console.log('1. Deploy this change to Railway');
console.log('2. Check Railway logs for new QR code');
console.log('3. Scan QR code with WhatsApp');