import { Bot, Context, InputFile, session, SessionFlavor } from 'grammy';
import { WaliaMCPClient } from './mcp-client.js';
import { WalrusAssistant } from './assistant.js';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);

export interface SessionData {
  userName: string;
  walletsDir: string;
  environment: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export class WaliaTelegramBot {
  private bot: Bot<MyContext>;
  private mcpClient: WaliaMCPClient;
  private assistant: WalrusAssistant;

  constructor(botToken: string, openaiApiKey: string) {
    this.bot = new Bot<MyContext>(botToken);
    this.mcpClient = new WaliaMCPClient();
    this.assistant = new WalrusAssistant(openaiApiKey, this.mcpClient);
    
    this.setupMiddleware();
    this.setupCommands();
    this.setupMessageHandlers();
  }

  private setupMiddleware(): void {
    // Session middleware
    this.bot.use(session({
      initial(): SessionData {
        return {
          userName: '', // Will be set on first interaction
          walletsDir: process.env.WALIA_WALLETS_DIR || './dev-wallets',
          environment: process.env.WALLET_ENV || 'testnet',
          conversationHistory: []
        };
      }
    }));

    // Middleware to ensure userName is set from Telegram user info
    this.bot.use(async (ctx, next) => {
      if (!ctx.session.userName) {
        const telegramUser = ctx.from;
        if (!telegramUser?.id) {
          console.error('No Telegram user ID available');
          await ctx.reply('❌ Error: Unable to identify user. Please restart the bot.');
          return;
        }
        ctx.session.userName = `user_${telegramUser.id}`;
      }
      await next();
    });
  }

  private setupCommands(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'Welcome to Walia Storage Bot! 🐋\n\n' +
        'I can help you manage your files on Walrus storage with encrypted access control.\n\n' +
        'Available commands:\n' +
        '/help - Show this help message\n' +
        '/config - Configure your wallet settings\n' +
        '/store - Store a file to Walrus\n' +
        '/list - List your stored files\n' +
        '/read - Read a file by blob ID\n' +
        '/attributes - Manage file attributes\n' +
        '/burn - Delete files from storage\n' +
        '/send - Send files to other addresses\n' +
        '/address - Get your wallet address\n' +
        '/balance - Check your wallet balance\n' +
        '/status - Show current configuration\n\n' +
        'You can also just chat with me naturally - I\'ll help you with Walrus storage operations!'
      );
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'Walia Storage Bot Commands:\n\n' +
        '🔧 Configuration:\n' +
        '/config - View current settings (all auto-configured)\n' +
        '/status - Show current settings\n' +
        '/address - Get your wallet address\n' +
        '/balance - Check your wallet balance\n\n' +
        '📁 File Operations:\n' +
        '/store - Store a file to Walrus\n' +
        '/list - List your stored files\n' +
        '/read <blob_id> - Read a file\n\n' +
        '🏷️ Attributes:\n' +
        '/attributes <object_id> - View file attributes\n\n' +
        '🔥 File Management:\n' +
        '/burn <object_id1> [object_id2] ... - Delete specific files\n' +
        '/burn_expired - Delete all expired files\n' +
        '/send <object_id> <address> - Send file to another address\n\n' +
        '💬 Natural Language:\n' +
        'Just type what you want to do! Examples:\n' +
        '• "Store my document with 10 epochs"\n' +
        '• "List all my files"\n' +
        '• "What files do I have stored?"\n' +
        '• "Delete expired blobs"\n\n' +
        '🔒 Your username is automatically set from your Telegram user ID.\n' +
        '📁 Wallets directory is set via WALIA_WALLETS_DIR environment variable.\n' +
        '🌐 Environment is fixed to testnet for security.'
      );
    });

    // Config command
    this.bot.command('config', async (ctx) => {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length === 0) {
        await ctx.reply(
          'Current configuration:\n' +
          `👤 User: ${ctx.session.userName} (from Telegram ID)\n` +
          `📁 Wallets Dir: ${ctx.session.walletsDir} (from environment)\n` +
          `🌐 Environment: ${ctx.session.environment} (fixed)\n\n` +
          'All settings are automatically configured:\n' +
          '• Username: Based on your Telegram user ID\n' +
          '• Wallets Directory: Set via WALIA_WALLETS_DIR environment variable\n' +
          '• Environment: Fixed to testnet for security'
        );
        return;
      }

      const [setting] = args;
      
      switch (setting) {
        case 'walletsDir':
          await ctx.reply('❌ Wallets directory is set via WALIA_WALLETS_DIR environment variable and cannot be changed.');
          break;
        case 'userName':
          await ctx.reply('❌ Username is automatically set from your Telegram user ID and cannot be changed.');
          break;
        case 'environment':
          await ctx.reply('❌ Environment is fixed to testnet and cannot be changed.');
          break;
        default:
          await ctx.reply('❌ All settings are automatically configured and cannot be changed.');
      }
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      await ctx.reply(
        '📊 Current Configuration:\n\n' +
        `👤 Username: ${ctx.session.userName}\n` +
        `📁 Wallets Directory: ${ctx.session.walletsDir}\n` +
        `🌐 Environment: ${ctx.session.environment}\n` +
        `💬 Conversation Messages: ${ctx.session.conversationHistory.length}`
      );
    });

    // List command
    this.bot.command('list', async (ctx) => {
      await ctx.reply('🔍 Fetching your stored files...');
      
      try {
        const blobs = await this.mcpClient.listBlobs({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment
        });

        if (blobs.length === 0) {
          await ctx.reply('📭 No files found in your storage.');
          return;
        }

        let message = `📁 Your stored files (${blobs.length}):\n\n`;
        console.log('List command: blobs =', blobs);
        blobs.forEach((blob, index) => {
          message += `${index + 1}. 🆔 ${blob.blobId}\n`;
          message += `   📦 Object: ${blob.id}\n`;
          message += `   📅 Registered: Epoch ${blob.storage.startEpoch}\n`;
          message += `   📅 Expires: Epoch ${blob.storage.endEpoch}\n`;
          if (blob.attributes) {
            if (blob.attributes.original_name) {
              message += `   📝 Name: ${blob.attributes.original_name}\n`;
            }
            if (blob.attributes.upload_timestamp) {
              message += `   ⏰ Uploaded: ${blob.attributes.upload_timestamp}\n`;
            }
            if (blob.attributes.whitelistId) {
              message += `   🟢 Whitelist ID: ${blob.attributes.whitelistId}\n`;
            }
            if (blob.attributes.capId) {
              message += `   🛡️ Cap ID: ${blob.attributes.capId}\n`;
            }
          }
          message += `   🗑️ Deletable: ${blob.deletable ? 'Yes' : 'No'}\n\n`;
        });

        await ctx.reply(message);
      } catch (error) {
        await ctx.reply(`❌ Error fetching files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Read command
    this.bot.command('read', async (ctx) => {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length === 0) {
        await ctx.reply('❌ Please provide a blob ID. Usage: /read <blob_id>');
        return;
      }

      const blobId = args[0];
      await ctx.reply(`🔍 Reading file with blob ID: ${blobId}...`);

      let filePath: string | undefined;
      try {
        filePath = await this.mcpClient.readFile({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment,
          blobId
        });

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          await ctx.reply(`❌ File not found at path: ${filePath}`);
          return;
        }

        // Get original filename from file attributes if available
        let originalFileName = path.basename(filePath);
        try {
          const objectId = await this.mcpClient.getBlobObjectId({
            userName: ctx.session.userName,
            walletsDir: ctx.session.walletsDir,
            environment: ctx.session.environment,
            blobId
          });
          
          if (objectId) {
            const attributes = await this.mcpClient.getBlobAttributes({
              userName: ctx.session.userName,
              walletsDir: ctx.session.walletsDir,
              environment: ctx.session.environment,
              blobObjectId: objectId
            });
            
            if (attributes.original_name) {
              originalFileName = attributes.original_name;
            }
          }
        } catch (error) {
          // If we can't get attributes, just use the filename from path
          console.warn('Could not get file attributes for original name:', error);
        }

        // Send the file as an attachment
        await ctx.replyWithDocument(new InputFile(filePath, originalFileName), {
          caption: `✅ File retrieved successfully!\n🆔 Blob ID: ${blobId}\n📎 Filename: ${originalFileName}`
        });

      } catch (error) {
        await ctx.reply(`❌ Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        // Clean up the temporary file in both success and error cases
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            console.warn('Could not clean up temporary file:', cleanupError);
          }
        }
      }
    });

    // Attributes command
    this.bot.command('attributes', async (ctx) => {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length === 0) {
        await ctx.reply('❌ Please provide an object ID. Usage: /attributes <object_id>');
        return;
      }

      const objectId = args[0];
      await ctx.reply(`🔍 Fetching attributes for object: ${objectId}...`);

      try {
        const attributes = await this.mcpClient.getBlobAttributes({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment,
          blobObjectId: objectId
        });

        if (Object.keys(attributes).length === 0) {
          await ctx.reply('📭 No attributes found for this object.');
          return;
        }

        let message = '🏷️ File Attributes:\n\n';
        Object.entries(attributes).forEach(([key, value]) => {
          message += `• ${key}: ${value}\n`;
        });

        await ctx.reply(message);
      } catch (error) {
        await ctx.reply(`❌ Error fetching attributes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Address command
    this.bot.command('address', async (ctx) => {
      await ctx.reply('🔍 Fetching your wallet address...');

      try {
        const address = await this.mcpClient.getWalletAddress({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment
        });

        if (!address) {
          await ctx.reply('❌ Could not retrieve wallet address.');
          return;
        }

        await ctx.reply(`🏦 Your wallet address:\n\n\`${address}\`\n\n💡 You can use this address to receive SUI tokens or Walrus objects.`);
      } catch (error) {
        await ctx.reply(`❌ Error fetching wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Balance command
    this.bot.command('balance', async (ctx) => {
      await ctx.reply('💰 Checking your wallet balance...');

      try {
        const balance = await this.mcpClient.getWalletBalance({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment
        });

        await ctx.reply(
          `💳 Your wallet balance:\n\n` +
          `🔹 SUI: ${balance.sui} tokens\n` +
          `🔹 WAL: ${balance.wal} tokens\n\n` +
          `📋 To store files on Walrus, you need:\n` +
          `• At least 0.5 SUI tokens\n` +
          `• At least 0.5 WAL tokens\n\n` +
          `💸 Use /address to get your wallet address for funding.`
        );
      } catch (error) {
        await ctx.reply(`❌ Error fetching wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Burn command
    this.bot.command('burn', async (ctx) => {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length === 0) {
        await ctx.reply('❌ Please provide object ID(s) to burn. Usage: /burn <object_id1> [object_id2] ...');
        return;
      }

      await ctx.reply(`🔥 Burning ${args.length} file(s)...`);

      try {
        const result = await this.mcpClient.burnBlobs({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment,
          blobObjectIds: args
        });

        await ctx.reply(`✅ Successfully burned ${args.length} file(s) from storage.\n\n🔥 ${result}`);
      } catch (error) {
        await ctx.reply(`❌ Error burning files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Burn expired command
    this.bot.command('burn_expired', async (ctx) => {
      await ctx.reply('🔥 Burning all expired files...');

      try {
        const result = await this.mcpClient.burnBlobs({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment,
          all_expired: true
        });

        await ctx.reply(`✅ Successfully cleaned up expired files from storage.\n\n🔥 ${result}`);
      } catch (error) {
        await ctx.reply(`❌ Error burning expired files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Send command
    this.bot.command('send', async (ctx) => {
      const args = ctx.message?.text?.split(' ').slice(1);
      
      if (!args || args.length !== 2) {
        await ctx.reply('❌ Please provide object ID and destination address. Usage: /send <object_id> <destination_address>');
        return;
      }

      const [objectId, destinationAddress] = args;
      await ctx.reply(`📤 Sending file to address: ${destinationAddress.substring(0, 16)}...`);

      try {
        const result = await this.mcpClient.sendBlob({
          userName: ctx.session.userName,
          walletsDir: ctx.session.walletsDir,
          environment: ctx.session.environment,
          blobObjectId: objectId,
          destinationAddress
        });

        await ctx.reply(`✅ File successfully sent!\n\n📤 ${result}\n\n🎯 Destination: ${destinationAddress}`);
      } catch (error) {
        await ctx.reply(`❌ Error sending file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private setupMessageHandlers(): void {
    // Handle text messages with AI assistant
    this.bot.on('message:text', async (ctx) => {
      // Skip if it's a command
      if (ctx.message.text.startsWith('/')) {
        return;
      }

      const userMessage = ctx.message.text;
      
      // Add user message to conversation history
      ctx.session.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Keep conversation history manageable (last 10 messages)
      if (ctx.session.conversationHistory.length > 20) {
        ctx.session.conversationHistory = ctx.session.conversationHistory.slice(-20);
      }

      await ctx.reply('🤔 Let me help you with that...');

      try {
        const response = await this.assistant.processMessage(
          userMessage,
          ctx.session.conversationHistory,
          {
            userName: ctx.session.userName,
            walletsDir: ctx.session.walletsDir,
            environment: ctx.session.environment
          }
        );

        // Add assistant response to conversation history
        ctx.session.conversationHistory.push({
          role: 'assistant',
          content: response
        });

        await ctx.reply(response);
      } catch (error) {
        await ctx.reply(`❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle document uploads
    this.bot.on('message:document', async (ctx) => {
      const document = ctx.message.document;
      await ctx.reply('📁 Processing your document...');
      
      try {
        await this.handleFileAttachment(ctx, document.file_id, document.file_name || 'document');
      } catch (error) {
        await ctx.reply(`❌ Error processing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle photo uploads
    this.bot.on('message:photo', async (ctx) => {
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1]; // Get highest resolution
      await ctx.reply('🖼️ Processing your photo...');
      
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await this.handleFileAttachment(ctx, largestPhoto.file_id, `photo_${timestamp}.jpg`);
      } catch (error) {
        await ctx.reply(`❌ Error processing photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle video uploads
    this.bot.on('message:video', async (ctx) => {
      const video = ctx.message.video;
      await ctx.reply('🎥 Processing your video...');
      
      try {
        await this.handleFileAttachment(ctx, video.file_id, video.file_name || 'video.mp4');
      } catch (error) {
        await ctx.reply(`❌ Error processing video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle audio uploads
    this.bot.on('message:audio', async (ctx) => {
      const audio = ctx.message.audio;
      await ctx.reply('🎧 Processing your audio...');
      
      try {
        await this.handleFileAttachment(ctx, audio.file_id, audio.file_name || 'audio.mp3');
      } catch (error) {
        await ctx.reply(`❌ Error processing audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      const voice = ctx.message.voice;
      await ctx.reply('🎙️ Processing your voice message...');
      
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await this.handleFileAttachment(ctx, voice.file_id, `voice_${timestamp}.ogg`);
      } catch (error) {
        await ctx.reply(`❌ Error processing voice message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.mcpClient.connect();
      console.log('✅ Connected to MCP server');
      
      await this.bot.start();
      console.log('🤖 Telegram bot started successfully');
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    await this.mcpClient.disconnect();
    console.log('🛑 Bot stopped');
  }

  private async ensureUserDirectoryExists(userName: string, walletsDir: string): Promise<string> {
    const userDir = path.join(walletsDir, userName);
    const dataDir = path.join(userDir, 'data');
    const inDir = path.join(dataDir, 'in');
    
    try {
      await access(inDir);
    } catch {
      await mkdir(inDir, { recursive: true });
    }
    
    return inDir;
  }

  private async downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        
        fileStream.on('error', reject);
      });
      
      request.on('error', reject);
      request.setTimeout(30000, () => {
        reject(new Error('Download timeout'));
      });
    });
  }

  private async handleFileAttachment(ctx: MyContext, fileId: string, fileName: string): Promise<void> {
    try {
      // Get file info from Telegram
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        throw new Error('Could not get file path from Telegram');
      }

      // Ensure user directory exists
      const inDir = await this.ensureUserDirectoryExists(ctx.session.userName, ctx.session.walletsDir);
      
      // Create unique filename to avoid conflicts
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uniqueFileName = `${timestamp}_${fileName}`;
      const localFilePath = path.join(inDir, uniqueFileName);
      
      console.log('Bot: Creating file at path:', localFilePath);
      console.log('Bot: Absolute path:', path.resolve(localFilePath));
      console.log('Bot: Current working directory:', process.cwd());
      
      // Download file from Telegram
      const botToken = this.bot.token;
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      
      await this.downloadFile(fileUrl, localFilePath);
      
      console.log('Bot: File downloaded successfully');
      console.log('Bot: File exists?', fs.existsSync(localFilePath));
      
      // Store file to Walrus with default settings
      await ctx.reply('🐋 Storing your file to Walrus...');
      
      // Use absolute path for MCP server
      const absoluteFilePath = path.resolve(localFilePath);
      console.log('Bot: Sending absolute file path to MCP server:', absoluteFilePath);
      
      const result = await this.mcpClient.storeFile({
        userName: ctx.session.userName,
        walletsDir: ctx.session.walletsDir,
        environment: ctx.session.environment,
        filePath: absoluteFilePath,
        epochs: 5, // Default to 5 epochs
        deletable: true,
        attributes: {
          'original_name': fileName,
          'telegram_file_id': fileId,
          'upload_timestamp': new Date().toISOString(),
          'file_type': 'telegram_attachment'
        }
      });
      console.log('Bot: storeFile result:', result);
      await ctx.reply(
        `✅ File stored successfully!

` +
        `📎 Original Name: ${fileName}
` +
        `🆔 Blob ID: ${result.blobId}
` +
        `📆 Object ID: ${result.objectId}
` +
        `💾 Size: ${result.unencodedSize} bytes
` +
        `🔒 Encoding: ${result.encodingType}

` +
        `Your file is now stored securely on Walrus with 5 epochs of storage!`
      );
      
    } catch (error) {
      console.error('Error handling file attachment:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        // Check if it's an MCP parsing error that might contain the real error message
        if (errorMessage.includes('Cannot read properties of undefined')) {
          // This is likely an MCP SDK parsing error, check if we can get the actual error from the console
          // For now, assume it's a balance error since that's the most common issue
          await ctx.reply(
            `❌ Unable to store file - likely due to insufficient wallet balance.

💰 Your wallet needs funding to store files on Walrus.

📋 Requirements:
• At least 0.5 SUI tokens
• At least 0.5 WAL tokens

🔍 Check your wallet status:
/address - Get your wallet address
/balance - Check your current balance

💸 Please fund your wallet and try again.`
          );
          return;
        }
        
        // Check if it's a balance error
        if (errorMessage.includes('Insufficient balance')) {
          await ctx.reply(
            `❌ Insufficient wallet balance to store files!

💰 Your wallet needs funding to store files on Walrus.

📋 Requirements:
• At least 0.5 SUI tokens
• At least 0.5 WAL tokens

🔍 To check your wallet details:
/address - Get your wallet address
/balance - Check your current balance

💸 Please fund your wallet and try again.`
          );
          return;
        }
        
        // Handle other errors
        await ctx.reply(`❌ Error processing file: ${errorMessage}`);
      } else {
        await ctx.reply(`❌ Error processing file: Unknown error occurred`);
      }
    }
  }
}