#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const testConfig = {
  userName: 'walia',
  walletsDir: './dev-wallets',
  environment: 'testnet'
};

// Create a test file for storage
const testFilePath = path.join(__dirname, 'test-file.txt');
fs.writeFileSync(testFilePath, 'Hello, Walia Storage! This is a test file.');

console.log('=== MCP Tool Testing ===');
console.log('Test configuration:', testConfig);
console.log('Test file created at:', testFilePath);

// MCP client communication
function sendMCPRequest(method, params) {
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', ['dist/mcp-server.js'], { stdio: 'pipe' });
    
    let response = '';
    let errorOutput = '';
    
    mcpProcess.stdout.on('data', (data) => {
      response += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      } else {
        try {
          const lines = response.split('\n').filter(line => line.trim());
          const result = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return { error: 'Invalid JSON', raw: line };
            }
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    });
    
    // Send the request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    };
    
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
  });
}

// Test functions
async function testListTools() {
  console.log('\n--- Testing List Tools ---');
  try {
    const result = await sendMCPRequest('tools/list', {});
    console.log('Available tools:', result);
  } catch (error) {
    console.error('Error listing tools:', error.message);
  }
}

async function testStoreFile() {
  console.log('\n--- Testing Store File ---');
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_store',
      arguments: {
        ...testConfig,
        filePath: testFilePath,
        epochs: 5,
        deletable: true,
        attributes: {
          description: 'Test file for MCP storage',
          author: 'test-script'
        }
      }
    });
    console.log('Store result:', result);
    
    // Extract blob ID for further tests
    if (result && result[0] && result[0].content) {
      const content = result[0].content[0].text;
      const parsed = JSON.parse(content);
      if (parsed.blobId) {
        global.testBlobId = parsed.blobId;
        console.log('Stored blob ID:', global.testBlobId);
      }
    }
  } catch (error) {
    console.error('Error storing file:', error.message);
  }
}

async function testListBlobs() {
  console.log('\n--- Testing List Blobs ---');
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_list_blobs',
      arguments: {
        ...testConfig,
        includeExpired: false
      }
    });
    console.log('List blobs result:', result);
  } catch (error) {
    console.error('Error listing blobs:', error.message);
  }
}

async function testReadFile() {
  console.log('\n--- Testing Read File ---');
  if (!global.testBlobId) {
    console.log('No blob ID available for reading test');
    return;
  }
  
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_read',
      arguments: {
        ...testConfig,
        blobId: global.testBlobId
      }
    });
    console.log('Read result:', result);
  } catch (error) {
    console.error('Error reading file:', error.message);
  }
}

async function testGetBlobObjectId() {
  console.log('\n--- Testing Get Blob Object ID ---');
  if (!global.testBlobId) {
    console.log('No blob ID available for object ID test');
    return;
  }
  
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_get_blob_object_id',
      arguments: {
        ...testConfig,
        blobId: global.testBlobId
      }
    });
    console.log('Get blob object ID result:', result);
    
    // Extract object ID for further tests
    if (result && result[0] && result[0].content) {
      const content = result[0].content[0].text;
      const match = content.match(/Blob object ID: (\w+)/);
      if (match) {
        global.testObjectId = match[1];
        console.log('Blob object ID:', global.testObjectId);
      }
    }
  } catch (error) {
    console.error('Error getting blob object ID:', error.message);
  }
}

async function testGetBlobAttributes() {
  console.log('\n--- Testing Get Blob Attributes ---');
  if (!global.testObjectId) {
    console.log('No object ID available for attributes test');
    return;
  }
  
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_get_blob_attributes',
      arguments: {
        ...testConfig,
        blobObjectId: global.testObjectId
      }
    });
    console.log('Get blob attributes result:', result);
  } catch (error) {
    console.error('Error getting blob attributes:', error.message);
  }
}

async function testAddBlobAttributes() {
  console.log('\n--- Testing Add Blob Attributes ---');
  if (!global.testObjectId) {
    console.log('No object ID available for add attributes test');
    return;
  }
  
  try {
    const result = await sendMCPRequest('tools/call', {
      name: 'walia_add_blob_attributes',
      arguments: {
        ...testConfig,
        blobObjectId: global.testObjectId,
        attributes: {
          'test-attribute': 'test-value',
          'timestamp': new Date().toISOString()
        }
      }
    });
    console.log('Add blob attributes result:', result);
  } catch (error) {
    console.error('Error adding blob attributes:', error.message);
  }
}

// Run all tests
async function runTests() {
  await testListTools();
  await testStoreFile();
  await testListBlobs();
  await testReadFile();
  await testGetBlobObjectId();
  await testGetBlobAttributes();
  await testAddBlobAttributes();
  
  console.log('\n=== Test Summary ===');
  console.log('Test blob ID:', global.testBlobId || 'Not available');
  console.log('Test object ID:', global.testObjectId || 'Not available');
  console.log('Test file path:', testFilePath);
}

runTests().catch(console.error);