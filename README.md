# Walia Project

A monorepo containing both TypeScript and Move components for the Walia project.

## Repository Structure

This monorepo is organized as follows:

```
walia/
├── packages/
│   ├── typescript/  # TypeScript component for wallet management and storage
│   └── move/        # Move smart contracts
│       └── walia_seal/  # Seal-based whitelist and capability contracts
└── README.md
```

## Components

### TypeScript Component

The TypeScript component provides:

- Wallet management for Sui and Walrus
- Storage management for Walrus
- Cost estimation utilities for Walrus storage
- Helper utilities for development and testing

### Move Component

The Move component provides:

- Smart contracts for the Walia project
- WaliaToken implementation
- Whitelist capabilities for access control
- WaliaObjCap for capability-based blob access in Walrus
- Key-based ownership and access management

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/walia.git
cd walia

# Install dependencies for all packages
npm install
```

## Development

### TypeScript Component

```bash
# Run TypeScript tests
npm test

# Build TypeScript component
npm run build

# Run TypeScript development server
npm run dev
```

### Move Component

```bash
# Run Move tests
npm run test:move

# Build Move package
cd packages/move/walia_move
sui move build
```

## Wallet Management

See the [TypeScript package README](./packages/typescript/README.md) for detailed documentation on wallet management features.

## Smart Contracts

The Move smart contracts implement the following functionality:

- WaliaToken: A custom token for the Walia project
- Whitelist: Access control mechanism based on MystenLabs/seal
- WaliaObjCap: A capability that links to Walrus blobs with key-based access control
- Token creation and management
- Balance tracking and management

## License

ISC