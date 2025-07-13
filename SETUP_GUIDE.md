# Walia Setup Guide - Get Started in Minutes

This guide will help you set up Walia on your computer so you can start storing files securely. We'll walk you through everything step by step.

## Table of Contents

1. [Quick Start (Recommended)](#quick-start-recommended)
2. [What You Need](#what-you-need)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Using the Telegram Bot](#using-the-telegram-bot)
5. [Testing Your Setup](#testing-your-setup)
6. [Getting Help](#getting-help)

## Quick Start (Recommended)

**For most users, we recommend using the Telegram bot** - it's the easiest way to get started with Walia without any technical setup.

1. **Find our bot on Telegram**: Search for `@WaliaStorageBot`
2. **Send `/start`** to begin the setup
3. **Follow the instructions** the bot provides
4. **Start storing files** by sending them directly to the bot

That's it! No installation required.

## What You Need

### For Telegram Bot Users (Easiest)
- A Telegram account
- Some free testnet tokens (the bot will help you get these)

### For Command Line Users (Advanced)
- A computer running Windows, Mac, or Linux
- Node.js (version 18 or newer) - [Download here](https://nodejs.org/)
- About 15 minutes of setup time

## Step-by-Step Setup

### Check if Node.js is Installed

First, let's see if you have Node.js installed:

1. **Open your terminal** (Command Prompt on Windows, Terminal on Mac/Linux)
2. **Type this command**:
   ```bash
   node --version
   ```
3. **If you see a version number** like `v18.0.0` or higher, you're good to go!
4. **If you get an error**, [download and install Node.js](https://nodejs.org/)

### Download Walia

1. **Download the code**:
   ```bash
   git clone https://github.com/yourusername/walia.git
   cd walia
   ```

2. **Install everything you need**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

### Create Your Wallet

This creates a secure wallet for storing your files:

```bash
npm run create-dev-wallet
```

The system will create your wallet and show you:
- Your wallet address
- Your current balance (probably zero at first)
- Instructions for getting test tokens

## Using the Telegram Bot

Once you have either set up the command line version OR want to use just the Telegram bot:

### Setting Up the Bot

1. **Find the bot**: Search for `@WaliaStorageBot` on Telegram
2. **Start a conversation**: Send `/start`
3. **Get your setup info**: The bot will tell you your unique username and wallet address
4. **Get test tokens**: The bot will help you get free tokens for testing

### Bot Commands You Can Use

- **`/start`** - Welcome and setup
- **`/help`** - Show all commands
- **`/balance`** - Check how much storage credit you have
- **`/list`** - See all your stored files
- **`/config`** - View your settings

### Natural Language Commands

You can also just talk to the bot naturally:
- "Store this document for 6 months"
- "Show me all my files"
- "What's my wallet address?"
- "How much storage do I have left?"

## Testing Your Setup

### Command Line Testing

1. **Store a test file**:
   ```bash
   echo "Hello Walia!" > test.txt
   npm run cli store '{"filePath":"./test.txt","epochs":5}'
   ```

2. **List your files**:
   ```bash
   npm run cli list-blobs
   ```

3. **Check your balance**:
   ```bash
   npm run cli balance
   ```

### Telegram Bot Testing

1. **Send a simple message** to the bot: "Store this message for testing"
2. **Ask for your file list**: "What files do I have?"
3. **Check your balance**: "How much storage credit do I have?"

## Getting Help

### Common Issues and Quick Fixes

#### "I can't find the Telegram bot"
- Make sure you're searching for the exact name: `@WaliaStorageBot`
- Try searching in the global search (not just your chats)

#### "The setup command failed"
Try these steps:
1. Make sure you have Node.js installed (check with `node --version`)
2. Try running `npm install` again
3. If you're on Windows, try running your terminal as Administrator

#### "I don't have any storage tokens"
- Use the Telegram bot command `/balance` to check your balance
- The bot can help you get free test tokens for trying out the system
- Each new user gets some free tokens to start with

#### "My files aren't showing up"
- Try the command `/list` in the Telegram bot
- For command line: `npm run cli list-blobs`
- Remember that it might take a few minutes for files to be fully stored

#### "I want to use this for real files (not just testing)"
Currently, Walia is in testing mode using testnet tokens. This means:
- Your files are stored securely
- The tokens you use are free test tokens
- The system works the same as it will in production
- When we launch officially, you'll be able to use real tokens

### Getting More Help

1. **Telegram Support**: Message our bot `@WaliaStorageBot` with your questions
2. **Community**: Join our Telegram group for community help
3. **Documentation**: This guide and the main README cover most questions
4. **Technical Issues**: Report bugs on our GitHub repository

### For Developers and Advanced Users

If you want to contribute to Walia or need to run advanced tests:
- See our [Contributing Guide](CONTRIBUTING.md) for development setup
- Check the `CLAUDE.md` file for detailed technical instructions
- The original technical setup instructions are available in the git history

### What's Next?

Once you have Walia set up:
1. **Try storing a few test files** to get comfortable with the system
2. **Experiment with the access control features** - try sharing files with friends
3. **Monitor your usage** to understand storage costs
4. **Join our community** to stay updated on new features

Walia is constantly improving, and we love hearing from our users about what features they'd like to see next! 