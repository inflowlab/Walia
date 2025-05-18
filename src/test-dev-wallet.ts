import * as fs from "fs";
import * as path from "path";
import { ClientConfig, getInfo, list_blobs, read, store } from "./storage";
import { WalletManagement } from "./wallet-management";

// Parse command-line arguments with defaults
function parseArgs() {
  // Default values
  const defaults = {
    userName: 'walia',
    walletsDir: path.join(process.cwd(), 'dev-wallets'),
    environment: 'testnet'
  };

  // Parse command-line args (format: --key=value)
  const args = process.argv.slice(2);
  const parsedArgs: Record<string, string> = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (key && value) {
        parsedArgs[key] = value;
      }
    }
  }
  
  return {
    userName: parsedArgs.userName || defaults.userName,
    walletsDir: parsedArgs.walletsDir || defaults.walletsDir,
    environment: (parsedArgs.environment || defaults.environment) as 'testnet' | 'mainnet' | 'devnet' | 'localnet'
  };
}

async function main() {
  const config = parseArgs();
  
  try {
    console.log('Testing Development Wallet');
    console.log('==========================');
    console.log('Configuration:');
    console.log(`- User Name: ${config.userName}`);
    console.log(`- Wallets Directory: ${config.walletsDir}`);
    console.log(`- Environment: ${config.environment}`);
    
    // Check if the dev wallet exists
    const walletDir = path.join(config.walletsDir, config.userName);
    if (!fs.existsSync(walletDir)) {
      console.error(`\n❌ Error: Development wallet not found at ${walletDir}`);
      console.log(`Please run "npm run create-dev-wallet -- --userName=${config.userName} --walletsDir=${config.walletsDir} --environment=${config.environment}" first`);
      process.exit(1);
    }
    
    // Initialize wallet management
    const wallet = new WalletManagement(
      config.userName, 
      config.walletsDir, 
      config.environment
    );
    
    // Get wallet info
    const walletInfo = await wallet.ensureWallet();
    console.log(`\n📋 Wallet Information:`);
    console.log(`- Address: ${walletInfo.address}`);
    console.log(`- Environment: ${config.environment}`);
    
    // Check balance
    console.log('\n💰 Checking wallet balance...');
    const balance = await wallet.getBalance();
    console.log(`- SUI Balance: ${balance.sui} SUI`);
    console.log(`- WAL Balance: ${balance.wal} WAL`);
    
    if (Number(balance.sui) <= 0) {
      console.log('\n⚠️ This wallet has no SUI. Please fund it using the mnemonic phrase from the initial setup.');
      console.log('You can use the Sui Wallet extension or Sui CLI to add funds.');
      console.log(`\nTo view the recovery phrase, run:`);
      console.log(`npm run create-dev-wallet -- --userName=${config.userName} --walletsDir=${config.walletsDir} --environment=${config.environment}`);
      process.exit(0);
    }
    
    // Create client config for storage operations
    const clientConf: ClientConfig = {
      suiCongPath: path.join(walletDir, 'sui_client.yaml'),
      walrusConfPath: path.join(walletDir, 'walrus_client_config.yaml')
    };
    
    // Test Walrus info
    try {
      console.log('\n🔍 Fetching Walrus system information...');
      const info = await getInfo(clientConf);
      console.log(`- Current epoch: ${info.epochInfo.currentEpoch}`);
      console.log(`- Max epochs ahead: ${info.epochInfo.maxEpochsAhead}`);
      console.log(`- Storage nodes: ${info.storageInfo.nNodes}`);
      console.log(`- Storage shards: ${info.storageInfo.nShards}`);
    } catch (error) {
      console.error('Error fetching Walrus info:', error);
    }
    
    // List existing blobs
    try {
      console.log('\n📝 Listing existing blobs...');
      const blobs = await list_blobs(clientConf);
      
      if (blobs.length === 0) {
        console.log('- No blobs found for this wallet');
      } else {
        console.log(`- Found ${blobs.length} blob(s):`);
        for (const blob of blobs) {
          console.log(`  * Blob ID: ${blob.blobId} (Size: ${blob.size} bytes)`);
          console.log(`    Object ID: ${blob.id}`);
          console.log(`    Storage ends at epoch: ${blob.storage.endEpoch}`);
        }
      }
    } catch (error) {
      console.error('Error listing blobs:', error);
    }
    
    // Create a test file and store it if wallet has sufficient balance
    if (Number(balance.sui) > 0.1) {
      try {
        console.log('\n🔄 Creating and storing a test file...');
        
        // Create a temporary test file
        const testFilePath = path.join(process.cwd(), 'test-file.txt');
        const testContent = `This is a test file created at ${new Date().toISOString()}\n`;
        fs.writeFileSync(testFilePath, testContent);
        
        // Store the file
        console.log('- Storing test file...');
        const storeResult = await store(testFilePath, { 
          clientConf,
          epochs: 2, // Store for 2 epochs
          attributes: {
            type: 'test',
            created: new Date().toISOString(),
            purpose: 'integration testing',
            user: config.userName,
            environment: config.environment
          }
        });
        
        console.log('- File stored successfully!');
        console.log(`- Blob ID: ${storeResult.blobId}`);
        console.log(`- Object ID: ${storeResult.objectId}`);
        console.log(`- Size: ${storeResult.unencodedSize} bytes (unencoded), ${storeResult.encodedSize} bytes (encoded)`);
        console.log(`- Storage cost: ${storeResult.storageCost} FROST`);
        
        // Read back the file to verify
        console.log('\n🔄 Reading back the stored file...');
        const readContent = await read(storeResult.blobId, { clientConf });
        console.log(`- Read ${readContent.length} bytes`);
        console.log('- File content (first 100 chars):', readContent.toString().slice(0, 100));
        
        // Clean up
        fs.unlinkSync(testFilePath);
        console.log('- Test file deleted from local filesystem');
      } catch (error) {
        console.error('\n❌ Error in storage operations:', error);
      }
    } else {
      console.log('\n⚠️ Skipping storage operations due to low balance');
    }
    
    console.log('\n✅ Dev wallet test completed!');
    console.log('\n📄 Command used for this test:');
    console.log(`npm run test-dev-wallet -- --userName=${config.userName} --walletsDir=${config.walletsDir} --environment=${config.environment}`);
  } catch (error) {
    console.error('\n❌ Error testing dev wallet:', error);
  }
}

main(); 