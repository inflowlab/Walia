import OpenAI from 'openai';
import { WaliaMCPClient } from './mcp-client.js';

export interface UserConfig {
  userName: string;
  walletsDir: string;
  environment: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class WalrusAssistant {
  private openai: OpenAI;
  private mcpClient: WaliaMCPClient;

  constructor(apiKey: string, mcpClient: WaliaMCPClient) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.mcpClient = mcpClient;
  }

  async processMessage(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    userConfig: UserConfig
  ): Promise<string> {
    // Analyze the user's intent using OpenAI
    const intent = await this.analyzeIntent(userMessage, conversationHistory);
    
    // Execute the appropriate action based on intent
    try {
      switch (intent.action) {
        case 'store_file':
          return await this.handleStoreFile(intent, userConfig);
        case 'list_files':
          return await this.handleListFiles(userConfig);
        case 'read_file':
          return await this.handleReadFile(intent, userConfig);
        case 'get_attributes':
          return await this.handleGetAttributes(intent, userConfig);
        case 'add_attributes':
          return await this.handleAddAttributes(intent, userConfig);
        case 'burn_files':
          return await this.handleBurnFiles(intent, userConfig);
        case 'send_file':
          return await this.handleSendFile(intent, userConfig);
        case 'general_help':
          return this.generateHelpResponse(intent.query);
        default:
          return await this.generateContextualResponse(userMessage, conversationHistory);
      }
    } catch (error) {
      return `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or use a more specific command.`;
    }
  }

