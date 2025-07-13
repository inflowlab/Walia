# Walia Telegram Bot

A Telegram bot that serves as a Walrus storage assistant/manager, using grammY library and OpenAI API to provide natural language interaction with Walrus storage operations via MCP (Model Context Protocol).

## Features

- 🤖 **Natural Language Interface**: Chat naturally with the bot to manage your Walrus storage
- 📁 **File Operations**: Store, retrieve, list, and manage files on Walrus storage
- 🏷️ **Attribute Management**: Add and view custom attributes for your stored files
- 🔐 **Secure Storage**: Uses seal-based encryption with whitelist access control
- 💬 **Conversation Memory**: Maintains context across the conversation
- ⚙️ **Configurable**: Per-user configuration for wallet settings

## Architecture

```
Telegram User → grammY Bot → OpenAI API → MCP Client → MCP Server → Walrus Storage
```

- **grammY**: Telegram bot framework for handling messages and commands
- **OpenAI API**: Analyzes user intent and generates natural language responses
- **MCP Client**: Connects to the Walia MCP server using stdio protocol
- **MCP Server**: Provides Walrus storage operations as MCP tools

## Prerequisites

1. **Telegram Bot Token**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Create a new bot with `/newbot`
   - Get your bot token

2. **OpenAI API Key**:
   - Sign up at [OpenAI](https://platform.openai.com/)
   - Create an API key in your dashboard

3. **Walia MCP Server**:
   - Ensure the TypeScript package is built and MCP server is functional
   - Have a configured wallet environment in `dev-wallets/`

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your tokens
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file with:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
NODE_ENV=development
WALIA_WALLETS_DIR=./dev-wallets
```

### Bot Configuration

Bot configuration is fully automatic:

- **Username**: Automatically set to `user_${telegram_user_id}` based on your Telegram user ID
- **Wallets Directory**: Set via `WALIA_WALLETS_DIR` environment variable (defaults to `./dev-wallets`)
- **Environment**: Fixed to `testnet` for security

Users can view their current settings with:

```
/config
```

No manual configuration is needed or allowed - everything is automatically configured for security and isolation.

## Usage

### Starting the Bot

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Bot Commands

#### Basic Commands
- `/start` - Welcome message and overview
- `/help` - Show all available commands
- `/status` - Show current configuration
- `/config` - Configure wallet settings
- `/address` - Get your wallet address
- `/balance` - Check your wallet balance

#### File Operations
- `/list` - List all stored files
- `/read <blob_id>` - Read a file by blob ID
- `/attributes <object_id>` - View file attributes

#### Natural Language Examples

Users can interact naturally:
- "Store my document.pdf with 10 epochs"
- "List all my files"
- "What files do I have stored?"
- "Show me the attributes of file 0x123..."
- "Delete all expired files"
- "What's my wallet address?"
- "Check my balance"
- "How much SUI do I have?"
- "How does Walrus storage work?"

## Bot Features

### Command System
- **Configuration Management**: Users can set their wallet parameters
- **File Listing**: Browse stored files with metadata
- **File Reading**: Retrieve and decrypt stored files
- **Attribute Management**: View and manage file attributes

### AI Assistant
- **Intent Analysis**: Uses OpenAI to understand user requests
- **Natural Responses**: Generates helpful, contextual responses
- **Action Execution**: Maps user intents to MCP operations
- **Conversation Context**: Maintains conversation history

### MCP Integration
- **Secure Communication**: Connects to MCP server via stdio
- **Type Safety**: Strongly typed interfaces for all operations
- **Error Handling**: Graceful error handling and user feedback
- **Resource Management**: Proper connection lifecycle management

## Development

### Project Structure

```
src/
├── index.ts          # Main entry point
├── bot.ts            # Telegram bot implementation
├── assistant.ts      # OpenAI integration and intent processing
└── mcp-client.ts     # MCP client for Walrus operations
```

### Adding New Features

1. **New Bot Commands**: Add to `setupCommands()` in `bot.ts`
2. **New MCP Operations**: Add methods to `WaliaMCPClient`
3. **New AI Intents**: Update intent analysis in `assistant.ts`

### Testing

```bash
# Test MCP client connection
npm run test-mcp

# Test bot locally with webhook
npm run dev
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["npm", "start"]
```

### Environment Setup

Ensure your deployment environment has:
- Access to the Walia MCP server
- Proper wallet configuration
- Network access to Telegram API and OpenAI API

## Security Considerations

1. **API Keys**: Store securely, never commit to version control
2. **User Data**: Conversation history is stored in memory only
3. **Wallet Access**: Each user's wallet configuration is isolated
4. **MCP Communication**: Uses secure stdio protocol locally

## Troubleshooting

### Common Issues

1. **"Failed to connect to MCP server"**:
   - Check if Walrus MCP package MCP server is running
   - Verify the relative path to `../walrus_mcp`

2. **"Bot token invalid"**:
   - Verify your Telegram bot token
   - Check for extra spaces in `.env` file

3. **"OpenAI API error"**:
   - Verify your OpenAI API key
   - Check your API usage limits

4. **"Wallet configuration not found"**:
   - Ensure wallet is properly set up in TypeScript package
   - Check wallet directory path configuration

### Debug Mode

Enable verbose logging:

```bash
NODE_ENV=development npm run dev
```

## API Reference

### MCP Client Methods

- `storeFile(params)` - Store a file to Walrus
- `readFile(params)` - Read a file by blob ID
- `listBlobs(params)` - List stored files
- `getBlobAttributes(params)` - Get file attributes
- `addBlobAttributes(params)` - Add file attributes
- `burnBlobs(params)` - Delete files
- `sendBlob(params)` - Transfer file to another address
- `getBlobObjectId(params)` - Get object ID from blob ID

### Bot Session Data

```typescript
interface SessionData {
  userName: string;
  walletsDir: string;
  environment: string;
  conversationHistory: ConversationMessage[];
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the Walia storage system and follows the same license terms.