# MCP Tool and CLI Test Commands

This document contains test commands for both the MCP server interface and the CLI interface.

## Prerequisites
1. Make sure you have a development wallet set up:
   ```bash
   npm run create-dev-wallet
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## CLI Commands

The CLI interface provides a simpler way to test storage operations with JSON parameters.

### Basic CLI Usage
```bash
npm run cli <command> '<json-parameters>'
```

### CLI Test Commands

#### 1. Store a File
```bash
npm run cli store '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./test-file.txt","epochs":5,"deletable":true,"attributes":{"description":"CLI test file","author":"test-user"}}'
```

#### 2. List Blobs
```bash
npm run cli list-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","includeExpired":false}'
```

#### 3. Read a File (replace BLOB_ID with actual blob ID)
```bash
npm run cli read '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobId":"BLOB_ID_HERE"}'
```

#### 4. Get Blob Object ID
```bash
npm run cli get-blob-object-id '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobId":"BLOB_ID_HERE"}'
```

#### 5. Get Blob Attributes
```bash
npm run cli get-blob-attributes '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobObjectId":"OBJECT_ID_HERE"}'
```

#### 6. Add Blob Attributes
```bash
npm run cli add-blob-attributes '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobObjectId":"OBJECT_ID_HERE","attributes":{"test-key":"test-value","timestamp":"2024-01-01T00:00:00Z"}}'
```

#### 7. Burn Blobs
```bash
npm run cli burn-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobObjectIds":["OBJECT_ID_1","OBJECT_ID_2"],"all_expired":false,"all":false}'
```

#### 8. Send Blob to Another Address
```bash
npm run cli send-blob '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobObjectId":"OBJECT_ID_HERE","destinationAddress":"0x1234567890abcdef1234567890abcdef12345678"}'
```

#### 9. Fund Shared Blob
```bash
npm run cli fund-shared-blob '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","storageId":"STORAGE_ID_HERE","storageStartEpoch":100,"storageEndEpoch":200,"storageSize":1024,"amountWAL":100}'
```

## MCP Server Commands (send via stdin to MCP server)

Start the MCP server first:
```bash
npm run mcp-server
```

### 1. List Available Tools
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

### 2. Store a File
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "walia_store",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "filePath": "./test-file.txt",
      "epochs": 5,
      "deletable": true,
      "attributes": {
        "description": "Test file",
        "author": "test-user"
      }
    }
  }
}
```

### 3. List Blobs
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "walia_list_blobs",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "includeExpired": false
    }
  }
}
```

### 4. Read a File (replace BLOB_ID with actual blob ID)
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "walia_read",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobId": "BLOB_ID_HERE"
    }
  }
}
```

### 5. Get Blob Object ID
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "walia_get_blob_object_id",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobId": "BLOB_ID_HERE"
    }
  }
}
```

### 6. Get Blob Attributes
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "walia_get_blob_attributes",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobObjectId": "OBJECT_ID_HERE"
    }
  }
}
```

### 7. Add Blob Attributes
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "walia_add_blob_attributes",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobObjectId": "OBJECT_ID_HERE",
      "attributes": {
        "test-key": "test-value",
        "timestamp": "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

### 8. Burn Blobs
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "walia_burn_blobs",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobObjectIds": ["OBJECT_ID_1", "OBJECT_ID_2"],
      "all_expired": false,
      "all": false
    }
  }
}
```

### 9. Send Blob to Another Address
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "walia_send_blob",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "blobObjectId": "OBJECT_ID_HERE",
      "destinationAddress": "0x1234567890abcdef1234567890abcdef12345678"
    }
  }
}
```

### 10. Fund Shared Blob
```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "walia_fund_shared_blob",
    "arguments": {
      "userName": "walia",
      "walletsDir": "./dev-wallets",
      "environment": "testnet",
      "storageId": "STORAGE_ID_HERE",
      "storageStartEpoch": 100,
      "storageEndEpoch": 200,
      "storageSize": 1024,
      "amountWAL": 100
    }
  }
}
```

## Testing with curl (if MCP server supports HTTP)

If you modify the server to support HTTP, you can use curl:

```bash
# List tools
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Store file
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"walia_store","arguments":{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./test-file.txt","epochs":5}}}'
```

## Testing with Node.js
Run the provided test script:
```bash
node test-mcp-tools.js
```

## Environment Variables for Testing
You can override default settings with environment variables:

```bash
export WALIA_SEAL_PACKAGE_ID="your_package_id_here"
export WALIA_SEAL_PACKAGE_ID_TESTNET="testnet_specific_package_id"
export WALLETS_DIR="./custom-wallets"
export TEST_USER="custom-user"
```

## Notes
- Replace `BLOB_ID_HERE` with actual blob IDs from store operations
- Replace `OBJECT_ID_HERE` with actual object IDs from get_blob_object_id operations
- Ensure you have sufficient SUI balance in your wallet for transactions
- The MCP server runs on stdio by default, so you need to pipe JSON requests to it