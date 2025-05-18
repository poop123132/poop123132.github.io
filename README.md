# Discord Remote Control Bot

A Discord bot that allows you to remotely control and monitor systems through Discord slash commands.

## Features

- System information monitoring
- Process management
- File system navigation
- Screenshot capture
- Command execution
- Web interface for monitoring

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/discord-remote-control-bot.git
cd discord-remote-control-bot
```

2. Install dependencies:
```bash
npm install
```

3. Start the bot:
```bash
node start.js
```

## Usage

1. Invite the bot to your Discord server using the OAuth2 URL
2. Use the `/connect` command to establish a connection
3. Use any of the available commands to control the remote system

## Available Commands

- `/connect` - Connect to the remote system
- `/disconnect` - Disconnect from the remote system
- `/sysinfo` - Get detailed system information
- `/screenshot` - Take a screenshot of the remote system
- `/processes` - List top processes by memory usage
- `/kill <pid>` - Kill a process by PID
- `/ls [path]` - List files in a directory
- `/cd <path>` - Change working directory
- `/cat <file>` - View the contents of a file
- `/exec <command>` - Execute a shell command
- `/help` - Show all available commands

## Web Interface

The bot also provides a web interface for monitoring at `http://localhost:3000` (or your configured port).

## Security Notice

This bot provides powerful remote control capabilities. Use it responsibly and only in environments where you have proper authorization. Never expose this bot to public Discord servers.

## License

MIT
```

To run the bot, follow these steps:

```bash
mkdir -p discord-remote-control-bot/public
cd discord-remote-control-bot
npm init -y
npm install discord.js systeminformation screenshot-desktop fs express
```

Then create the files as shown above and start the bot with:

```bash
node start.js
