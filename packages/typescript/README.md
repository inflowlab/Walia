import { SealConfig, SealManager, WalletManagement } from "@walia/typescript";
import { SealConfig, SealManager, WalletManagement } from "@walia/typescript";

# Walia TypeScript Component

This package contains the TypeScript implementation of wallet management, storage, and utility functionality for the Walia project.

## Features

- Create a wallet environment for a user with:
  - Ed25519 keypair generation
  - Keystore management
  - Sui and Walrus configuration files
  - Passphrase storage
- Retrieve user environment configurations
- Retrieve passphrases for a user's wallet
- Get SUI and WAL token balances
- Build and serialize transactions for token transfers
- Automatically check and update Walrus configurations from the official source
- Updates all user wallets while preserving wallet-specific settings
- Single-user or all-users updating options
- Storage management for Walrus
- Cost estimation for Walrus storage
- **NEW**: Seal-based encryption and decryption with threshold cryptography

## Installation

```bash
# Install dependencies
npm install
```

## Usage

### Seal Manager - Encryption and Decryption

The SealManager class provides integration with [MystenLabs Seal](https://github.com/MystenLabs/seal) for decentralized secrets management, following the official Seal SDK pattern:

```typescript

// Create wallet management instance
const wallet = new WalletManagement('alice');

// Configure Seal with your whitelist contract and key servers
const sealConfig: SealConfig = {
  whitelistPackageId: '0x...', // Your deployed whitelist contract
  keyServerUrls: [
    'https://keyserver1.example.com',
    'https://keyserver2.example.com'
  ],
  threshold: 2, // Require 2 out of 2 key servers
  network: 'testnet'
};

// Create SealManager instance
const sealManager = new SealManager(wallet, sealConfig);

// Encrypt sensitive data (automatically creates whitelist and Cap objects)
const sensitiveData = "This is my secret message";

const encryptedData = await sealManager.encrypt(sensitiveData, {
  initialMembers: ['0x123...', '0x456...'] // Optional initial whitelist members
});

console.log('Encrypted data:', encryptedData);
console.log('Whitelist ID:', encryptedData.whitelistObjectId);
console.log('Cap ID:', encryptedData.capObjectId);

// Decrypt the data (only if you're in the whitelist)
const decryptedData = await sealManager.decrypt(encryptedData);
console.log('Decrypted data:', decryptedData.toString());

// Add more members to the whitelist (requires Cap ownership)
await sealManager.addMembersToWhitelistViaCLI(
  encryptedData.whitelistObjectId,
  encryptedData.capObjectId,
  ['0x789...']
);

// Create a WaliaObjCap for a Walrus blob
const waliaObjCapId = await sealManager.createWaliaObjCap(
  encryptedData.capObjectId,
  'walrus_blob_id'
);
```

#### Key Features of the Implementation

Following the MystenLabs Seal SDK pattern, the SealManager:

1. **Automatic Whitelist Creation**: Before encryption, it creates a whitelist object on-chain
2. **Cap Object Management**: The Cap object is automatically added to your wallet for whitelist administration
3. **Whitelist-Based Encryption**: Uses the whitelist address as the encryption ID
4. **CLI Integration**: Uses Sui CLI for reliable on-chain operations
5. **Threshold Decryption**: Supports configurable threshold key servers

#### Implementation Flow

```typescript
// 1. Create whitelist and receive Cap (happens automatically during encrypt)
const whitelistResult = await sealManager.createWhitelistWithCap(['0x123...']);

// 2. Whitelist address is used as encryption ID
const encryptionId = whitelistResult.whitelistId;

// 3. Symmetric key encryption with whitelist context
// 4. Threshold encryption of symmetric key
// 5. Store key association linked to whitelist

// For decryption:
// 1. Verify access through whitelist contract
// 2. Request key shares from threshold servers
// 3. Reconstruct symmetric key
// 4. Decrypt original data
```

### Function-based approach

```typescript
// Create a wallet environment for a user
const wallet = await createWalletEnvironment('alice');
console.log('Wallet address:', wallet.address);

// Get user environment
const env = getUserEnvironment('alice');
console.log('User environment:', env);

// Get pass phrases
const passPhrases = getPassPhrases('alice');
console.log('Pass phrases:', passPhrases);

// Get balances
const balance = await getBalance('alice');
console.log('Balances:', balance);

// Build and serialize transaction
const tx = await buildAndSerializeTransaction('alice', 'bob', '1000000', '0');
console.log('Transaction:', tx);
```

### Class-based approach (recommended)

```typescript
// Create a wallet management instance
const aliceWallet = new WalletManagement('alice');

// Ensure the wallet exists (creates it if not)
const walletInfo = await aliceWallet.ensureWallet();
console.log('Wallet address:', walletInfo.address);

// Get user environment
const env = aliceWallet.getUserEnvironment();
console.log('User environment:', env);

// Get pass phrases
const passPhrases = aliceWallet.getPassPhrases();
console.log('Pass phrases:', passPhrases);

// Get balances
const balance = await aliceWallet.getBalance();
console.log('Balances:', balance);

// Build and serialize transaction
const tx = await aliceWallet.buildAndSerializeTransaction('bob', '1000000', '0');
console.log('Transaction:', tx);

// Change environment
aliceWallet.setActiveEnvironment('mainnet');
console.log('New environment:', aliceWallet.getSuiActiveEnvironment());

// Update Walrus config from the official source (for a single user)
const updated = await aliceWallet.updateWalrusConfigFromSource();
console.log('Was config updated?', updated);

// Update Walrus config for all users
const result = await checkAndUpdateWalrusConfig();
console.log('Updated wallets:', result.wallets.length);
```

## Storage Management

```typescript

// Store a file
const result = await store('path/to/file', {
  clientConf,
  epochs: 10,
  attributes: {
    name: 'Example file',
    type: 'document',
  }
});

// Read a file by blob ID
const content = await read(result.blobId, { clientConf });

// List all blobs
const blobs = await list_blobs(clientConf);

// Burn specific blobs
await burnBlobs(clientConf, [blob1.id, blob2.id]);

// Estimate storage costs
const estimator = new WalrusCostEstimator(clientConf);
await estimator.initialize();
const cost = await estimator.estimateStorageCost(fileSize, epochs);
```

## Seal Integration Features

The SealManager integrates with the Walia whitelist contract to provide:

- **Threshold Encryption**: Uses multiple key servers for enhanced security
- **Access Control**: Leverages on-chain whitelists for fine-grained permissions
- **Walrus Integration**: Links encrypted data to Walrus blobs via WaliaObjCap
- **Decentralized Key Management**: No single point of failure for key storage

### Security Considerations

- Always use HTTPS endpoints for key servers
- Verify key server certificates in production
- Use appropriate threshold values (recommend at least 2-out-of-3)
- Store whitelist IDs securely
- Monitor access patterns for suspicious activity

## Development Wallets for Testing

The project provides tools to create and test development wallets for integration testing with real blockchain interactions. These wallets can be used in tests to verify storage, balance checks, and other blockchain operations.

### Creating a Development Wallet

Use the `demo.ts` script to create a development wallet:

```bash
# Create a wallet with default settings (username: walia, environment: testnet)
npm run create-dev-wallet

# Create a wallet with custom parameters
npm run create-dev-wallet -- --userName=myTestWallet --walletsDir=./dev-wallets --environment=testnet
```

Available parameters:
- `--userName`: The wallet username (default: walia)
- `--walletsDir`: Directory to store wallets (default: ./dev-wallets)
- `--environment`: Network environment (options: testnet, mainnet, devnet, localnet)

The script will create the wallet and display:
- Wallet address
- Current balance
- Recovery mnemonic (save this to fund the wallet)
- Instructions for using the wallet in tests

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