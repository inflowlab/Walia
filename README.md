import DEV_WALLET, { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";
import { WalletManagement } from "../wallet-management";

```typescript
import { 
  buildAndSerializeTransaction, 
  createWalletEnvironment, 
  getBalance, 
  getPassPhrases, 
  getUserEnvironment 
} from "./dist/wallet-management";
```

# Wallet Management Module for Sui and Walrus

A TypeScript module for managing Sui and Walrus wallet environments.

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

## Installation

```bash
# Install dependencies
npm install

# Build only the wallet management module
npm run build:wallet
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

## Running the Demo

```bash
# Build the wallet demo files
npm run build:wallet

# Run the demo
node dist/demo.js
```

## Development Wallets for Testing

The project provides tools to create and test development wallets for integration testing with real blockchain interactions. These wallets can be used in your tests to verify storage, balance checks, and other blockchain operations.

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

After creating a development wallet, you can test its functionality:

```bash
# Test the wallet with default settings
npm run test-dev-wallet

# Test a wallet with custom parameters
npm run test-dev-wallet -- --userName=myTestWallet --walletsDir=./dev-wallets --environment=testnet
```

The test script will:
1. Verify the wallet exists and check its balance
2. Fetch Walrus system information
3. List existing storage blobs
4. Create and store a test file if the wallet has sufficient SUI balance
5. Read back the stored file to verify storage works correctly

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

## Dependencies

This project uses:
- [@mysten/sui](https://github.com/MystenLabs/sui) - Sui blockchain SDK
- [js-yaml](https://github.com/nodeca/js-yaml) - YAML parsing/generation

## References

- [MystenLabs/sui](https://github.com/MystenLabs/sui)
- [MystenLabs/ts-sdks](https://github.com/MystenLabs/ts-sdks)
- [MystenLabs/walrus](https://github.com/MystenLabs/walrus)

### Update SUI CLI:
```bash
brew upgrade sui
```

### Start Walrus daemon:
```bash
PUBLISHER_WALLETS_DIR=~/.config/walrus/publisher-wallets
mkdir -p "$PUBLISHER_WALLETS_DIR"
walrus daemon \
  --config ./walrus_client_config.yaml \
  --bind-address "127.0.0.1:31415" \
  --sub-wallets-dir "$PUBLISHER_WALLETS_DIR" \
  --n-clients 1
```

to run a specific unit test:
```bash
npx vitest -t "should get detailed blob information"
```