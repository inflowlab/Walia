import { buildAndSerializeTransaction, createWalletEnvironment, getBalance, getPassPhrases, getUserEnvironment } from "./wallet-management";

async function main() {
    console.log('Wallet Management Demo');
    
    try {
        // Create a wallet environment for a user
        console.log('Creating wallet environment for Alice...');
        const aliceWallet = await createWalletEnvironment('alice');
        console.log('Alice wallet created:', aliceWallet.address);
        
        // Create another wallet for testing transfers
        console.log('Creating wallet environment for Bob...');
        const bobWallet = await createWalletEnvironment('bob');
        console.log('Bob wallet created:', bobWallet.address);
        
        // Get user environment
        console.log('Getting user environment for Alice...');
        const aliceEnv = getUserEnvironment('alice');
        console.log('Alice environment:', aliceEnv);
        
        // Get pass phrases
        console.log('Getting pass phrases for Alice...');
        const alicePassPhrases = getPassPhrases('alice');
        console.log('Alice pass phrases:', alicePassPhrases);
        
        // Get balances
        console.log('Getting balances for Alice...');
        try {
            const aliceBalance = await getBalance('alice');
            console.log('Alice balance:', aliceBalance);
        } catch (error: any) {
            console.error('Error getting balance:', error.message);
        }
        
        // Build transaction
        console.log('Building transaction from Alice to Bob...');
        try {
            const tx = await buildAndSerializeTransaction('alice', 'bob', '1000000', '0');
            console.log('Transaction:', JSON.parse(tx));
        } catch (error: any) {
            console.error('Error building transaction:', error.message);
        }
        
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main(); 