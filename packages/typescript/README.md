import DEV_WALLET, { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";
import DEV_WALLET, { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";
import { burnBlobs, list_blobs, read, store } from "./storage";
import { ClientConfig } from "./wallet-management";
import { WalrusCostEstimator } from "./walrus-cost-estimator";
import { WalrusCostEstimator } from "./walrus-cost-estimator";

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

## Installation

```bash
# Install dependencies
npm install
```

## Usage

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