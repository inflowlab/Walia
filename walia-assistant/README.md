import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";

# 🐋 Walia Assistant

An AI-powered assistant specialized in decentralized storage, encryption, and blockchain technology, built on the Eliza framework and integrated with Walia's TypeScript modules.

## 🌟 Features

- **🔐 Decentralized Storage**: Secure file storage using Walrus storage system
- **🛡️ Advanced Encryption**: Seal encryption with whitelist-based access control
- **⚡ Sui Blockchain Integration**: Complete wallet management and transaction handling
- **🤖 Intelligent Assistant**: Natural language interface for complex operations
- **🔑 Wallet Management**: Create, manage, and monitor Sui wallets
- **📁 File Operations**: Encrypt, store, retrieve, and share files securely

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ 
- Sui CLI installed and configured
- Walrus CLI installed and configured

### Installation

1. **Navigate to the assistant directory:**
   ```bash
   cd walia-assistant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start the assistant:**
   ```bash
   npm start
   ```

The assistant will start on `http://localhost:3000`

## 🎯 What Can Walia Do?

### 💼 Wallet Operations
- **Create Wallet**: "Create a new wallet for me"
- **Check Balance**: "What's my wallet balance?"
- **Wallet Setup**: Automatic Sui and Walrus configuration

### 📁 File Storage & Encryption
- **Secure Storage**: "Store my file securely"
- **File Encryption**: "Encrypt my file with access control"
- **File Retrieval**: "Retrieve file with blob ID [blob-id]"
- **Access Management**: "Add address 0x... to my whitelist"

### 🔐 Advanced Features
- **Whitelist Management**: Control who can access your encrypted files
- **Seal Encryption**: Advanced encryption with blockchain-based access control
- **Decentralized Storage**: Files stored across the Walrus network
- **Smart Contracts**: Automated access control via Sui smart contracts

## 🏗️ Architecture

### Core Components

```
walia-assistant/
├── src/
│   ├── character.ts          # Walia's personality and knowledge
│   ├── index.ts             # Main application entry point
│   └── plugins/
│       ├── index.ts         # Plugin aggregation
│       └── actions/         # Available actions
│           ├── walrus-storage.ts    # File storage operations
│           ├── encrypt-file.ts      # Encryption operations
│           ├── create-wallet.ts     # Wallet creation
│           ├── wallet-balance.ts    # Balance checking
│           └── manage-whitelist.ts  # Access control
├── data/                    # Runtime data storage
└── wallets/                # User wallet storage
```

### Integration with Walia Modules

The assistant integrates directly with Walia's TypeScript modules:

- **`@walia/wallet-management`**: Sui wallet operations
- **`@walia/seal`**: Encryption and smart contract interactions  
- **`@walia/storage`**: Walrus storage operations

## 🔧 Development

### Running in Development Mode

```bash
npm run dev
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm start` - Start the production server
- `npm run dev` - Start in development mode with hot reload
- `npm run clean` - Clean build artifacts and dependencies

### Adding New Actions

1. Create a new action file in `src/plugins/actions/`
2. Import and add it to the plugin in `src/plugins/index.ts`
3. The action will automatically be available to users

Example action structure:
```typescript

export const myAction: Action = {
    name: "my-action",
    similes: ["trigger words", "alternative phrases"],
    description: "What this action does",
    examples: [/* conversation examples */],
    handler: async (runtime, message, state, options, callback) => {
        // Action implementation
    }
};
```

## 🌐 API Integration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional
SERVER_PORT=3000
TELEGRAM_BOT_TOKEN=your_telegram_token
SUI_NETWORK=testnet
```

### Supported AI Providers

- **OpenAI** (GPT models)
- **Anthropic** (Claude models)
- **Local models** (via compatible APIs)

## 🛡️ Security & Privacy

- **Private Keys**: Securely managed in local wallet files
- **Encryption**: All files encrypted before storage
- **Access Control**: Blockchain-based whitelist management
- **Decentralized**: No central authority controls your data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📚 Documentation

- **Eliza Framework**: [ElizaOS Documentation](https://elizaos.github.io/eliza/)
- **Sui Blockchain**: [Sui Documentation](https://docs.sui.io/)
- **Walrus Storage**: [Walrus Documentation](https://docs.walrus.space/)

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**: Change `SERVER_PORT` in `.env`
2. **Missing API Keys**: Ensure all required keys are set in `.env`
3. **Wallet Issues**: Check Sui CLI configuration
4. **Storage Errors**: Verify Walrus CLI setup

### Getting Help

- Check the logs for detailed error messages
- Ensure all dependencies are properly installed
- Verify environment configuration

## 📄 License

This project is part of the Walia ecosystem. See LICENSE for details.

---

**Ready to explore decentralized storage with AI assistance? Start chatting with Walia! 🚀** 