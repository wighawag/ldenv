#!/usr/bin/env node
/**
 * Demo server for ldenv watch mode
 * 
 * This simple server demonstrates how ldenv watch mode works:
 * - Logs environment configuration on startup
 * - Prints the current config every 2 seconds
 * - When .env files change, ldenv restarts this server with updated config
 */

const APP_NAME = process.env.APP_NAME || 'UnnamedApp';
const API_URL = process.env.API_URL || 'http://localhost';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const DEBUG = process.env.DEBUG === 'true';
const MODE = process.env.MODE || 'local';

console.log('='.repeat(50));
console.log(`🚀 ${APP_NAME} Server Started!`);
console.log('='.repeat(50));
console.log(`  Mode:      ${MODE}`);
console.log(`  API URL:   ${API_URL}`);
console.log(`  Log Level: ${LOG_LEVEL}`);
console.log(`  Debug:     ${DEBUG}`);
console.log('='.repeat(50));
console.log('');
console.log('💡 Try editing the .env file - the server will automatically restart!');
console.log('   Press Ctrl+C to stop.');
console.log('');

// Simulate a running server
let tick = 0;
const interval = setInterval(() => {
  tick++;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] tick #${tick} | API: ${API_URL} | Level: ${LOG_LEVEL}`);
}, 2000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📴 Server received shutdown signal, cleaning up...');
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📴 Server interrupted, shutting down...');
  clearInterval(interval);
  process.exit(0);
});
