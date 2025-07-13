# Walia Storage MCP Server and CLI

This document describes the Model Context Protocol (MCP) server implementation and the Command Line Interface (CLI) for Walia storage operations. The MCP server implements the standard MCP protocol over stdio, while the CLI provides a direct command-line interface with JSON parameters.

## Overview

The Walia Storage system provides two interfaces:

### MCP Server
The MCP Server implements the standard MCP protocol over stdio, exposing storage.ts functions as MCP tools. External MCP clients can connect via stdio to:
- Store and retrieve encrypted files via Walrus storage
- Manage blob attributes and metadata
- Handle blob lifecycle operations (funding, burning, transferring)
- Perform seal-based encryption/decryption

### CLI Interface
The CLI provides a direct command-line interface with JSON parameters, bypassing MCP protocol overhead:
- Direct command-line operations without MCP client requirements
- Scriptable automation and testing
- Simple integration with shell scripts and CI/CD pipelines
- Quick debugging and development workflows

## Installation

First, install the MCP SDK dependency:

```bash
npm install @modelcontextprotocol/sdk
```

## CLI Usage

The CLI interface provides a simpler way to interact with Walia storage operations using JSON parameters.

### Basic CLI Usage

```bash
npm run cli <command> '<json-parameters>'
```

### CLI Commands

#### Store a File
```bash
npm run cli store '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./file.txt","epochs":5,"deletable":true,"attributes":{"description":"My file"}}'
```

#### List Blobs
```bash
npm run cli list-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","includeExpired":false}'
```

#### Read a File
```bash
npm run cli read '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobId":"ABC123"}'
```

For a complete list of CLI commands and examples, see `test-commands.md`.

## MCP Server Usage

### Starting the Server

```bash
# Run directly with ts-node
npm run mcp-server

# Or build and run
npm run mcp-server:build
```

### Server Configuration

The server requires proper wallet configuration in the dev-wallets directory. Ensure you have:
- `sui_client.yaml` - Sui client configuration
- `walrus_client_config.yaml` - Walrus client configuration
- `sui.keystore` - Private key storage

## Available Tools

### 1. walia_init

Initialize the wallet and seal manager for storage operations.

**Parameters:**
- `userName` (string, default: "walia"): Username for wallet management
- `walletsDir` (string, default: "./dev-wallets"): Directory path for wallets
- `environment` (string, default: "testnet"): Network environment (testnet/mainnet/localnet/devnet)

**Example:**
```json
{
  "userName": "alice",
  "walletsDir": "./dev-wallets",
  "environment": "testnet"
}
```

### 2. walia_store

Store a file to Walrus with seal encryption.

**Parameters:**
- `filePath` (string, required): Path to the file to store
- `epochs` (number, optional): Number of epochs to store the file
- `deletable` (boolean, default: false): Whether the blob should be deletable
- `attributes` (object, optional): Additional attributes to store with the blob

**Example:**
```json
{
  "filePath": "/path/to/file.txt",
  "epochs": 10,
  "deletable": true,
  "attributes": {
    "name": "My Document",
    "type": "text/plain"
  }
}
```

**Returns:**
```json
{
  "blobId": "...",
  "objectId": "...",
  "storageCost": 1000000,
  "unencodedSize": 1024,
  "encodedSize": 2048,
  "encodingType": "RS2"
}
```

### 3. walia_read

Read and decrypt a file from Walrus.

**Parameters:**
- `blobId` (string, required): Blob ID to read

**Example:**
```json
{
  "blobId": "ABC123..."
}
```

**Returns:**
Path to the decrypted file.

### 4. walia_list_blobs

List all blobs in Walrus storage.

**Parameters:**
- `includeExpired` (boolean, default: false): Whether to include expired blobs

**Example:**
```json
{
  "includeExpired": true
}
```

**Returns:**
Array of blob objects with metadata.

### 5. walia_get_blob_attributes

Get attributes for a specific blob.

**Parameters:**
- `blobObjectId` (string, required): Blob object ID

**Example:**
```json
{
  "blobObjectId": "0x123..."
}
```

### 6. walia_add_blob_attributes

Add attributes to a blob.

**Parameters:**
- `blobObjectId` (string, required): Blob object ID
- `attributes` (object, required): Attributes to add

**Example:**
```json
{
  "blobObjectId": "0x123...",
  "attributes": {
    "category": "document",
    "tags": "important,draft"
  }
}
```

### 7. walia_burn_blobs

Delete blobs from Walrus storage.

