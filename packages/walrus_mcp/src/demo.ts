import * as fs from "fs";
import * as path from "path";
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
  try {
    const config = parseArgs();
    
    console.log('Walia Development Wallet Setup');
    console.log('=============================');
    console.log('Configuration:');
    console.log(`- User Name: ${config.userName}`);
    console.log(`- Wallets Directory: ${config.walletsDir}`);
    console.log(`- Environment: ${config.environment}`);
    
    // Create wallets directory if it doesn't exist
    if (!fs.existsSync(config.walletsDir)) {
      fs.mkdirSync(config.walletsDir, { recursive: true });
      console.log(`\nCreated wallets directory: ${config.walletsDir}`);
    }
    
    // Create a new wallet management instance for the user
    console.log(`\nCreating development wallet for user: ${config.userName}`);
    const wallet = new WalletManagement(config.userName, config.walletsDir, config.environment);
    
    // Ensure wallet exists
    console.log('Ensuring wallet exists...');
    const walletInfo = await wallet.ensureWallet();
    console.log(`\nWallet created successfully:`);
    console.log(`- Wallet address: ${walletInfo.address}`);
    
    // Get balance from the blockchain
    console.log('\nFetching initial balance from the blockchain...');
    const balance = await wallet.getBalance();
    console.log(`- SUI Balance: ${balance.sui} SUI`);
    console.log(`- WAL Balance: ${balance.wal} WAL`);
    
    // Get wallet directory
    const walletDir = wallet.getWalletDirectory();
    console.log(`\nWallet is stored at: ${walletDir}`);
    
    // Get mnemonic (for dev purposes only - would be kept secure in production)
    const { mnemonic } = wallet.getPassPhrases();
    console.log('\nRecovery phrase (save this somewhere secure!):', mnemonic);
    
    // Display keypair info
    console.log('\nKeypair information:');
    const keypairInfo = wallet.readSuiKeypair();
    console.log(`- Active address: ${keypairInfo.activeAddress}`);
    console.log(`- Active environment: ${keypairInfo.activeEnv}`);
    
    console.log('\n✅ Development wallet created successfully!');
    console.log('\n🔍 To use this wallet for integration testing:');
    console.log(`1. Import the mnemonic into the Sui wallet extension to fund it`);
    console.log(`2. Use the WalletManagement class with the following configuration:`);
    console.log(`   const wallet = new WalletManagement('${config.userName}', '${config.walletsDir}', '${config.environment}');`);
    
    console.log('\n🧪 To use in unit tests, add this configuration to your test files:');
    console.log(`   const DEV_WALLET = {`);
    console.log(`     userName: '${config.userName}',`);
    console.log(`     baseDir: '${config.walletsDir}',`);
    console.log(`     address: '${walletInfo.address}'`);
    console.log(`   };`);
    
    console.log('\n📄 Command to create this wallet again:');
    console.log(`   npm run create-dev-wallet -- --userName=${config.userName} --walletsDir=${config.walletsDir} --environment=${config.environment}`);
  } catch (error) {
    console.error('Error in wallet setup:', error);
  }
}

main(); 