#!/usr/bin/env node

import { config } from 'dotenv';
import { WaliaTelegramBot } from './bot.js';

// Load environment variables
config();

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Starting Walia Telegram Bot...');

  const bot = new WaliaTelegramBot(botToken, openaiApiKey);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down bot...');
    await bot.stop();
    process.exit(0);
  });

  try {
    await bot.start();
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});