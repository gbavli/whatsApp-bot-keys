#!/usr/bin/env node
// Standalone script to clear session and start bot
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 WhatsApp Bot - Session Clearing and Start');

// Clear session function
function clearSession() {
  console.log('🔄 Clearing WhatsApp session...');
  
  const authPath = './auth';
  
  try {
    if (fs.existsSync(authPath)) {
      const files = fs.readdirSync(authPath);
      console.log(`📁 Found ${files.length} session files to delete`);
      
      files.forEach(file => {
        const filePath = path.join(authPath, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted: ${file}`);
      });
      
      console.log('✅ Session cleared successfully!');
    } else {
      console.log('📁 No auth directory found - session already clear');
    }
  } catch (error) {
    console.error('❌ Error clearing session:', error.message);
  }
}

// Clear session first
clearSession();

console.log('🚀 Starting bot...');
console.log('');

// Start the main bot
const botProcess = spawn('node', ['dist/src/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, CLEAR_SESSION: 'false' } // Prevent double clearing
});

botProcess.on('error', (error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});

botProcess.on('close', (code) => {
  console.log(`Bot process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down...');
  botProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down...');
  botProcess.kill('SIGTERM');
});