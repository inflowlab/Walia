#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🚀 Starting MCP Server Test...\n');

  // Start the MCP server process
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'mcp-server'],
    cwd: process.cwd()
  });

  const client = new Client({
    name: 'walia-storage-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // Connect to the server
    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Test 1: List available tools
    console.log('🔍 Testing: List available tools');
    const tools = await client.request({
      method: 'tools/list',
      params: {}
    });
    console.log(`✅ Found ${tools.tools.length} tools:`);
    tools.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test 2: Initialize the server
    console.log('🏗️  Testing: Initialize server');
    const initResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'walia_init',
        arguments: {
          userName: 'test-user',
          walletsDir: './dev-wallets',
          environment: 'testnet'
        }
      }
    });
    console.log('✅ Server initialized successfully');
    console.log(`   Response: ${initResult.content[0].text}\n`);

    // Test 3: List blobs (should work even with empty storage)
    console.log('📋 Testing: List blobs');
    const listResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'walia_list_blobs',
        arguments: {
          includeExpired: false
        }
      }
    });
    console.log('✅ List blobs successful');
    console.log(`   Response: ${listResult.content[0].text}\n`);

    console.log('🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.data) {
      console.error('Error details:', error.data);
    }
  } finally {
    try {
      await client.close();
      console.log('🔌 Disconnected from server');
    } catch (e) {
      console.error('Error closing client:', e.message);
    }
  }
}

// Run the test
testMCPServer().catch(console.error); 