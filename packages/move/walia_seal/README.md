# Walia Seal Component

This package contains the Move smart contracts for the Walia project with seal capabilities.

## Overview

The Walia Seal component implements the following key features:

- Whitelist: Access control for Walrus blobs based on MystenLabs/seal
- WaliaObjCap: Capability-based access control for Walrus blobs
- Integration with Walrus blob storage

## Contract Structure

### Whitelist Module

The whitelist module (`whitelist.move`) implements:

- A seal-based whitelist for controlling access to resources
- WaliaObjCap struct that links capabilities to Walrus blobs
- Functions to create, transfer, and manage capabilities

## Usage Examples

### Creating a Whitelist with a Capability

```move
// Create a whitelist with an admin capability
let (cap, whitelist) = walia_seal::whitelist::create_whitelist(ctx);

// Or use the entry function to create and transfer/share automatically
walia_seal::whitelist::create_whitelist_entry(ctx);
```

### Creating a WaliaObjCap for a Walrus Blob

```move
// Create a WaliaObjCap that links a capability to a Walrus blob
let walia_obj_cap = walia_seal::whitelist::create_walia_obj_cap(cap, blob_id, ctx);

// Or use the entry function to create and transfer automatically
walia_seal::whitelist::create_walia_obj_cap_and_transfer(cap, blob_id, ctx);
```

### Managing Whitelist Access

```move
// Add an address to the whitelist
walia_seal::whitelist::add(whitelist, &cap, address);

// Remove an address from the whitelist
walia_seal::whitelist::remove(whitelist, &cap, address);
```

### Transferring a WaliaObjCap

```move
// Transfer a WaliaObjCap to another address
walia_seal::whitelist::transfer_walia_obj_cap(walia_obj_cap, recipient, ctx);
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
sui move test walia_obj_cap_tests
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

## License

ISC 