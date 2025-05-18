const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const si = require('systeminformation');
const screenshot = require('screenshot-desktop');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const express = require('express');

// Create Express app for the web interface
const app = express();
const PORT = process.env.PORT || 3000;

// Set up the Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ] 
});

// Bot configuration
const TOKEN = 'MTM3MTMxNjQzNjk2OTk4NDA1MA.G4Hq6N.PkkKI9xRc-A9kpg6CI-fd8MFio7VXH_XEdoQjQ';
let currentWorkingDirectory = process.cwd();
let connectedUsers = new Set();
let logs = [];

// Add a log entry
function addLog(message, type = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = { timestamp, message, type };
  logs.push(logEntry);
  console.log(`[${timestamp}] [${type}] ${message}`);
  
  // Keep only the last 100 logs
  if (logs.length > 100) {
    logs.shift();
  }
  
  return logEntry;
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('connect')
      .setDescription('Connect to the remote system'),
    new SlashCommandBuilder()
      .setName('disconnect')
      .setDescription('Disconnect from the remote system'),
    new SlashCommandBuilder()
      .setName('sysinfo')
      .setDescription('Get detailed system information'),
    new SlashCommandBuilder()
      .setName('screenshot')
      .setDescription('Take a screenshot of the remote system'),
    new SlashCommandBuilder()
      .setName('processes')
      .setDescription('List top processes by memory usage'),
    new SlashCommandBuilder()
      .setName('kill')
      .setDescription('Kill a process by PID')
      .addIntegerOption(option => 
        option.setName('pid')
          .setDescription('Process ID to kill')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('ls')
      .setDescription('List files in a directory')
      .addStringOption(option => 
        option.setName('path')
          .setDescription('Directory path (default: current directory)')
          .setRequired(false)),
    new SlashCommandBuilder()
      .setName('cd')
      .setDescription('Change working directory')
      .addStringOption(option => 
        option.setName('path')
          .setDescription('Directory path to navigate to')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('cat')
      .setDescription('View the contents of a file')
      .addStringOption(option => 
        option.setName('file')
          .setDescription('File to view')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('exec')
      .setDescription('Execute a shell command')
      .addStringOption(option => 
        option.setName('command')
          .setDescription('Command to execute')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all available commands')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    addLog('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    addLog('Successfully reloaded application (/) commands.');
  } catch (error) {
    addLog(`Error registering commands: ${error.message}`, 'error');
  }
}

// Check if user is connected
function isConnected(userId) {
  return connectedUsers.has(userId);
}

// Command handlers
async function handleConnect(interaction) {
  const userId = interaction.user.id;
  connectedUsers.add(userId);
  addLog(`User ${interaction.user.tag} connected to the system`);
  await interaction.reply({ content: '✅ Successfully connected to the remote system. You can now use commands.', ephemeral: true });
}

async function handleDisconnect(interaction) {
  const userId = interaction.user.id;
  if (isConnected(userId)) {
    connectedUsers.delete(userId);
    addLog(`User ${interaction.user.tag} disconnected from the system`);
    await interaction.reply({ content: '✅ Successfully disconnected from the remote system.', ephemeral: true });
  } else {
    await interaction.reply({ content: '❌ You are not currently connected to any system.', ephemeral: true });
  }
}

async function handleSysInfo(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  await interaction.deferReply();
  
  try {
    const [cpu, mem, os, system, time] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.system(),
      si.time()
    ]);
    
    const cpuUsage = await si.currentLoad();
    
    const embed = {
      title: 'System Information',
      color: 0x7289DA,
      fields: [
        { name: 'Hostname', value: system.hostname, inline: true },
        { name: 'OS', value: `${os.distro} ${os.release}`, inline: true },
        { name: 'Kernel', value: os.kernel, inline: true },
        { name: 'CPU', value: `${cpu.manufacturer} ${cpu.brand}`, inline: true },
        { name: 'CPU Usage', value: `${cpuUsage.currentLoad.toFixed(2)}%`, inline: true },
        { name: 'Memory', value: `${Math.round(mem.used / 1024 / 1024 / 1024 * 100) / 100} GB / ${Math.round(mem.total / 1024 / 1024 / 1024 * 100) / 100} GB`, inline: true },
        { name: 'Uptime', value: formatUptime(os.uptime), inline: true }
      ],
      timestamp: new Date().toISOString()
    };
    
    addLog(`System information requested by ${interaction.user.tag}`);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    addLog(`Error getting system info: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error getting system information: ${error.message}` });
  }
}

async function handleScreenshot(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  await interaction.deferReply();
  
  try {
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await screenshot({ filename: screenshotPath });
    
    addLog(`Screenshot taken by ${interaction.user.tag}`);
    await interaction.editReply({ 
      content: 'Current screenshot:',
      files: [screenshotPath]
    });
    
    // Clean up the file after sending
    setTimeout(() => {
      fs.unlink(screenshotPath, (err) => {
        if (err) addLog(`Error deleting screenshot: ${err.message}`, 'error');
      });
    }, 5000);
  } catch (error) {
    addLog(`Error taking screenshot: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error taking screenshot: ${error.message}` });
  }
}

