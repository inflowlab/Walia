import * as fs from "fs";
import * as path from "path";
import { ClientConfig } from "../../wallet-management";

/**
 * Dev Wallet Configuration for Tests
 * 
 * This file provides configuration for using the development wallet in unit tests.
 * To use a different wallet, update these values or set environment variables:
 * - WALLET_USER_NAME
 * - WALLET_DIR
 * - WALLET_ENV
 */


// Load configuration from environment variables if available
const DEV_WALLET = {
  userName: process.env.WALLET_USER_NAME || 'walia',
  baseDir: process.env.WALLET_DIR || path.join(process.cwd(), 'dev-wallets'),
  environment: (process.env.WALLET_ENV || 'testnet') as 'testnet' | 'mainnet' | 'localnet' | 'devnet',
  // We'll derive the address if needed
  address: ''
};

// Try to get the actual wallet address from the keypair file
try {
  const walletDir = path.join(DEV_WALLET.baseDir, DEV_WALLET.userName);
  const keypairPath = path.join(walletDir, 'keypair.json');
  
  if (fs.existsSync(keypairPath)) {
    const keypairContent = fs.readFileSync(keypairPath, 'utf8');
    const keypairInfo = JSON.parse(keypairContent);
    if (keypairInfo.suiAddress) {
      DEV_WALLET.address = keypairInfo.suiAddress;
    }
  }
} catch (error) {
  // Silent fail - the address will remain empty
  console.warn(`Warning: Could not determine dev wallet address: ${error}`);
}

// Create client config for storage operations
export const DEV_CLIENT_CONFIG: ClientConfig = {
  suiConfPath: path.join(DEV_WALLET.baseDir, DEV_WALLET.userName, 'sui_client.yaml'),
  walrusConfPath: path.join(DEV_WALLET.baseDir, DEV_WALLET.userName, 'walrus_client_config.yaml')
};

export default DEV_WALLET; 