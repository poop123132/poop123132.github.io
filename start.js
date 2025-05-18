const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Start the bot
console.log('Starting Discord Remote Control Bot...');
const bot = spawn('node', ['index.js'], {
    stdio: 'inherit'
});

bot.on('close', (code) => {
    console.log(`Bot process exited with code ${code}`);
});

process.on('SIGINT', () => {
    console.log('Stopping bot...');
    bot.kill('SIGINT');
    process.exit(0);
});
