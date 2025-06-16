import * as axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { fromBase64 } from "@mysten/sui/utils";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ClientConfig {
  suiConfPath: string;
  walrusConfPath: string;
}


interface WalletInfo {
  address: string;
  mnemonic: string;
  keystore: string;
}

// Valid environment types that can be used
export type EnvironmentType = 'testnet' | 'mainnet' | 'localnet' | 'devnet';

/**
 * Interface for the Sui keypair information
 */
export interface SuiKeypairInfo {
  keypair: Ed25519Keypair;
  activeAddress: string;
  activeEnv: EnvironmentType;
}

/**
 * Class for managing Sui wallet functionality
 */
export class WalletManagement {
  private userName: string;
  private baseDir: string;
  private activeEnv: EnvironmentType;
  private walletInfo: WalletInfo | null = null;
  private suiClient: SuiClient;

  /**
   * Creates a new WalletManagement instance
   * If the wallet doesn't exist for the user, it creates it
   * If the environment is different from the current one, it updates it
   */
  constructor(
    userName: string,
    baseDir = path.join(process.cwd(), 'wallets'),
    activeEnv: EnvironmentType = 'testnet'
  ) {
    this.userName = userName;
    this.baseDir = baseDir;
    this.activeEnv = activeEnv;
    this.suiClient = new SuiClient({ url: getFullnodeUrl(this.activeEnv) });

    // Check if wallet exists
    const userDir = path.join(this.baseDir, this.userName);
    
    if (!fs.existsSync(userDir)) {
      // Wallet doesn't exist, it will be created on the first method call
      console.log(`Wallet for ${userName} doesn't exist yet, it will be created on first operation`);
    } else {
      // Get the current environment and update if different
      try {
        const currentEnv = this.getSuiActiveEnvironment();
        if (currentEnv !== this.activeEnv) {
          this.setActiveEnvironment(this.activeEnv);
          console.log(`Updated environment from ${currentEnv} to ${this.activeEnv}`);
        }
      } catch (error) {
        // If there's an error getting the environment, the wallet may be incomplete
        console.warn(`Warning: Could not check environment for ${userName}, wallet may be incomplete`);
      }
    }
  }

  /**
   * Creates a wallet environment for the user
   */
  async createWallet(): Promise<WalletInfo> {
    // Use the existing function but with this instance's properties
    this.walletInfo = await createWalletEnvironment(this.userName, this.baseDir, this.activeEnv);
    return this.walletInfo;
  }

  /**
   * Gets user environment configuration files
   */
  getUserEnvironment(): ClientConfig {
    return getUserEnvironment(this.userName, this.baseDir);
  }

  /**
   * Gets pass phrases for the user's wallet
   */
  getPassPhrases(): { address: string; mnemonic: string } {
    return getPassPhrases(this.userName, this.baseDir);
  }

  /**
   * Updates the Sui config with new values
   */
  updateSuiConfig(updates: {
    activeEnv?: EnvironmentType;
    activeAddress?: string;
    envs?: Array<{
      alias: string;
      rpc: string;
      ws: null | string;
      basic_auth: null | string;
    }>;
  }): void {
    updateSuiConfig(this.userName, updates, this.baseDir);
    if (updates.activeEnv) {
      this.activeEnv = updates.activeEnv;
      // Update the suiClient to point to the new environment
      this.suiClient = new SuiClient({ url: getFullnodeUrl(this.activeEnv) });
    }
  }

  /**
   * Updates the Walrus config with new values
   */
  updateWalrusConfig(updates: {
    defaultContext?: EnvironmentType;
    contexts?: Record<string, any>;
  }): void {
    updateWalrusConfig(this.userName, updates, this.baseDir);
    if (updates.defaultContext) {
      this.activeEnv = updates.defaultContext;
      // Update the suiClient to point to the new environment
      this.suiClient = new SuiClient({ url: getFullnodeUrl(this.activeEnv) });
    }
  }

  /**
   * Sets the active environment for both Sui and Walrus configs
   */
  setActiveEnvironment(activeEnv: EnvironmentType): void {
    setActiveEnvironment(this.userName, activeEnv, this.baseDir);
    this.activeEnv = activeEnv;
    // Update the suiClient to point to the new environment
    this.suiClient = new SuiClient({ url: getFullnodeUrl(this.activeEnv) });
  }

  /**
   * Updates the suiClient to point to a new environment
   */
  private updateSuiClient(): void {
    this.suiClient = new SuiClient({ url: getFullnodeUrl(this.activeEnv) });
  }

