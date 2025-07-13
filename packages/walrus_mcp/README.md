# Walia Storage Engine - The Heart of Secure File Storage

This is the core technology that powers Walia's secure file storage system. While most users will interact with Walia through the [Telegram bot](../telegram-bot/README.md), this component handles all the behind-the-scenes work.

## What This Component Does

### For Users (The Simple Version)
When you store a file through Walia, this component:
- 🔐 **Encrypts your files** before they leave your device
- 💰 **Manages your storage wallet** and calculates costs
- 🌐 **Connects to the Walrus network** to store files securely
- 🔑 **Controls access** so only you (and people you choose) can read your files
- 📊 **Tracks your usage** and storage costs

### For Developers (The Technical Version)
This package provides:
- Wallet management with Ed25519 keypair generation
- Seal-based encryption and decryption with threshold cryptography  
- Walrus storage operations and cost estimation
- MCP (Model Context Protocol) server for external integrations
- Automatic configuration management and updates

## For Regular Users

**Most users don't need to install or use this component directly.** Instead:

1. **Use the Telegram bot**: Search for `@WaliaStorageBot` on Telegram
2. **Follow the setup guide**: See our [Setup Guide](../../SETUP_GUIDE.md)
3. **Let the system handle the technical details**: This component works automatically behind the scenes

## For Developers and Advanced Users

If you want to build your own applications using Walia's storage system or contribute to development:

### Installation
```bash
# Install the required dependencies
npm install
```

### Basic Usage Example
```typescript
// Import the Walia components
import { WalletManagement, SealManager, StorageManager } from "@walia/walrus_mcp";

// Create a user wallet (happens automatically for Telegram bot users)
const userWallet = new WalletManagement('alice');
await userWallet.ensureWallet();

// Store a file securely
const storageManager = new StorageManager(userWallet);
const result = await storageManager.storeFile('./my-document.pdf', {
  epochs: 5, // Store for 5 epochs
  encryptFile: true // Encrypt before storage
});

console.log('File stored with ID:', result.blobId);

// Retrieve the file later
const fileContent = await storageManager.readFile(result.blobId);
console.log('Retrieved file content');
```

### Understanding the Security System

Walia uses a multi-layered security approach:

1. **Your files are encrypted** on your device before being sent anywhere
2. **Access control lists** determine who can decrypt your files  
3. **Distributed key servers** ensure no single point of failure
4. **Blockchain verification** provides tamper-proof access records

### How the System Works Behind the Scenes

When you store a file through Walia:

1. **File gets encrypted** locally on your device using advanced encryption
2. **Access permissions are set** using blockchain-based smart contracts
3. **Encrypted file is stored** on the decentralized Walrus network
4. **You get a unique file ID** to retrieve your file anytime
5. **Only authorized users** can decrypt and access the original file

### Available Operations

For developers building on Walia, the system provides:

#### File Operations
```typescript
// Store a file with encryption
const result = await storageManager.storeFile('./document.pdf', {
  epochs: 10,        // Store for 10 epochs
  encrypted: true    // Encrypt before storage
});

// Retrieve a file by ID
const fileContent = await storageManager.readFile(result.blobId);

// List all stored files
const fileList = await storageManager.listFiles();

// Delete files
await storageManager.deleteFiles([fileId1, fileId2]);
```

#### Wallet Operations
```typescript
// Check storage balance
const balance = await wallet.getBalance();
console.log(`You have ${balance.sui} SUI tokens`);

// Get cost estimates
const estimator = new WalrusCostEstimator();
const cost = await estimator.estimateStorageCost(fileSize, storageEpochs);
console.log(`Storage will cost approximately ${cost} tokens`);
```

## Integration Server (MCP Server)

This component includes a server that allows other applications (like our Telegram bot) to securely connect to Walia's storage system. Think of it as a secure bridge that lets different apps work with your files.

### For Developers Building Integrations

