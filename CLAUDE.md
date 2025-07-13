# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

### Build and Test
```bash
# Build TypeScript component
npm run build

# Build Move contracts
npm run build:move

# Run TypeScript tests
npm test

# Run Move tests
npm run test:move

# Run specific test categories
npm run test:wallet           # Basic wallet tests
npm run test:wallet:class     # Wallet class tests

# Run tests with Walrus integration
RUN_WALRUS_INTEGRATION_TESTS=true npm test

# Development server
npm run dev
```

### Wallet Management
```bash
# Create development wallet
npm run create-dev-wallet

# Clean wallet data
npm run clean-wallets          # Standard cleanup
npm run clean-wallets:dry     # Dry run
npm run clean-wallets:all     # Include dev wallets
```

### MCP Server
```bash
# Start MCP server for storage operations
npm run mcp-server

# Build and run MCP server
npm run mcp-server:build
```

### CLI Interface
```bash
# Run CLI with direct execution
npm run cli <command> '<json-params>'

# Build and run CLI
npm run cli:build <command> '<json-params>'

# Store a file
npm run cli store '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./test.txt","epochs":5}'

# Read a file
npm run cli read '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobId":"abc123"}'

# List blobs
npm run cli list-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet"}'
```

### Move Contract Development
```bash
# Navigate to Move contracts
cd packages/move/walia_seal

# Build Move package
sui move build

# Test Move package
sui move test

# Deploy to testnet
sui client publish --gas-budget 100000000
```

## Architecture Overview

### Repository Structure
This is a monorepo containing:
- **Walrus MCP Package** (`packages/walrus_mcp/`): Wallet management, Walrus storage, and seal encryption
- **Move Package** (`packages/move/walia_seal/`): Smart contracts for whitelist-based access control

### Key Components

#### TypeScript Components
- **`WalletManagement`**: Core wallet operations for Sui and Walrus
- **`SealManager`**: Encryption/decryption using MystenLabs seal pattern
- **`StorageManager`**: Walrus blob storage with capability-based access
- **`WalrusCostEstimator`**: Cost estimation utilities for Walrus storage
- **`WaliaStorageMCPServer`**: MCP server exposing storage operations via Model Context Protocol
- **`WaliaCLI`**: Command-line interface for storage operations with JSON parameters

#### Move Components
- **`whitelist.move`**: Implements whitelist pattern for key-based access control
- **`Whitelist`**: Core whitelist object with address-based permissions
- **`Cap`**: Administrative capability for whitelist management
- **`WaliaObjCap`**: Links Walrus blob IDs to whitelist capabilities

### Core Patterns

#### Seal-Based Access Control
The project uses MystenLabs seal pattern for encryption:
1. Create whitelist with unique key-id
2. Encrypt data to that key-id
3. Whitelisted addresses can decrypt by requesting the key

#### Wallet Environment Management
Each user has a dedicated wallet environment in `dev-wallets/`:
- `sui_client.yaml`: Sui client configuration
- `walrus_client_config.yaml`: Walrus client configuration
- `sui.keystore`: Private key storage
- `data/`: Walrus blob storage

## Development Workflow

### Setting Up New Features
1. Check if wallet environment exists, create if needed
2. For storage features, ensure Walrus connectivity
3. For seal features, verify whitelist contract deployment
4. Write tests in `src/__tests__/` following existing patterns

### Testing Strategy
Tests are organized by complexity:
1. **Unit Tests**: Basic wallet operations (no external dependencies)
2. **Integration Tests**: Require Sui testnet connectivity
3. **Walrus Integration**: Require both Sui and Walrus (enabled via `RUN_WALRUS_INTEGRATION_TESTS=true`)

### Contract Deployment
Move contracts must be deployed to testnet before integration tests:
```bash
cd packages/move/walia_seal
sui client switch --env testnet
sui client publish --gas-budget 100000000
# Update package ID in Walrus MCP code
```

## Important Configuration

### Environment Variables
- `RUN_WALRUS_INTEGRATION_TESTS=true`: Enable Walrus integration tests
- `WALLETS_DIR`: Custom wallet directory path
- `TEST_USER`: Specific user for tests (default: "walia")

### Network Dependencies
- **Sui Testnet**: https://fullnode.testnet.sui.io:443
- **Walrus Testnet**: Requires Walrus CLI and network access
- **Gas Requirements**: Testnet SUI tokens needed for transactions

### Test Timeouts
- Default test timeout: 60 seconds
- Seal tests may need higher timeout due to network latency
- Use `--timeout=120000` for problematic tests

## Common Issues

### Wallet Configuration
- Ensure absolute paths in `sui_client.yaml` keystore configuration
- Verify wallet has sufficient SUI balance via `sui client balance`
- Check `sui.keystore` format matches Sui CLI expectations

### Contract Deployment
- "Object does not exist" errors indicate stale package ID
- Redeploy contract and update package ID in TypeScript code
- Gas budget of 100000000 is typically sufficient

### Test Execution
- Seal tests may fail due to object lock concurrency issues
- Run seal tests individually if needed
- Walrus tests are skipped by default unless integration flag is set

## Dependencies

### External Tools Required
- Node.js (v18+)
- Sui CLI (testnet branch)
- Walrus CLI
- TypeScript compiler

### Key NPM Packages
- `@mysten/sui`: Sui SDK for blockchain interactions
- `@mysten/seal`: Seal encryption/decryption library
- `@modelcontextprotocol/sdk`: MCP SDK for server implementation
- `vitest`: Test framework with 60s timeout
- `axios`: HTTP client for Walrus API calls

## File Patterns

### TypeScript Files
- Main logic in `src/` directory
- Tests in `src/__tests__/` with `.test.ts` extension
- Helper utilities for development and testing
- Configuration files use absolute paths

### Move Files
- Source files in `sources/` directory
- `Move.toml` defines package metadata and dependencies
- Uses Sui framework from testnet branch
- Package address `walia_seal = "0x0"`