  /**
   * Gets SUI and WAL balance for the user
   */
  async getBalance(): Promise<{ sui: string; wal: string }> {
    const walletInfo = await this.ensureWallet();
    
    try {
      // Use the instance's suiClient instead of creating a new one
      const suiBalance = await this.suiClient.getBalance({
        owner: walletInfo.address,
      });
      
      // Convert MIST to SUI
      const suiInDecimal = Number.parseInt(suiBalance.totalBalance) / Number(MIST_PER_SUI);
      
      // WAL balance would need to be fetched separately - implementing placeholder
      // In a real implementation, you would query the WAL token balance
      // This likely requires additional SDK calls specific to the WAL token
      const walBalance = "0";
      
      return {
        sui: suiInDecimal.toString(),
        wal: walBalance
      };
    } catch (error) {
      console.error(`Error fetching balance: ${error}`);
      throw new Error(`Failed to get balance for ${this.userName}: ${error}`);
    }
  }

  /**
   * Builds and serializes a transaction to send SUI and WAL to another user
   */
  async buildAndSerializeTransaction(
    toUserName: string,
    suiAmount: string,
    walAmount: string
  ): Promise<string> {
    return buildAndSerializeTransaction(
      this.userName,
      toUserName,
      suiAmount,
      walAmount,
      this.baseDir,
      this.activeEnv
    );
  }

  /**
   * Gets the active environment from the Sui config
   */
  getSuiActiveEnvironment(): EnvironmentType {
    return getSuiActiveEnvironment(this.userName, this.baseDir);
  }

  /**
   * Gets the wallet directory for this user
   */
  getWalletDirectory(): string {
    return path.join(this.baseDir, this.userName);
  }

  /**
   * Ensures a wallet exists for this user
   * Creates it if it doesn't exist
   */
  async ensureWallet(): Promise<WalletInfo> {
    const userDir = path.join(this.baseDir, this.userName);
    
    if (!fs.existsSync(userDir)) {
      return this.createWallet();
    }
    
    try {
      // Try to get wallet info from existing wallet
      const passPhrases = this.getPassPhrases();
      const env = this.getUserEnvironment();
      
      this.walletInfo = {
        address: passPhrases.address,
        mnemonic: passPhrases.mnemonic,
        keystore: path.join(userDir, 'sui.keystore')
      };
      
      return this.walletInfo;
    } catch (error) {
      // If there's an error, the wallet may be incomplete
      // Try to create it again
      return this.createWallet();
    }
  }

  /**
   * Checks if the Walrus config for this user needs to be updated from the official source
   * Preserves the wallet_config block
   */
  async updateWalrusConfigFromSource(): Promise<boolean> {
    try {
      // Get the latest Walrus config from the official source
      const response = await axios.get('https://docs.wal.app/setup/client_config.yaml');
      const latestConfigYaml = response.data as string;
      const latestConfig = yaml.load(latestConfigYaml) as any;
      
      // Sanitize the config to ensure all object IDs are properly formatted
      const sanitizedLatestConfig = sanitizeWalrusConfig(latestConfig);
      
      // Read current config
      const walrusConfigPath = path.join(this.getWalletDirectory(), 'walrus_client_config.yaml');
      if (!fs.existsSync(walrusConfigPath)) {
        throw new Error(`Walrus configuration file missing for ${this.userName}`);
      }
      
      const currentConfigYaml = fs.readFileSync(walrusConfigPath, 'utf8');
      const currentConfig = yaml.load(currentConfigYaml) as any;
      
      // Check if configs are different by comparing system objects in contexts
      let needsUpdate = false;
      
      // Compare each context
      for (const contextName in sanitizedLatestConfig.contexts) {
        // If the context doesn't exist in current config, we need to update
        if (!currentConfig.contexts[contextName]) {
          needsUpdate = true;
          break;
        }
        
        // Compare system_object, staking_object, subsidies_object, exchange_objects
        if (
          sanitizedLatestConfig.contexts[contextName].system_object !== currentConfig.contexts[contextName].system_object ||
          sanitizedLatestConfig.contexts[contextName].staking_object !== currentConfig.contexts[contextName].staking_object ||
          sanitizedLatestConfig.contexts[contextName].subsidies_object !== currentConfig.contexts[contextName].subsidies_object ||
          JSON.stringify(sanitizedLatestConfig.contexts[contextName].exchange_objects) !== 
            JSON.stringify(currentConfig.contexts[contextName].exchange_objects)
        ) {
          needsUpdate = true;
          break;
        }
      }
      
      // If no update needed, return early
      if (!needsUpdate) {
        return false;
      }
      
      // Create updated config by combining latest config with user's wallet_config
      const updatedConfig = JSON.parse(JSON.stringify(sanitizedLatestConfig));
      updatedConfig.default_context = currentConfig.default_context;
      
      // Preserve wallet_config for each context
      for (const contextName in updatedConfig.contexts) {
        if (currentConfig.contexts[contextName] && currentConfig.contexts[contextName].wallet_config) {
          updatedConfig.contexts[contextName].wallet_config = currentConfig.contexts[contextName].wallet_config;
        }
      }
      
      // Write updated config back to file
      fs.writeFileSync(walrusConfigPath, yaml.dump(updatedConfig, { quotingType: '"' }));
      
      return true;
    } catch (error: any) {
      throw new Error(`Failed to update Walrus config for ${this.userName}: ${error.message}`);
    }
  }