If you want to connect your own application to Walia:

```bash
# Start the integration server
npm run mcp-server
```

The server provides secure access to:
- File storage and retrieval operations
- Wallet balance checking
- Cost estimation
- User management

### Built-in Security Features

The Walia storage engine includes several layers of security:

#### Advanced Encryption
- **Multi-server encryption**: Your encryption keys are split across multiple servers
- **Threshold security**: Multiple servers must cooperate to decrypt files
- **On-chain access control**: Blockchain technology manages who can access what

#### Privacy Protection
- **Local encryption**: Files are encrypted on your device before upload
- **Zero-knowledge storage**: The storage network never sees your unencrypted data
- **Decentralized architecture**: No single point of failure or control

#### Access Management
- **User-controlled permissions**: You decide who can access your files
- **Revocable access**: Remove someone's access anytime
- **Audit trails**: All access attempts are recorded on the blockchain

## Setting Up for Development

### Quick Development Setup

For developers who want to test Walia locally:

```bash
# Create a test wallet (this happens automatically for regular users)
npm run create-dev-wallet
```

This creates a secure test environment with:
- A unique wallet address for testing
- Free test tokens to try storing files
- All security features enabled
- Safe sandbox environment (no real money involved)

### What Gets Created

When you run the setup, Walia creates:
- **Secure wallet**: Your own private wallet for testing
- **Test tokens**: Free tokens to experiment with storage
- **Configuration files**: Everything needed to connect to the test network
- **Security keys**: Encrypted keys stored safely on your device

### Testing the Development Wallet

After creating a development wallet, you can test its functionality by writing integration tests that use the wallet configuration:

```typescript
// Sample integration test using the development wallet

// Import your development wallet configuration

test('should connect to the Walrus network', async () => {
  // Create a cost estimator using the dev wallet
  const estimator = new WalrusCostEstimator(DEV_CLIENT_CONFIG);
  await estimator.initialize();
  
  // Get system information
  const info = estimator.getWalrusInfo();
  expect(info).toBeDefined();
  expect(info?.epochInfo.currentEpoch).toBeGreaterThan(0);
});
```

### Cleaning Up Wallet Directories

After testing, you may want to clean up the test wallet directories. Use the following commands:

```bash
# List wallet directories that would be removed (dry run)
npm run clean-wallets:dry

# Remove test wallet directories
npm run clean-wallets

# Remove all wallet directories including development wallets
npm run clean-wallets:all
```

Note: The test suite automatically cleans up its wallet directories when tests complete successfully.

### Using Development Wallets in Tests

Import the development wallet configuration in your test files:

```typescript

describe('Integration tests with a real wallet', () => {
  let wallet: WalletManagement;
  
  beforeAll(() => {
    // Initialize wallet from the dev config
    wallet = new WalletManagement(
      DEV_WALLET.userName,
      DEV_WALLET.baseDir,
      DEV_WALLET.environment as any
    );
  });
  
  test('should check wallet balance', async () => {
    const balance = await wallet.getBalance();
    expect(Number(balance.sui)).toBeGreaterThanOrEqual(0);
  });
  
  // Additional tests using the wallet...
});
```

## Testing

The project includes comprehensive tests for the wallet management functionality:

```bash
# Run all wallet-related tests
npm run test:wallet

# Run wallet management tests
npx vitest run src/__tests__/wallet-management.test.ts

# Run advanced functionality tests
npx vitest run src/__tests__/wallet-advanced.test.ts

# Run class-based wallet tests
npm run test:wallet:class
```

## Directory Structure

The wallet management module creates the following directory structure for each user:

```
wallets/
└── {username}/
    ├── {sui_address}.key         # Key file generated by Sui keytool
    ├── keypair.json              # Stores wallet information including mnemonic
    ├── sui_client.yaml           # Sui client configuration
    └── walrus_client_config.yaml # Walrus client configuration
```

## License

ISC 