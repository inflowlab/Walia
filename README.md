# Walia Project

A monorepo containing both TypeScript and Move components for the Walia project.

## Repository Structure

This monorepo is organized as follows:

```
walia/
├── packages/
│   ├── typescript/  # TypeScript component for wallet management and storage
│   └── move/        # Move smart contracts
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
- Token and asset management

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
- Token creation and management
- Balance tracking and management

## License

ISC