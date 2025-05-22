# Walia Move Component

This package contains the Move smart contracts for the Walia project.

## Overview

The Walia Move component implements the following key features:

- WaliaToken: A custom token for the Walia ecosystem
- Token management functionality
- Balance tracking and storage

## Contract Structure

### Token Module

The token module (`token.move`) implements a custom token for the Walia project:

```move
module walia_move::token {
    // WaliaToken implementation
    // ...
}
```

## Building and Testing

### Prerequisites

- [Sui CLI](https://docs.sui.io/build/install)
- [Move Programming Language](https://github.com/move-language/move)

### Building

```bash
# Build the Move package
sui move build
```

### Testing

```bash
# Run all tests
sui move test

# Run a specific test
sui move test token_tests
```

## Deployment

To deploy the contracts to a Sui network:

```bash
# Deploy to devnet
sui client publish --gas-budget 10000000

# Deploy to testnet (make sure you're connected to testnet)
sui client switch --env testnet
sui client publish --gas-budget 10000000
```

## Interacting with the Contracts

After deployment, you can interact with the contracts using the Sui CLI:

```bash
# Create a new WaliaToken
sui client call --package $PACKAGE_ID --module token --function create_token \
  --args "$NAME" "$SYMBOL" "$DESCRIPTION" "$COIN_OBJECT_ID" \
  --gas-budget 10000000
```

## License

ISC 