**Parameters:**
- `blobObjectIds` (array of strings, optional): Array of blob object IDs to delete
- `all_expired` (boolean, default: false): Delete all expired blobs
- `all` (boolean, default: false): Delete all blobs

**Example:**
```json
{
  "blobObjectIds": ["0x123...", "0x456..."]
}
```

### 8. walia_fund_shared_blob

Fund a shared blob with WAL tokens.

**Parameters:**
- `storageId` (string, required): Storage object ID
- `storageStartEpoch` (number, required): Storage start epoch
- `storageEndEpoch` (number, required): Storage end epoch
- `storageSize` (number, required): Storage size
- `amountWAL` (number, required): Amount of WAL tokens to fund

**Example:**
```json
{
  "storageId": "0x123...",
  "storageStartEpoch": 100,
  "storageEndEpoch": 200,
  "storageSize": 1024,
  "amountWAL": 5
}
```

### 9. walia_send_blob

Transfer a blob to another Sui address.

**Parameters:**
- `blobObjectId` (string, required): Blob object ID to send
- `destinationAddress` (string, required): Destination Sui address

**Example:**
```json
{
  "blobObjectId": "0x123...",
  "destinationAddress": "0xabc..."
}
```

### 10. walia_get_blob_object_id

Get blob object ID from blob ID.

**Parameters:**
- `blobId` (string, required): Blob ID

**Example:**
```json
{
  "blobId": "ABC123..."
}
```

## Error Handling

The server handles errors gracefully and returns error messages in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: <error_message>"
    }
  ]
}
```

Common error scenarios:
- Server not initialized: Call `walia_init` first
- File not found: Check file path exists
- Invalid configuration: Verify wallet configuration files
- Network issues: Check Sui/Walrus connectivity
- Insufficient funds: Ensure wallet has SUI tokens

## Configuration Requirements

### Wallet Setup

Before using the MCP server, ensure you have:

1. **Sui Client Configuration** (`sui_client.yaml`):
   - Valid keystore path
   - Network configuration (testnet/mainnet)
   - Active address set

2. **Walrus Client Configuration** (`walrus_client_config.yaml`):
   - System object references
   - Exchange object references
   - Wallet configuration path

3. **Funded Wallet**:
   - Sufficient SUI tokens for gas fees
   - Access to testnet/mainnet faucet if needed

### Environment Variables

- `NODE_ENV`: Set to "development" or "production"
- `WALLETS_DIR`: Override default wallet directory
- `RUN_WALRUS_INTEGRATION_TESTS`: Enable for testing

## Integration Examples

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "walia-storage": {
      "command": "node",
      "args": ["/path/to/walia/packages/walrus_mcp/dist/mcp-server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Custom Client Integration

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npm',
  args: ['run', 'mcp-server'],
  cwd: '/path/to/walia/packages/walrus_mcp'
});

const client = new Client({
  name: 'walia-storage-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Initialize the server
await client.request({
  method: 'tools/call',
  params: {
    name: 'walia_init',
    arguments: {
      userName: 'alice',
      environment: 'testnet'
    }
  }
});

// Store a file
await client.request({
  method: 'tools/call',
  params: {
    name: 'walia_store',
    arguments: {
      filePath: '/path/to/document.pdf',
      epochs: 10,
      attributes: {
        name: 'Important Document',
        type: 'application/pdf'
      }
    }
  }
});
```

## Security Considerations

1. **Private Key Management**: The server handles private keys through the wallet management system. Ensure proper file permissions on keystore files.

2. **Network Security**: All operations use encrypted channels (HTTPS/WSS) for blockchain communication.

3. **Access Control**: Seal-based encryption ensures only whitelisted addresses can decrypt stored files.

4. **Gas Management**: Monitor SUI token balance to prevent transaction failures.

## Troubleshooting

### Common Issues

1. **"Server not initialized"**: Call `walia_init` before other operations
2. **"File not found"**: Verify file paths are absolute and accessible
3. **"Configuration not found"**: Check wallet configuration files exist
4. **"Network timeout"**: Verify network connectivity and node availability
5. **"Insufficient gas"**: Fund wallet with SUI tokens

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development npm run mcp-server
```

### Testing

Run storage tests to verify functionality:

```bash
npm test
RUN_WALRUS_INTEGRATION_TESTS=true npm test
```

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run mcp-server
```

### Adding New Tools

1. Add function to `storage.ts`
2. Add tool definition to `setupToolHandlers()`
3. Add handler method to `WaliaStorageMCPServer`
4. Update documentation

## Support

For issues and questions:
- Check the main repository documentation
- Review wallet configuration requirements
- Verify network connectivity
- Test with basic storage operations first