  /**
   * Reads the keypair information from the sui client configuration file
   * @returns The keypair, active address, and active environment
   */
  readSuiKeypair(): SuiKeypairInfo {
    const suiConfigPath = path.join(this.getWalletDirectory(), 'sui_client.yaml');
    return readSuiKeypair(suiConfigPath);
  }

  /**
   * Gets the Ed25519 keypair for this wallet
   * @returns The Ed25519 keypair
   */
  getKeypair(): Ed25519Keypair {
    return this.readSuiKeypair().keypair;
  }

  /**
   * Gets the suiClient instance
   */
  getSuiClient(): SuiClient {
    return this.suiClient;
  }

  /**
   * Gets the current active environment
   */
  getActiveEnvironment(): EnvironmentType {
    return this.activeEnv;
  }
}

/**
 * Fetches the latest Walrus config from the official source
 * Returns a properly formatted config with specified wallet settings
 */
async function fetchLatestWalrusConfig(
  suiConfigPath: string,
  address: string,
  activeEnv: EnvironmentType = 'testnet'
): Promise<any> {
  try {
    // Get the latest Walrus config from the official source
    const response = await axios.get('https://docs.wal.app/setup/client_config.yaml');
    const latestConfigYaml = response.data as string;
    const latestConfig = yaml.load(latestConfigYaml) as any;
    
    // If we can't parse the config or it lacks required structure, throw an error
    if (!latestConfig || !latestConfig.contexts) {
      throw new Error('Invalid Walrus config format from official source');
    }
    
    // Sanitize the config to ensure all object IDs are properly formatted
    const walrusConfig = sanitizeWalrusConfig(latestConfig);
    
    // Set the default context
    walrusConfig.default_context = activeEnv;
    
    // Configure wallet_config for each context
    for (const contextName in walrusConfig.contexts) {
      if (walrusConfig.contexts[contextName]) {
        walrusConfig.contexts[contextName].wallet_config = {
          path: suiConfigPath,
          active_env: contextName, // Each context uses its own environment
          active_address: address
        };
      }
    }
    
    return walrusConfig;
  } catch (error) {
    console.warn('Could not fetch Walrus config from official source, using fallback config');
    
    // Fallback config (in case the API request fails)
    return {
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
  }
}

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
    
    // Set the path for the keystore
    const keystorePath = path.join(userDir, 'sui.keystore');
    
    // Import the generated mnemonic into a keystore file using the correct format
    // Use a unique alias to avoid conflicts with global keystore
    const uniqueAlias = `${userName}_${Date.now()}`;
    await execAsync(`sui keytool --keystore-path "${keystorePath}" import "${mnemonic}" ed25519 --alias "${uniqueAlias}"`);
    console.log(`Created keystore at: ${keystorePath}`);
    
    // Find and delete any .key files that were created during the keytool generate command
    // Check both the current directory and the user directory
    const keyFileInCurrentDir = path.join(currentDir, `${address}.key`);
    const keyFileInUserDir = path.join(userDir, `${address}.key`);
    
    // Delete the key file from current directory if it exists
    if (fs.existsSync(keyFileInCurrentDir)) {
      fs.unlinkSync(keyFileInCurrentDir);
      console.log(`Deleted key file: ${keyFileInCurrentDir}`);
    }
    
    // Delete the key file from user directory if it exists
    if (fs.existsSync(keyFileInUserDir)) {
      fs.unlinkSync(keyFileInUserDir);
      console.log(`Deleted key file: ${keyFileInUserDir}`);
    }
    
    // Save the keypair info to a JSON file in the same directory for reference
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

    // Fetch the latest Walrus config instead of using hardcoded values
    const walrusConfig = await fetchLatestWalrusConfig(suiConfigPath, address, activeEnv);
    
    const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
    fs.writeFileSync(walrusConfigPath, yaml.dump(walrusConfig, { quotingType: '"' }));

    // Log the created files for verification
    console.log(`Wallet environment created for ${userName}:`);
    console.log(`- Keystore file: ${keystorePath}`);
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
): ClientConfig {
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
    suiConfPath: suiConfigPath,
    walrusConfPath: walrusConfigPath
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
  
  try {
    // Get user's address
    const { address } = getPassPhrases(userName, baseDir);
    
    // Get the current environment if not provided
    const env = activeEnv || getSuiActiveEnvironment(userName, baseDir);
    
    // Create a SuiClient pointing to the active network
    const suiClient = new SuiClient({ url: getFullnodeUrl(env) });
    
    // Get SUI balance
    const suiBalance = await suiClient.getBalance({
      owner: address,
    });
    
    // Convert MIST to SUI
    const suiInDecimal = Number.parseInt(suiBalance.totalBalance) / Number(MIST_PER_SUI);
    
    // WAL balance would need to be fetched separately - implementing placeholder
    const walBalance = "0";
    
    return {
      sui: suiInDecimal.toString(),
      wal: walBalance
    };
  } catch (error) {
    console.error(`Error fetching balance: ${error}`);
    throw new Error(`Failed to get balance for ${userName}: ${error}`);
  }
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

/**
 * Checks if the Walrus config has been updated from the official source and updates it in all user wallets
 * Preserves the wallet_config block in each user's config
 */
export async function checkAndUpdateWalrusConfig(
  baseDir = path.join(process.cwd(), 'wallets')
): Promise<{ updated: boolean; wallets: string[] }> {
  try {
    // Get the latest Walrus config from the official source
    const response = await axios.get('https://docs.wal.app/setup/client_config.yaml');
    const latestConfigYaml = response.data as string;
    const latestConfig = yaml.load(latestConfigYaml) as any;
    
    // If we can't parse the config, don't continue
    if (!latestConfig || !latestConfig.contexts) {
      throw new Error('Invalid Walrus config format from official source');
    }
    
    // Sanitize the config to ensure all object IDs are properly formatted
    const sanitizedLatestConfig = sanitizeWalrusConfig(latestConfig);
    
    // Find all user wallets
    const wallets: string[] = [];
    if (fs.existsSync(baseDir)) {
      const userDirs = fs.readdirSync(baseDir);
      for (const userName of userDirs) {
        const userDir = path.join(baseDir, userName);
        if (fs.statSync(userDir).isDirectory()) {
          const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
          if (fs.existsSync(walrusConfigPath)) {
            wallets.push(userName);
          }
        }
      }
    }
    
    if (wallets.length === 0) {
      return { updated: false, wallets: [] };
    }
    
    // Check if we need to update by examining the first wallet
    const firstWalletDir = path.join(baseDir, wallets[0]);
    const firstConfigPath = path.join(firstWalletDir, 'walrus_client_config.yaml');
    const currentConfigYaml = fs.readFileSync(firstConfigPath, 'utf8');
    const currentConfig = yaml.load(currentConfigYaml) as any;
    
    // Check if configs are different by comparing system objects in contexts
    let needsUpdate = false;
    
    // Compare each context
    for (const contextName in sanitizedLatestConfig.contexts) {
      // If the context doesn't exist in current config, we need to update
      if (!currentConfig.contexts[contextName]) {
        needsUpdate = true;
        break;
      }
      
      // Compare system_object, staking_object, subsidies_object, exchange_objects
      if (
        sanitizedLatestConfig.contexts[contextName].system_object !== currentConfig.contexts[contextName].system_object ||
        sanitizedLatestConfig.contexts[contextName].staking_object !== currentConfig.contexts[contextName].staking_object ||
        sanitizedLatestConfig.contexts[contextName].subsidies_object !== currentConfig.contexts[contextName].subsidies_object ||
        JSON.stringify(sanitizedLatestConfig.contexts[contextName].exchange_objects) !== 
          JSON.stringify(currentConfig.contexts[contextName].exchange_objects)
      ) {
        needsUpdate = true;
        break;
      }
    }
    
    // If no update needed, return early
    if (!needsUpdate) {
      return { updated: false, wallets };
    }
    
    // Update all wallets
    for (const userName of wallets) {
      const userDir = path.join(baseDir, userName);
      const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
      
      // Read current config to extract wallet_config
      const userConfigYaml = fs.readFileSync(walrusConfigPath, 'utf8');
      const userConfig = yaml.load(userConfigYaml) as any;
      
      // Preserve default_context
      const defaultContext = userConfig.default_context;
      
      // Create updated config by combining latest config with user's wallet_config
      const updatedConfig = JSON.parse(JSON.stringify(sanitizedLatestConfig));
      updatedConfig.default_context = defaultContext;
      
      // Preserve wallet_config for each context
      for (const contextName in updatedConfig.contexts) {
        if (userConfig.contexts[contextName] && userConfig.contexts[contextName].wallet_config) {
          updatedConfig.contexts[contextName].wallet_config = userConfig.contexts[contextName].wallet_config;
        }
      }
      
      // Write updated config back to file
      fs.writeFileSync(walrusConfigPath, yaml.dump(updatedConfig, { quotingType: '"' }));
    }
    
    return { updated: true, wallets };
  } catch (error: any) {
    throw new Error(`Failed to check or update Walrus config: ${error.message}`);
  }
}

/**
 * Reads the keypair information from the sui client configuration file
 * @param suiClientConfPath Path to the sui client configuration file
 * @returns The keypair, active address, and active environment
 */
export function readSuiKeypair(suiClientConfPath: string): SuiKeypairInfo {
  const suiConfig = yaml.load(fs.readFileSync(suiClientConfPath, 'utf8')) as any;
  const activeEnv = suiConfig.active_env as EnvironmentType;
  const activeAddress = suiConfig.active_address;
  const keystore = suiConfig.keystore.File;

  try {
    // Load keypair from keystore file
    const keystoreContent = fs.readFileSync(keystore, 'utf8');
    const keystoreData = JSON.parse(keystoreContent);

    let keypair: Ed25519Keypair | undefined = undefined;

    for (const base64Key of keystoreData) {
      // Remove the flag byte (first byte)
      const secretKey = fromBase64(base64Key).slice(1);
      const candidate = Ed25519Keypair.fromSecretKey(secretKey);
      if (candidate.getPublicKey().toSuiAddress() === activeAddress) {
        keypair = candidate;
        break;
      }
    }

    if (!keypair) {
      throw new Error('No matching keypair found for address');
    }
    
    return {
      keypair,
      activeAddress,
      activeEnv
    };
  } catch (error: any) {
    throw new Error(`Failed to read keypair: ${error.message}`);
  }
}

/**
 * Helper function to transform a Walrus config to ensure all object IDs are properly stored
 * as hex strings with 0x prefix
 * @param config The walrus configuration object
 * @returns The transformed configuration
 */
function sanitizeWalrusConfig(config: any): any {
  // Create a deep copy to avoid modifying the original
  const sanitizedConfig = JSON.parse(JSON.stringify(config));
  
  // Default definitions for well-known object IDs
  const defaultObjectIds = {
    mainnet: {
      system_object: '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2',
      staking_object: '0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904',
      subsidies_object: '0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e',
      exchange_objects: []
    },
    testnet: {
      system_object: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
      staking_object: '0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3',
      subsidies_object: '0xda799d85db0429765c8291c594d334349ef5bc09220e79ad397b30106161a0af',
      exchange_objects: [
        '0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073',
        '0x19825121c52080bb1073662231cfea5c0e4d905fd13e95f21e9a018f2ef41862',
        '0x83b454e524c71f30803f4d6c302a86fb6a39e96cdfb873c2d1e93bc1c26a3bc5',
        '0x8d63209cf8589ce7aef8f262437163c67577ed09f3e636a9d8e0813843fb8bf1'
      ]
    },
    devnet: {
      system_object: '0x5',
      staking_object: '0x6',
      subsidies_object: '0x7',
      exchange_objects: []
    },
    localnet: {
      system_object: '0x8',
      staking_object: '0x9',
      subsidies_object: '0xa',
      exchange_objects: []
    }
  };
  
  // Process each context
  for (const contextName in sanitizedConfig.contexts) {
    if (
      sanitizedConfig.contexts[contextName] && 
      defaultObjectIds[contextName as keyof typeof defaultObjectIds]
    ) {
      // Use default object IDs for known environments
      const defaultValues = defaultObjectIds[contextName as keyof typeof defaultObjectIds];
      
      sanitizedConfig.contexts[contextName].system_object = defaultValues.system_object;
      sanitizedConfig.contexts[contextName].staking_object = defaultValues.staking_object;
      sanitizedConfig.contexts[contextName].subsidies_object = defaultValues.subsidies_object;
      sanitizedConfig.contexts[contextName].exchange_objects = defaultValues.exchange_objects;
    }
  }
  
  return sanitizedConfig;
}