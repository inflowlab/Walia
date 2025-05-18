import * as path from "path";
import { readSuiKeypair } from "./wallet-management";

/**
 * Test script to verify the readSuiKeypair function
 */
async function testReadKeypair() {
  try {
    // Path to the user's wallet directory
    const userDir = path.join(process.cwd(), 'dev-wallets', 'walia');
    
    // Path to the sui_client.yaml file
    const suiConfigPath = path.join(userDir, 'sui_client.yaml');
    
    // Read the keypair info
    const keypairInfo = readSuiKeypair(suiConfigPath);
    
    // Output the information
    console.log('Successfully read keypair information:');
    console.log(`- Active address: ${keypairInfo.activeAddress}`);
    console.log(`- Active environment: ${keypairInfo.activeEnv}`);
    console.log(`- Public key: ${keypairInfo.keypair.getPublicKey().toSuiAddress()}`);
    
    // Verify the address matches
    if (keypairInfo.keypair.getPublicKey().toSuiAddress() === keypairInfo.activeAddress) {
      console.log('✅ Successfully verified that the keypair matches the active address');
    } else {
      console.error('❌ Keypair does not match the active address');
    }
  } catch (error) {
    console.error('Error testing keypair:', error);
  }
}

// Run the test
testReadKeypair(); 