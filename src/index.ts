import { WalletManagement } from "./walletManagement";

async function main() {
    console.log('Wallet Management Demo');
    
    // Create a wallet management instance
    const walletManager = new WalletManagement();
    
    try {
        // Create a wallet environment for a user
        console.log('Creating wallet environment for Alice...');
        const aliceWallet = await walletManager.createWalletEnvironment('alice');
        console.log('Alice wallet created:', aliceWallet.address);
        
        // Create another wallet for testing transfers
        console.log('Creating wallet environment for Bob...');
        const bobWallet = await walletManager.createWalletEnvironment('bob');
        console.log('Bob wallet created:', bobWallet.address);
        
        // Get user environment
        console.log('Getting user environment for Alice...');
        const aliceEnv = walletManager.getUserEnvironment('alice');
        console.log('Alice environment:', aliceEnv);
        
        // Get pass phrases
        console.log('Getting pass phrases for Alice...');
        const alicePassPhrases = walletManager.getPassPhrases('alice');
        console.log('Alice pass phrases:', alicePassPhrases);
        
        // Note: The following operations require funded wallets on the testnet
        // Get balances (this will likely return zero for new wallets)
        console.log('Getting balances for Alice...');
        try {
            const aliceBalance = await walletManager.getBalance('alice');
            console.log('Alice balance:', aliceBalance);
        } catch (error: any) {
            console.error('Error getting balance:', error.message);
        }
        
        // Build transaction (this is just a demo, actual transfer would require funded wallets)
        console.log('Building transaction from Alice to Bob...');
        try {
            const tx = await walletManager.buildAndSerializeTransaction('alice', 'bob', '1000000', '0');
            console.log('Transaction built and serialized');
        } catch (error: any) {
            console.error('Error building transaction:', error.message);
        }
        
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main(); 