  private async analyzeIntent(userMessage: string, conversationHistory: ConversationMessage[]): Promise<any> {
    const systemPrompt = `You are an AI assistant that analyzes user messages to determine what Walrus storage operation they want to perform.

Available operations:
- store_file: Store a file to Walrus storage
- list_files: List stored files
- read_file: Read/retrieve a file by blob ID
- get_attributes: Get attributes of a file
- add_attributes: Add attributes to a file
- burn_files: Delete files from storage
- send_file: Transfer a file to another address
- general_help: General questions about Walrus storage

Analyze the user's message and return a JSON object with:
{
  "action": "one of the actions above",
  "confidence": 0.0-1.0,
  "parameters": {
    // extracted parameters like filePath, blobId, attributes, etc.
  },
  "query": "original user query for context"
}

Examples:
"Store my document.txt with 5 epochs" -> {"action": "store_file", "confidence": 0.9, "parameters": {"filePath": "document.txt", "epochs": 5}, "query": "Store my document.txt with 5 epochs"}
"List my files" -> {"action": "list_files", "confidence": 0.95, "parameters": {}, "query": "List my files"}
"What is Walrus storage?" -> {"action": "general_help", "confidence": 0.8, "parameters": {}, "query": "What is Walrus storage?"}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-5).map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: userMessage }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.1,
      max_tokens: 500
    });

    try {
      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }
      return JSON.parse(response);
    } catch (error) {
      // Fallback to general help if parsing fails
      return {
        action: 'general_help',
        confidence: 0.5,
        parameters: {},
        query: userMessage
      };
    }
  }

  private async handleStoreFile(intent: any, userConfig: UserConfig): Promise<string> {
    const { filePath, epochs = 5, deletable = false, attributes = {} } = intent.parameters;
    
    if (!filePath) {
      return 'I need a file path to store. Please specify which file you want to store in Walrus.';
    }

    const result = await this.mcpClient.storeFile({
      ...userConfig,
      filePath,
      epochs,
      deletable,
      attributes
    });

    return `✅ File stored successfully!\n\n` +
           `🆔 Blob ID: ${result.blobId}\n` +
           `📦 Object ID: ${result.objectId}\n` +
           `💰 Storage Cost: ${result.storageCost} SUI\n` +
           `📊 Size: ${result.unencodedSize} bytes (encoded: ${result.encodedSize} bytes)\n` +
           `🔄 Encoding: ${result.encodingType}`;
  }

  private async handleListFiles(userConfig: UserConfig): Promise<string> {
    const blobs = await this.mcpClient.listBlobs({
      ...userConfig,
      includeExpired: false
    });

    if (blobs.length === 0) {
      return '📭 You don\'t have any files stored in Walrus yet. Use the store command to upload your first file!';
    }

    let response = `📁 You have ${blobs.length} file${blobs.length > 1 ? 's' : ''} stored:\n\n`;
    console.log('List command: blobs =', blobs);
    blobs.forEach((blob, index) => {
      response += `${index + 1}. 🆔 ${blob.blobId}\n`;
      response += `   📦 Object: ${blob.id}\n`;
      response += `   📅 Registered: Epoch ${blob.storage.startEpoch}\n`;
      response += `   📅 Expires: Epoch ${blob.storage.endEpoch}\n`;
      if (blob.attributes) {
        if (blob.attributes.original_name) {
          response += `   📝 Name: ${blob.attributes.original_name}\n`;
        }
        if (blob.attributes.upload_timestamp) {
          response += `   ⏰ Uploaded: ${blob.attributes.upload_timestamp}\n`;
        }
        if (blob.attributes.whitelistId) {
          response += `   🟢 Whitelist ID: ${blob.attributes.whitelistId}\n`;
        }
        if (blob.attributes.capId) {
          response += `   🛡️ Cap ID: ${blob.attributes.capId}\n`;
        }
      }
      response += `   🗑️ Deletable: ${blob.deletable ? 'Yes' : 'No'}\n\n`;
    });

    return response;
  }

  private async handleReadFile(intent: any, userConfig: UserConfig): Promise<string> {
    const { blobId } = intent.parameters;
    
    if (!blobId) {
      return 'I need a blob ID to read the file. Please provide the blob ID of the file you want to retrieve.';
    }

    const result = await this.mcpClient.readFile({
      ...userConfig,
      blobId
    });

    return `✅ File retrieved successfully!\n\n${result}`;
  }

  private async handleGetAttributes(intent: any, userConfig: UserConfig): Promise<string> {
    const { objectId, blobObjectId } = intent.parameters;
    const targetId = objectId || blobObjectId;
    
    if (!targetId) {
      return 'I need an object ID to get file attributes. Please provide the object ID of the file.';
    }

    const attributes = await this.mcpClient.getBlobAttributes({
      ...userConfig,
      blobObjectId: targetId
    });

    if (Object.keys(attributes).length === 0) {
      return '📭 This file has no custom attributes set.';
    }

    let response = '🏷️ File Attributes:\n\n';
    Object.entries(attributes).forEach(([key, value]) => {
      response += `• **${key}**: ${value}\n`;
    });

    return response;
  }

  private async handleAddAttributes(intent: any, userConfig: UserConfig): Promise<string> {
    const { objectId, blobObjectId, attributes } = intent.parameters;
    const targetId = objectId || blobObjectId;
    
    if (!targetId || !attributes) {
      return 'I need both an object ID and attributes to add. Please specify the object ID and the attributes you want to add.';
    }

    await this.mcpClient.addBlobAttributes({
      ...userConfig,
      blobObjectId: targetId,
      attributes
    });

    return `✅ Attributes added successfully to file ${targetId.substring(0, 16)}...`;
  }

  private async handleBurnFiles(intent: any, userConfig: UserConfig): Promise<string> {
    const { blobObjectIds, all_expired = false, all = false } = intent.parameters;

    await this.mcpClient.burnBlobs({
      ...userConfig,
      blobObjectIds,
      all_expired,
      all
    });

    if (all) {
      return '🔥 All files have been deleted from your storage.';
    } else if (all_expired) {
      return '🔥 All expired files have been deleted from your storage.';
    } else {
      return `🔥 ${blobObjectIds?.length || 0} file(s) have been deleted from your storage.`;
    }
  }

  private async handleSendFile(intent: any, userConfig: UserConfig): Promise<string> {
    const { blobObjectId, destinationAddress } = intent.parameters;
    
    if (!blobObjectId || !destinationAddress) {
      return 'I need both a blob object ID and a destination address to transfer the file.';
    }

    await this.mcpClient.sendBlob({
      ...userConfig,
      blobObjectId,
      destinationAddress
    });

    return `✅ File transferred successfully to address ${destinationAddress.substring(0, 16)}...`;
  }

  private generateHelpResponse(query: string): string {
    return `🐋 **Walrus Storage Assistant**

I can help you manage your files on Walrus storage! Here's what I can do:

📁 **File Operations:**
• Store files with encryption and access control
• List all your stored files
• Retrieve and decrypt files
• Delete files or clean up expired ones

🏷️ **File Management:**
• Add custom attributes to files
• View file metadata and attributes
• Transfer files to other addresses

💬 **Natural Language:**
Just tell me what you want to do! Examples:
• "Store my document.pdf with 10 epochs"
• "Show me all my files"
• "Delete expired files"
• "Get the attributes of file 0x123..."

🔧 **Commands:**
You can also use direct commands like /list, /store, /config

Ask me anything about Walrus storage management!`;
  }

  private async generateContextualResponse(userMessage: string, conversationHistory: ConversationMessage[]): Promise<string> {
    const systemPrompt = `You are a helpful assistant for Walrus storage management. 

Walrus is a decentralized storage network that provides:
- Encrypted file storage with access control
- Blob storage with epochs (time-based expiration)
- Integration with Sui blockchain for capabilities
- Seal-based encryption for privacy

You can help users with:
- Storing files to Walrus storage
- Managing file attributes and metadata
- Retrieving stored files
- Understanding Walrus concepts

Be helpful, concise, and guide users toward specific actions they can take with the bot.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-8).map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: userMessage }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 800
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try asking me something specific about Walrus storage.';
  }
}