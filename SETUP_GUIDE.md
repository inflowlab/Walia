# Walia Project - Complete Setup Guide

This comprehensive guide covers the complete setup and deployment process for the Walia project, including project installation, wallet configuration, Move contract deployment, and test execution.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Dev Wallet Setup](#dev-wallet-setup)
5. [Walia Seal Contract Deployment](#walia-seal-contract-deployment)
6. [Test Execution Order](#test-execution-order)
7. [Integration Test Configuration](#integration-test-configuration)
8. [Common Issues and Solutions](#common-issues-and-solutions)

## Project Overview

The Walia project is a monorepo containing:

```
walia/
├── packages/
│   ├── typescript/              # TypeScript wallet and storage management
│   │   ├── src/                # Source code
│   │   ├── __tests__/          # Test files
│   │   ├── dev-wallets/        # Development wallet configurations
│   │   │   └── walia/          # Default wallet setup
│   │   └── package.json        # TypeScript package configuration
│   └── move/                   # Move smart contracts
│       └── walia_seal/         # Seal-based whitelist contracts
├── package.json                # Root package configuration
└── README.md
```

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version
   npm --version
   ```

2. **Sui CLI** (latest version)
   ```bash
   # Install Sui CLI
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
   
   # Verify installation
   sui --version
   ```

3. **Walrus CLI** (latest version)
   ```bash
   # Install Walrus CLI (follow official documentation)
   # Verify installation
   walrus --version
   ```

### Network Access

- **Sui Testnet**: Access to https://fullnode.testnet.sui.io:443
- **Walrus Testnet**: Access to Walrus storage nodes
- **SUI Tokens**: Testnet SUI tokens for gas fees

## Project Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/walia.git
cd walia

# Install all dependencies
npm install

# Install TypeScript-specific dependencies
npm install --workspace=packages/typescript
```

### 2. Verify Installation

```bash
# Check if builds work
npm run build

# Verify TypeScript builds
cd packages/typescript
npm run build
```

## Dev Wallet Setup

### Automatic Wallet Creation

The project includes scripts to create development wallets automatically:

```bash
# Create a development wallet (from project root)
npm run create-dev-wallet

# Or create with specific parameters
cd packages/typescript
npm run create-dev-wallet -- --userName=walia --walletsDir=./dev-wallets --environment=testnet
```

### Manual Wallet Setup

If you need to set up wallets manually:

#### 1. Create Wallet Directory Structure

```bash
# From packages/typescript directory
mkdir -p dev-wallets/walia
cd dev-wallets/walia
```

#### 2. Generate Sui Keypair

```bash
# Generate a new keypair
sui keytool generate ed25519

# This creates entries in your default Sui configuration
# Copy the generated address for the next steps
```

#### 3. Create Sui Client Configuration

Create `sui_client.yaml`:

```yaml
keystore:
  File: /absolute/path/to/walia/packages/typescript/dev-wallets/walia/sui.keystore
envs:
  - alias: testnet
    rpc: https://fullnode.testnet.sui.io:443
    ws: ~
    basic_auth: ~
  - alias: localnet
    rpc: http://127.0.0.1:9000
    ws: ~
    basic_auth: ~
  - alias: mainnet
    rpc: https://fullnode.mainnet.sui.io:443
    ws: ~
    basic_auth: ~
  - alias: devnet
    rpc: https://fullnode.devnet.sui.io:443
    ws: ~
    basic_auth: ~
active_env: testnet
active_address: 'YOUR_GENERATED_ADDRESS_HERE'
```

#### 4. Create Keystore File

Create `sui.keystore` with your keypair:

```json
[
  "YOUR_PRIVATE_KEY_IN_SUI_FORMAT"
]
```

#### 5. Create Walrus Client Configuration

Create `walrus_client_config.yaml`:

```yaml
contexts:
  testnet:
    system_object: "0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af"
    staking_object: "0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3"
    subsidies_object: "0xda799d85db0429765c8291c594d334349ef5bc09220e79ad397b30106161a0af"
    exchange_objects:
      - "0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073"
      - "0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862"
      - "0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5"
      - "0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1"
    wallet_config:
      path: "/absolute/path/to/walia/packages/typescript/dev-wallets/walia/sui_client.yaml"
      active_env: testnet
      active_address: "YOUR_ADDRESS_HERE"
    rpc_urls:
      - https://fullnode.testnet.sui.io:443
default_context: testnet
```

#### 6. Fund Your Wallet

```bash
# Get testnet SUI tokens
sui client faucet

# Verify balance
sui client balance
```

### Wallet Directory Structure

After setup, your wallet directory should look like:

```
dev-wallets/walia/
├── data/                    # Walrus data storage
├── sui_client.yaml         # Sui client configuration
├── walrus_client_config.yaml # Walrus client configuration
├── keypair.json            # Keypair information
├── sui.aliases             # Sui aliases
└── sui.keystore           # Private key storage
```

## Walia Seal Contract Deployment

### 1. Build the Contract

```bash
# Navigate to the Move contract directory
cd packages/move/walia_seal

# Build the contract
sui move build
```

### 2. Deploy to Testnet

```bash
# Make sure you're connected to testnet
sui client switch --env testnet

# Deploy the contract
sui client publish --gas-budget 100000000

# Save the package ID from the output for later use
# Example output:
# Package published at: 0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507
```

### 3. Verify Deployment

```bash
# Verify the package exists
sui client object YOUR_PACKAGE_ID

# Check your gas balance after deployment
sui client balance
```

### 4. Update TypeScript Configuration

After deployment, update your TypeScript code with the new package ID:

```typescript
// In your test or application code
const WALIA_SEAL_PACKAGE_ID = "0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507";
```

## Test Execution Order

### Understanding Test Categories

The project has several test categories with different requirements:

1. **Unit Tests** - No external dependencies
2. **Integration Tests** - Require Sui testnet connectivity
3. **Walrus Integration Tests** - Require both Sui and Walrus connectivity

### Recommended Test Order

#### 1. Unit Tests First

```bash
# Run wallet management tests (basic functionality)
npm run test:wallet
```

Expected output:
```
✅ Wallet Management Tests (14/14 passing)
✅ Wallet Advanced Tests (7/7 passing)
```

#### 2. Wallet Class Tests

```bash
# Run wallet class tests
npm run test:wallet:class
```

Expected output:
```
✅ Wallet Class Tests (16/16 passing)
```

#### 3. Basic Integration Tests

```bash
# Run integration tests without Walrus
npm test
```

Expected output:
```
✅ 38+ tests passing
❌ 0-5 tests failing (seal tests may fail if not configured)
⏭️ ~15 tests skipped (Walrus tests)
```

#### 4. Full Integration Tests with Walrus

```bash
# Run all tests including Walrus integration
RUN_WALRUS_INTEGRATION_TESTS=true npm test
```

Expected output:
```
✅ 40+ tests passing
❌ 0-4 tests failing (only seal concurrency issues)
⏭️ ~1 test skipped
```

### Specific Test Commands

```bash
# Run specific test files
npx vitest run src/__tests__/wallet-management.test.ts
npx vitest run src/__tests__/storage.test.ts
npx vitest run src/__tests__/seal.test.ts

# Run tests with verbose output
npm test -- --reporter=verbose

# Run tests in watch mode for development
npm run test:watch
```

### Test Environment Variables

Important environment variables for testing:

```bash
# Enable Walrus integration tests
export RUN_WALRUS_INTEGRATION_TESTS=true

# Set custom wallet directory (optional)
export WALLETS_DIR=/path/to/custom/wallets

# Set specific user for tests (optional)
export TEST_USER=walia
```

## Integration Test Configuration

### Required Configuration for Full Integration Tests

1. **Funded Wallet**: Your test wallet needs sufficient SUI tokens
2. **Walrus Access**: Network connectivity to Walrus storage nodes
3. **Deployed Contract**: Walia Seal contract deployed on testnet

### Environment Setup for CI/CD

```bash
# .env file for CI/CD
RUN_WALRUS_INTEGRATION_TESTS=true
WALIA_SEAL_PACKAGE_ID=0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507
SUI_NETWORK=testnet
WALLETS_DIR=./dev-wallets
```

### Test File Descriptions

1. **`wallet-management.test.ts`** - Core wallet operations
2. **`wallet-advanced.test.ts`** - Advanced wallet features
3. **`wallet-class.test.ts`** - Wallet class functionality
4. **`storage.test.ts`** - Walrus storage integration
5. **`seal.test.ts`** - Seal encryption/decryption
6. **`walrus-cost-estimator.test.ts`** - Cost estimation utilities

## Common Issues and Solutions

### 1. SUI CLI Issues

**Problem**: `sui keytool` command not found
```bash
# Solution: Reinstall Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

**Problem**: Invalid keystore path
```bash
# Solution: Use absolute paths in configuration files
# Update sui_client.yaml with full absolute paths
```

### 2. Wallet Configuration Issues

**Problem**: Tests failing with "Wallet not found"
```bash
# Solution: Verify wallet directory structure
ls -la dev-wallets/walia/
# Should contain: sui_client.yaml, walrus_client_config.yaml, sui.keystore
```

**Problem**: Insufficient gas
```bash
# Solution: Fund your wallet
sui client faucet
sui client balance
```

### 3. Contract Deployment Issues

**Problem**: "Object does not exist" during contract interaction
```bash
# Solution: Redeploy contract and update package ID
cd packages/move/walia_seal
sui client publish --gas-budget 100000000
```

### 4. Test Execution Issues

**Problem**: Tests timeout or fail intermittently
```bash
# Solution: Run tests sequentially
npm test -- --reporter=verbose --timeout=120000
```

**Problem**: Seal tests failing with TypeMismatch
```bash
# Solution: This is a known concurrency issue
# Tests are functionally correct but may fail due to object locks
# Run individual seal tests:
npx vitest run src/__tests__/seal.test.ts --timeout=120000
```

### 5. Walrus Integration Issues

**Problem**: Walrus tests skipped
```bash
# Solution: Enable integration tests
export RUN_WALRUS_INTEGRATION_TESTS=true
npm test
```

**Problem**: Walrus CLI not found
```bash
# Solution: Install Walrus CLI and ensure it's in PATH
which walrus
# If not found, install following official Walrus documentation
```

## Development Workflow

### For New Developers

1. **Setup Environment**:
   ```bash
   git clone <repo>
   npm install
   npm run create-dev-wallet
   ```

2. **Get Test Funds**:
   ```bash
   sui client faucet
   ```

3. **Deploy Contracts**:
   ```bash
   cd packages/move/walia_seal
   sui client publish --gas-budget 100000000
   ```

4. **Run Tests Incrementally**:
   ```bash
   npm run test:wallet      # Start with unit tests
   npm test                 # Basic integration
   RUN_WALRUS_INTEGRATION_TESTS=true npm test  # Full integration
   ```

### For Continuous Integration

```yaml
# Example GitHub Actions workflow
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm run test:wallet
      - run: npm test
      # Walrus tests might be disabled in CI due to network requirements
```

This completes the comprehensive setup guide for the Walia project. Follow these steps in order for the best experience setting up and running the project. 