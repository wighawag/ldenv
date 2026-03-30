#!/usr/bin/env node
/**
 * Demo server for ldenv watch mode with parent folder ENV_ROOT_FOLDER
 * 
 * This server demonstrates watching both local and parent .env files:
 * - Logs environment from both parent and local .env files
 * - When EITHER parent or local .env files change, ldenv restarts the server
 * 
 * Run from the 'sub' directory:
 *   cd examples/watch-parent-demo/sub
 *   npx ldenv -m development -w --verbose node server.js
 */

// Variables from parent .env
const APP_NAME = process.env.APP_NAME || 'UnnamedApp';
const API_URL = process.env.API_URL || 'http://localhost';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const DEBUG = process.env.DEBUG === 'true';
const PARENT_VAR = process.env.PARENT_VAR || 'NOT_SET';

// Variables from local .env
const SUB_VAR = process.env.SUB_VAR || 'NOT_SET';

const MODE = process.env.MODE || 'local';

console.log('='.repeat(60));
console.log(`🚀 ${APP_NAME} Server Started! (from subfolder)`);
console.log('='.repeat(60));
console.log('');
console.log('📁 Configuration Sources:');
console.log('   Parent folder (..) provides: APP_NAME, API_URL, PARENT_VAR');
console.log('   Local folder (.)  provides: SUB_VAR');
console.log('');
console.log('📊 Current Configuration:');
console.log(`   Mode:       ${MODE}`);
console.log(`   API URL:    ${API_URL}`);
console.log(`   Log Level:  ${LOG_LEVEL}`);
console.log(`   Debug:      ${DEBUG}`);
console.log('');
console.log('🔗 Variable Sources:');
console.log(`   PARENT_VAR: ${PARENT_VAR}  (from parent .env)`);
console.log(`   SUB_VAR:    ${SUB_VAR}  (from local .env)`);
console.log('='.repeat(60));
console.log('');
console.log('💡 TESTING INSTRUCTIONS:');
console.log('   1. Edit ../.. (parent) .env - server should restart!');
console.log('   2. Edit local .env - server should restart!');
console.log('   3. Edit ../.. (parent) .env.development - server should restart!');
console.log('');
console.log('   Press Ctrl+C to stop.');
console.log('');

// Simulate a running server with periodic updates
let tick = 0;
const interval = setInterval(() => {
  tick++;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] tick #${tick} | PARENT_VAR: ${PARENT_VAR} | SUB_VAR: ${SUB_VAR}`);
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