async function handleProcesses(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  await interaction.deferReply();
  
  try {
    const processes = await si.processes();
    const topProcesses = processes.list
      .sort((a, b) => b.memRss - a.memRss)
      .slice(0, 10);
    
    let description = '```\nPID    MEM      CPU%  NAME\n';
    description += '--------------------------------\n';
    
    topProcesses.forEach(proc => {
      const memMB = (proc.memRss / 1024 / 1024).toFixed(2);
      description += `${proc.pid.toString().padEnd(7)} ${memMB.padEnd(8)} ${proc.cpu.toFixed(1).padEnd(5)} ${proc.name}\n`;
    });
    
    description += '```';
    
    addLog(`Process list requested by ${interaction.user.tag}`);
    await interaction.editReply({ 
      embeds: [{
        title: 'Top Processes by Memory Usage',
        description: description,
        color: 0x7289DA
      }]
    });
  } catch (error) {
    addLog(`Error getting processes: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error getting processes: ${error.message}` });
  }
}

async function handleKill(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  const pid = interaction.options.getInteger('pid');
  await interaction.deferReply();
  
  try {
    // Use different kill commands based on platform
    const command = process.platform === 'win32' 
      ? `taskkill /PID ${pid} /F` 
      : `kill -9 ${pid}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        addLog(`Error killing process ${pid}: ${error.message}`, 'error');
        interaction.editReply({ content: `❌ Error killing process: ${error.message}` });
        return;
      }
      
      addLog(`Process ${pid} killed by ${interaction.user.tag}`);
      interaction.editReply({ content: `✅ Process with PID ${pid} has been terminated.` });
    });
  } catch (error) {
    addLog(`Error killing process ${pid}: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error killing process: ${error.message}` });
  }
}

async function handleLs(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  const dirPath = interaction.options.getString('path') || currentWorkingDirectory;
  const fullPath = path.resolve(currentWorkingDirectory, dirPath);
  
  await interaction.deferReply();
  
  try {
    const files = fs.readdirSync(fullPath);
    
    let fileList = '';
    for (const file of files) {
      try {
        const stats = fs.statSync(path.join(fullPath, file));
        const isDir = stats.isDirectory();
        const size = stats.size;
        const sizeStr = formatFileSize(size);
        fileList += `${isDir ? '📁' : '📄'} ${file.padEnd(30)} ${isDir ? '<DIR>' : sizeStr}\n`;
      } catch (err) {
        fileList += `❌ ${file} (error reading file info)\n`;
      }
    }
    
    if (fileList === '') {
      fileList = '(empty directory)';
    }
    
    addLog(`Directory listing of ${fullPath} requested by ${interaction.user.tag}`);
    await interaction.editReply({ 
      embeds: [{
        title: `Directory: ${fullPath}`,
        description: `\`\`\`\n${fileList}\`\`\``,
        color: 0x7289DA
      }]
    });
  } catch (error) {
    addLog(`Error listing directory ${fullPath}: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error listing directory: ${error.message}` });
  }
}

async function handleCd(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  const dirPath = interaction.options.getString('path');
  const newPath = path.resolve(currentWorkingDirectory, dirPath);
  
  try {
    // Check if directory exists and is accessible
    fs.accessSync(newPath, fs.constants.R_OK);
    const stats = fs.statSync(newPath);
    
    if (!stats.isDirectory()) {
      return interaction.reply({ content: `❌ '${newPath}' is not a directory.`, ephemeral: true });
    }
    
    currentWorkingDirectory = newPath;
    addLog(`Changed directory to ${newPath} by ${interaction.user.tag}`);
    await interaction.reply({ content: `✅ Changed directory to: ${newPath}` });
  } catch (error) {
    addLog(`Error changing directory to ${newPath}: ${error.message}`, 'error');
    await interaction.reply({ content: `❌ Error changing directory: ${error.message}`, ephemeral: true });
  }
}

async function handleCat(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  const filePath = interaction.options.getString('file');
  const fullPath = path.resolve(currentWorkingDirectory, filePath);
  
  await interaction.deferReply();
  
  try {
    // Check if file exists and is accessible
    fs.accessSync(fullPath, fs.constants.R_OK);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      return interaction.editReply({ content: `❌ '${fullPath}' is a directory, not a file.` });
    }
    
    // Check file size to avoid large files
    if (stats.size > 100000) { // 100KB limit
      return interaction.editReply({ content: `❌ File is too large (${formatFileSize(stats.size)}). Maximum size is 100KB.` });
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Truncate if still too long for Discord
    let displayContent = content.length > 1900 
      ? content.substring(0, 1900) + '... (truncated)'
      : content;
    
    addLog(`File ${fullPath} viewed by ${interaction.user.tag}`);
    await interaction.editReply({ 
      embeds: [{
        title: `File: ${path.basename(fullPath)}`,
        description: `\`\`\`\n${displayContent}\`\`\``,
        color: 0x7289DA,
        footer: { text: `${fullPath} - ${formatFileSize(stats.size)}` }
      }]
    });
  } catch (error) {
    addLog(`Error reading file ${fullPath}: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error reading file: ${error.message}` });
  }
}

