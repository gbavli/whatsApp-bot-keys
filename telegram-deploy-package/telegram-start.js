#!/usr/bin/env node
// Simple Telegram bot starter script for Railway
console.log('🤖 Starting Telegram Vehicle Pricing Bot...');
console.log('🚀 No session clearing needed - Telegram uses HTTP API!');

const { spawn } = require('child_process');

// Start the Telegram bot
const botProcess = spawn('node', ['dist/src/telegram-index.js'], {
  stdio: 'inherit'
});

botProcess.on('error', (error) => {
  console.error('❌ Failed to start Telegram bot:', error);
  process.exit(1);
});

botProcess.on('close', (code) => {
  console.log(`Telegram bot process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down Telegram bot...');
  botProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('👋 Shutting down Telegram bot...');
  botProcess.kill('SIGTERM');
});