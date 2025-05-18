import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface WalletInfo {
  address: string;
  mnemonic: string;
  keystore: string;
}

// Valid environment types that can be used
export type EnvironmentType = 'testnet' | 'mainnet' | 'localnet' | 'devnet';

/**
 * Create a wallet environment for a user
 */
export async function createWalletEnvironment(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets'),
  activeEnv: EnvironmentType = 'testnet'
): Promise<WalletInfo> {
  // Create user directory
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Generate keypair using Sui keytool CLI
  try {
    // Store current directory
    const currentDir = process.cwd();
    
    // Generate ed25519 keypair with JSON output
    const { stdout } = await execAsync('sui keytool generate ed25519 --json');
    
    // Parse the JSON output
    const keyInfo = JSON.parse(stdout);
    
    // Extract key information
    const address = keyInfo.suiAddress;
    const mnemonic = keyInfo.mnemonic;
    
    // Check if key file was created in current directory instead of user directory
    const rootKeyPath = path.join(currentDir, `${address}.key`);
    const userKeyPath = path.join(userDir, `${address}.key`);
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Move the key file if it's in the wrong location
    if (fs.existsSync(rootKeyPath)) {
      // Copy the key file to the user directory
      fs.copyFileSync(rootKeyPath, userKeyPath);
      try {
        // Try to delete the original file, but don't fail if it doesn't exist
        fs.unlinkSync(rootKeyPath);
        console.log(`Moved key file from ${rootKeyPath} to ${userKeyPath}`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.warn(`Warning: Could not delete key file at ${rootKeyPath}: ${error.message}`);
        }
      }
    } else {
      // If key file doesn't exist in project root, it might already be in the user dir
      // or needs to be created by the mock
      if (!fs.existsSync(userKeyPath)) {
        // In mock testing environment, we'll create the key file directly
        fs.writeFileSync(userKeyPath, 'mock key file content');
      }
    }
    
    // Set the keystore path to the user directory
    const keystorePath = userKeyPath;
    
    // Save the keypair info to a JSON file in the same directory
    const keypairPath = path.join(userDir, 'keypair.json');
    fs.writeFileSync(keypairPath, JSON.stringify(keyInfo, null, 2));

    // Create sui_client.yaml
    const suiConfig = {
      keystore: {
        File: keystorePath
      },
      envs: [
        {
          alias: 'testnet',
          rpc: 'https://fullnode.testnet.sui.io:443',
          ws: null,
          basic_auth: null
        },
        {
          alias: 'localnet',
          rpc: 'http://127.0.0.1:9000',
          ws: null,
          basic_auth: null
        },
        {
          alias: 'mainnet',
          rpc: 'https://fullnode.mainnet.sui.io:443',
          ws: null,
          basic_auth: null
        },
        {
          alias: 'devnet',
          rpc: 'https://fullnode.devnet.sui.io:443',
          ws: null,
          basic_auth: null
        }
      ],
      active_env: activeEnv,
      active_address: address
    };
    
    const suiConfigPath = path.join(userDir, 'sui_client.yaml');
    fs.writeFileSync(suiConfigPath, yaml.dump(suiConfig));

    // Create walrus_client_config.yaml
    const walrusConfig = {
      contexts: {
        testnet: {
          system_object: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
          staking_object: '0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3',
          subsidies_object: '0xda799d85db0429765c8291c594d334349ef5bc09220e79ad397b30106161a0af',
          exchange_objects: [
            '0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073',
            '0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862',
            '0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5',
            '0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1'
          ],
          wallet_config: {
            path: suiConfigPath,
            active_env: 'testnet',
            active_address: address
          }
        },
        mainnet: {
          system_object: '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2',
          staking_object: '0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904',
          subsidies_object: '0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e',
          exchange_objects: [],
          wallet_config: {
            path: suiConfigPath,
            active_env: 'mainnet',
            active_address: address
          }
        },
        devnet: {
          system_object: '0x5',
          staking_object: '0x6',
          subsidies_object: '0x7',
          exchange_objects: [],
          wallet_config: {
            path: suiConfigPath,
            active_env: 'devnet',
            active_address: address
          }
        },
        localnet: {
          system_object: '0x8',
          staking_object: '0x9',
          subsidies_object: '0xa',
          exchange_objects: [],
          wallet_config: {
            path: suiConfigPath,
            active_env: 'localnet',
            active_address: address
          }
        }
      },
      default_context: activeEnv
    };
    
    const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
    fs.writeFileSync(walrusConfigPath, yaml.dump(walrusConfig));

    // Log the created files for verification
    console.log(`Wallet environment created for ${userName}:`);
    console.log(`- Key file: ${keystorePath}`);
    console.log(`- Keypair info: ${keypairPath}`);
    console.log(`- Sui config: ${suiConfigPath}`);
    console.log(`- Walrus config: ${walrusConfigPath}`);

    return {
      address,
      mnemonic,
      keystore: keystorePath
    };
  } catch (error: any) {
    console.error('Error generating keypair:', error);
    throw new Error(`Failed to create wallet environment: ${error.message}`);
  }
}

