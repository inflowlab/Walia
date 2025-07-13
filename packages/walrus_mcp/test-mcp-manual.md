# Manual MCP Server Testing Guide

This guide shows how to manually test the MCP server using different methods.

## Method 1: Using the Test Client (Recommended)

Run the automated test client:

```bash
npm run test-mcp
```

This will:
1. Start the MCP server
2. Connect to it
3. List available tools
4. Initialize the server
5. Test basic functionality

## Method 2: Manual JSON-RPC Testing

You can manually test the server using stdin/stdout with JSON-RPC messages:

1. Start the server:
```bash
npm run mcp-server
```

2. Send JSON-RPC messages via stdin. Here are some examples:

### List Available Tools
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Initialize Server
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "walia_init",
    "arguments": {
      "userName": "test-user",
      "walletsDir": "./dev-wallets",
      "environment": "testnet"
    }
  }
}
```

### List Blobs
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "walia_list_blobs",
    "arguments": {
      "includeExpired": false
    }
  }
}
```

## Method 3: Using curl (for debugging)

Create a simple wrapper script to test via curl:

```bash
#!/bin/bash
# Save as test-mcp.sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp-server
```

## Method 4: Integration with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "walia-storage": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/path/to/walia/packages/walrus_mcp",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Prerequisites for Testing

Before testing, ensure you have:

1. **Environment Setup**:
   - Copy `.env.example` to `.env`
   - Set the correct WALIA_SEAL_PACKAGE_ID values

2. **Wallet Configuration**:
   - Run `npm run create-dev-wallet` to create test wallets
   - Ensure you have funded wallets with SUI tokens

3. **Dependencies**:
   ```bash
   npm install
   ```

## Expected Test Results

### Successful Server Start
```
Walia Storage MCP Server running on stdio
```

### List Tools Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "walia_init",
        "description": "Initialize wallet and seal manager for storage operations"
      },
      {
        "name": "walia_store",
        "description": "Store a file to Walrus with seal encryption"
      },
      // ... more tools
    ]
  }
}
```

### Successful Initialization
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Walia Storage MCP Server initialized successfully for user: test-user"
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

1. **"Server not initialized"**: Always call `walia_init` first
2. **"Configuration not found"**: Check that wallet files exist in `./dev-wallets`
3. **"Package not found"**: Verify environment variables are set
4. **Connection timeout**: Check that the server process is running

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run mcp-server
```

### Logs

Check server logs for errors:
- Server starts with: "Walia Storage MCP Server running on stdio"
- Initialization logs: "SealManager: network=testnet, keyServers=..."
- Error messages will be printed to stderr

## File Storage Testing

Once the server is initialized, you can test file operations:

### Store a File
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "walia_store",
    "arguments": {
      "filePath": "/path/to/test-file.txt",
      "epochs": 5,
      "deletable": true,
      "attributes": {
        "name": "Test File",
        "type": "text/plain"
      }
    }
  }
}
```

### Read a File
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "walia_read",
    "arguments": {
      "blobId": "YOUR_BLOB_ID_HERE"
    }
  }
}
```

## Performance Testing

For load testing:
1. Use the automated test client in a loop
2. Monitor memory usage and response times
3. Test with different file sizes
4. Test concurrent requests (if applicable)

## Security Testing

1. Test with invalid credentials
2. Test with malformed JSON
3. Test with missing required parameters
4. Test with very large files
5. Test network disconnection scenarios 