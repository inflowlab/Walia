import { 
  buildAndSerializeTransaction, 
  createWalletEnvironment, 
  getBalance, 
  getPassPhrases, 
  getUserEnvironment, 
  setActiveEnvironment,
  getSuiActiveEnvironment
} from "./wallet-management";

async function main() {
  console.log('Wallet Management Demo');
  
  try {
    // Create a wallet environment for a user
    console.log('Creating wallet environment for Alice...');
    const aliceWallet = await createWalletEnvironment('alice');
    console.log('Alice wallet created:', aliceWallet.address);
    
    // Create another wallet for testing transfers with specified environment
    console.log('Creating wallet environment for Bob with mainnet environment...');
    const bobWallet = await createWalletEnvironment('bob', undefined, 'mainnet');
    console.log('Bob wallet created:', bobWallet.address);
    
    // Get user environment
    console.log('Getting user environment for Alice...');
    const aliceEnv = getUserEnvironment('alice');
    console.log('Alice environment:', aliceEnv);
    
    // Get pass phrases
    console.log('Getting pass phrases for Alice...');
    const alicePassPhrases = getPassPhrases('alice');
    console.log('Alice pass phrases:', alicePassPhrases);
    
    // Get current active environment
    console.log('Getting current active environment for Alice...');
    const aliceActiveEnv = getSuiActiveEnvironment('alice');
    console.log('Alice active environment:', aliceActiveEnv);
    
    // Get current active environment for Bob
    console.log('Getting current active environment for Bob...');
    const bobActiveEnv = getSuiActiveEnvironment('bob');
    console.log('Bob active environment:', bobActiveEnv);
    
    // Change Alice's environment to mainnet
    console.log('Changing Alice\'s environment to mainnet...');
    setActiveEnvironment('alice', 'mainnet');
    const aliceNewEnv = getSuiActiveEnvironment('alice');
    console.log('Alice new environment:', aliceNewEnv);
    
    // Get balances
    console.log('Getting balances for Alice...');
    const aliceBalance = await getBalance('alice');
    console.log('Alice balance:', aliceBalance);
    
    // Build and serialize transaction, specifying devnet environment
    console.log('Building transaction from Alice to Bob on devnet...');
    const tx = await buildAndSerializeTransaction('alice', 'bob', '1000000', '0', undefined, 'devnet');
    console.log('Transaction:', tx);
    const txObj = JSON.parse(tx);
    console.log('Transaction environment:', txObj.network);
    
    // Verify that Alice's environment was changed to devnet
    const aliceFinalEnv = getSuiActiveEnvironment('alice');
    console.log('Alice final environment after transaction:', aliceFinalEnv);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main(); 