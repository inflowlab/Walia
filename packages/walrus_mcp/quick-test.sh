#!/bin/bash

# Quick test script for MCP tools and CLI

echo "=== Quick MCP Tools and CLI Test ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test file
echo "Creating test file..."
echo "Hello, Walia MCP Server! $(date)" > test-file.txt

# Function to test MCP tool
test_mcp_tool() {
    local tool_name="$1"
    local json_request="$2"
    
    echo -e "${YELLOW}Testing $tool_name...${NC}"
    
    # Start MCP server and send request
    echo "$json_request" | timeout 30 npm run mcp-server 2>/dev/null | head -20
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $tool_name test completed${NC}"
    else
        echo -e "${RED}✗ $tool_name test failed${NC}"
    fi
    echo "---"
}

# Test 1: List tools
test_mcp_tool "List Tools" '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test 2: Store file
test_mcp_tool "Store File" '{
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
        "description": "Test file from quick test",
        "timestamp": "'$(date)'"
      }
    }
  }
}'

# Test 3: List blobs
test_mcp_tool "List Blobs" '{
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
}'

# Test CLI Interface
echo -e "${YELLOW}Testing CLI Interface...${NC}"

# Test CLI store
echo "Testing CLI store command..."
npm run cli store '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./test-file.txt","epochs":5,"deletable":true,"attributes":{"description":"CLI test file","timestamp":"'$(date)'"}}' || echo -e "${RED}CLI store test failed${NC}"

# Test CLI list-blobs
echo "Testing CLI list-blobs command..."
npm run cli list-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","includeExpired":false}' || echo -e "${RED}CLI list-blobs test failed${NC}"

# Cleanup
rm -f test-file.txt

echo -e "${GREEN}Quick test completed!${NC}"
echo "For more detailed testing, run: node test-mcp-tools.js"
echo "For CLI usage examples, see: test-commands.md"
echo "For MCP manual testing, see: test-mcp-manual.md"