async function handleExec(interaction) {
  if (!isConnected(interaction.user.id)) {
    return interaction.reply({ content: '❌ You need to connect first using `/connect`', ephemeral: true });
  }

  const command = interaction.options.getString('command');
  
  await interaction.deferReply();
  
  try {
    addLog(`Command execution requested by ${interaction.user.tag}: ${command}`, 'warning');
    
    exec(command, { cwd: currentWorkingDirectory }, (error, stdout, stderr) => {
      let output = '';
      
      if (stdout) output += `**Output:**\n\`\`\`\n${stdout}\`\`\`\n`;
      if (stderr) output += `**Error:**\n\`\`\`\n${stderr}\`\`\`\n`;
      if (error) output += `**Execution Error:**\n\`\`\`\n${error.message}\`\`\`\n`;
      
      if (!output) output = '✅ Command executed successfully (no output)';
      
      // Truncate if too long
      if (output.length > 1950) {
        output = output.substring(0, 1950) + '... (truncated)';
      }
      
      interaction.editReply({ content: output });
    });
  } catch (error) {
    addLog(`Error executing command: ${error.message}`, 'error');
    await interaction.editReply({ content: `❌ Error executing command: ${error.message}` });
  }
}

async function handleHelp(interaction) {
  const helpEmbed = {
    title: 'Discord Remote Control Bot - Help',
    description: 'Here are all available commands:',
    color: 0x7289DA,
    fields: [
      { name: '/connect', value: 'Connect to the remote system', inline: true },
      { name: '/disconnect', value: 'Disconnect from the remote system', inline: true },
      { name: '/sysinfo', value: 'Get detailed system information', inline: true },
      { name: '/screenshot', value: 'Take a screenshot of the remote system', inline: true },
      { name: '/processes', value: 'List top processes by memory usage', inline: true },
      { name: '/kill <pid>', value: 'Kill a process by PID', inline: true },
      { name: '/ls [path]', value: 'List files in a directory', inline: true },
      { name: '/cd <path>', value: 'Change working directory', inline: true },
      { name: '/cat <file>', value: 'View the contents of a file', inline: true },
      { name: '/exec <command>', value: 'Execute a shell command', inline: true },
      { name: '/help', value: 'Show this help message', inline: true }
    ],
    footer: {
      text: 'Use these commands responsibly and legally.'
    }
  };
  
  await interaction.reply({ embeds: [helpEmbed] });
}

// Utility functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// Set up Express routes for the web interface
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: client.uptime,
    connectedUsers: Array.from(connectedUsers).length
  });
});

app.get('/api/sysinfo', async (req, res) => {
  try {
    const [cpu, mem, os, system] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.system()
    ]);
    
    const cpuUsage = await si.currentLoad();
    
    res.json({
      hostname: system.hostname,
      os: `${os.distro} ${os.release}`,
      cpu: `${cpu.manufacturer} ${cpu.brand}`,
      cpuUsage: cpuUsage.currentLoad.toFixed(2) + '%',
      memory: {
        used: Math.round(mem.used / 1024 / 1024 / 1024 * 100) / 100,
        total: Math.round(mem.total / 1024 / 1024 / 1024 * 100) / 100,
        percent: Math.round(mem.used / mem.total * 100) + '%'
      },
      uptime: formatUptime(os.uptime)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  res.json(logs);
});

// Discord client event handlers
client.once('ready', async () => {
  addLog(`Logged in as ${client.user.tag}`);
  await registerCommands();
  
  // Start the web server
  app.listen(PORT, () => {
    addLog(`Web interface running on port ${PORT}`);
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'connect':
        await handleConnect(interaction);
        break;
      case 'disconnect':
        await handleDisconnect(interaction);
        break;
      case 'sysinfo':
        await handleSysInfo(interaction);
        break;
      case 'screenshot':
        await handleScreenshot(interaction);
        break;
      case 'processes':
        await handleProcesses(interaction);
        break;
      case 'kill':
        await handleKill(interaction);
        break;
      case 'ls':
        await handleLs(interaction);
        break;
      case 'cd':
        await handleCd(interaction);
        break;
      case 'cat':
        await handleCat(interaction);
        break;
      case 'exec':
        await handleExec(interaction);
        break;
      case 'help':
        await handleHelp(interaction);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown command', ephemeral: true });
    }
  } catch (error) {
    addLog(`Error handling command ${commandName}: ${error.message}`, 'error');
    
    // Try to respond to the user if possible
    try {
      const content = `❌ Error executing command: ${error.message}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    } catch (replyError) {
      console.error('Failed to reply with error:', replyError);
    }
  }
});

// Start the bot
client.login(TOKEN).catch(error => {
  addLog(`Failed to login: ${error.message}`, 'error');
});

// Handle process termination
process.on('SIGINT', () => {
  addLog('Bot is shutting down', 'info');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  addLog(`Unhandled promise rejection: ${error.message}`, 'error');
  console.error('Unhandled promise rejection:', error);
});