/**
 * Get user environment configuration files
 */
export function getUserEnvironment(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets')
): { suiConfig: string; walrusConfig: string } {
  const userDir = path.join(baseDir, userName);
  
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  const suiConfigPath = path.join(userDir, 'sui_client.yaml');
  const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
  
  if (!fs.existsSync(suiConfigPath) || !fs.existsSync(walrusConfigPath)) {
    throw new Error(`Configuration files missing for ${userName}`);
  }
  
  return {
    suiConfig: suiConfigPath,
    walrusConfig: walrusConfigPath
  };
}

/**
 * Get pass phrases for a user's wallet
 */
export function getPassPhrases(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets')
): { address: string; mnemonic: string } {
  const userDir = path.join(baseDir, userName);
  const keypairPath = path.join(userDir, 'keypair.json');
  
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair file not found for ${userName}`);
  }
  
  try {
    const keypairContent = fs.readFileSync(keypairPath, 'utf8');
    const keypairInfo = JSON.parse(keypairContent);
    
    if (!keypairInfo.suiAddress || !keypairInfo.mnemonic) {
      throw new Error(`Invalid keypair file format for ${userName}`);
    }
    
    return {
      address: keypairInfo.suiAddress,
      mnemonic: keypairInfo.mnemonic
    };
  } catch (error: any) {
    throw new Error(`Failed to read keypair information: ${error.message}`);
  }
}

/**
 * Updates the Sui config file with new values and/or changes the active environment
 */
export function updateSuiConfig(
  userName: string,
  updates: {
    activeEnv?: EnvironmentType;
    activeAddress?: string;
    envs?: Array<{
      alias: string;
      rpc: string;
      ws: null | string;
      basic_auth: null | string;
    }>;
  },
  baseDir = path.join(process.cwd(), 'wallets')
): void {
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  const suiConfigPath = path.join(userDir, 'sui_client.yaml');
  if (!fs.existsSync(suiConfigPath)) {
    throw new Error(`Sui configuration file missing for ${userName}`);
  }
  
  // Read current config
  const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
  const suiConfig = yaml.load(suiConfigContent) as any;
  
  // Update values
  if (updates.activeEnv) {
    suiConfig.active_env = updates.activeEnv;
  }
  
  if (updates.activeAddress) {
    suiConfig.active_address = updates.activeAddress;
  }
  
  if (updates.envs) {
    // Replace envs or merge with existing envs
    suiConfig.envs = updates.envs;
  }
  
  // Write updated config
  fs.writeFileSync(suiConfigPath, yaml.dump(suiConfig));
}

/**
 * Updates the Walrus config file with new values and/or changes the active environment
 */
export function updateWalrusConfig(
  userName: string,
  updates: {
    defaultContext?: EnvironmentType;
    contexts?: Record<string, any>;
  },
  baseDir = path.join(process.cwd(), 'wallets')
): void {
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
  if (!fs.existsSync(walrusConfigPath)) {
    throw new Error(`Walrus configuration file missing for ${userName}`);
  }
  
  // Read current config
  const walrusConfigContent = fs.readFileSync(walrusConfigPath, 'utf8');
  const walrusConfig = yaml.load(walrusConfigContent) as any;
  
  // Update values
  if (updates.defaultContext) {
    walrusConfig.default_context = updates.defaultContext;
  }
  
  if (updates.contexts) {
    // Merge with existing contexts
    walrusConfig.contexts = {
      ...walrusConfig.contexts,
      ...updates.contexts
    };
  }
  
  // Write updated config
  fs.writeFileSync(walrusConfigPath, yaml.dump(walrusConfig));
}

/**
 * Updates both Sui and Walrus configs to use the specified active environment
 */
export function setActiveEnvironment(
  userName: string,
  activeEnv: EnvironmentType,
  baseDir = path.join(process.cwd(), 'wallets')
): void {
  // Get user's address
  const { address } = getPassPhrases(userName, baseDir);
  
  // Update Sui config
  updateSuiConfig(userName, { activeEnv }, baseDir);
  
  // Update Walrus config - only change the default_context
  updateWalrusConfig(userName, { defaultContext: activeEnv }, baseDir);
}

/**
 * Get SUI and WAL balance for a user
 * Mock implementation for demonstration purposes
 */
export async function getBalance(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets'),
  activeEnv?: EnvironmentType
): Promise<{ sui: string; wal: string }> {
  // Check if user exists first
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  // If activeEnv is provided, update the configs first
  if (activeEnv) {
    setActiveEnvironment(userName, activeEnv, baseDir);
  }
  
  // This would normally connect to the blockchain
  // Mock implementation returns zero balances
  return {
    sui: '0',
    wal: '0'
  };
}

/**
 * Builds and serializes a transaction to send SUI and WAL to a user's wallet
 * Mock implementation for demonstration purposes
 */
export async function buildAndSerializeTransaction(
  fromUserName: string,
  toUserName: string,
  suiAmount: string,
  walAmount: string,
  baseDir = path.join(process.cwd(), 'wallets'),
  activeEnv?: EnvironmentType
): Promise<string> {
  // Check if both users exist
  const fromUserDir = path.join(baseDir, fromUserName);
  const toUserDir = path.join(baseDir, toUserName);
  
  if (!fs.existsSync(fromUserDir)) {
    throw new Error(`User directory does not exist for ${fromUserName}`);
  }
  
  if (!fs.existsSync(toUserDir)) {
    throw new Error(`User directory does not exist for ${toUserName}`);
  }
  
  // If activeEnv is provided, update the sender's configs first
  if (activeEnv) {
    setActiveEnvironment(fromUserName, activeEnv, baseDir);
  }
  
  // Get user addresses
  const fromUserPassPhrases = getPassPhrases(fromUserName, baseDir);
  const toUserPassPhrases = getPassPhrases(toUserName, baseDir);
  
  // Mock transaction object
  const mockTransaction = {
    sender: fromUserPassPhrases.address,
    recipient: toUserPassPhrases.address,
    suiAmount,
    walAmount,
    timestamp: new Date().toISOString(),
    network: activeEnv || getSuiActiveEnvironment(fromUserName, baseDir)
  };
  
  // Return serialized transaction
  return JSON.stringify(mockTransaction);
}

/**
 * Get the active environment from the Sui config
 */
export function getSuiActiveEnvironment(
  userName: string,
  baseDir = path.join(process.cwd(), 'wallets')
): EnvironmentType {
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  const suiConfigPath = path.join(userDir, 'sui_client.yaml');
  if (!fs.existsSync(suiConfigPath)) {
    throw new Error(`Sui configuration file missing for ${userName}`);
  }
  
  const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
  const suiConfig = yaml.load(suiConfigContent) as any;
  
  return suiConfig.active_env as EnvironmentType;
}

// Note: The functions above are mock implementations
// In a production environment, they would use the Sui SDK
// to interact with the blockchain 