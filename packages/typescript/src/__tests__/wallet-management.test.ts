import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import axios from "axios";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { 
  createWalletEnvironment, 
  getPassPhrases, 
  getUserEnvironment, 
  updateSuiConfig,
  updateWalrusConfig,
  setActiveEnvironment,
  getSuiActiveEnvironment
} from "../wallet-management";

// Create a test directory
const TEST_DIR = path.join(process.cwd(), 'test-wallets');

// Mock address that will be used in tests
const MOCK_ADDRESS = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock axios for fetching Walrus config
vi.mock('axios');

// Mock the exec function to avoid actually calling the Sui CLI
vi.mock('child_process', () => ({
  exec: (cmd: string, callback: (error: Error | null, result: { stdout: string, stderr: string }) => void) => {
    // Mock the output of 'sui keytool generate ed25519 --json'
    if (cmd === 'sui keytool generate ed25519 --json') {
      const mockOutput = {
        alias: null,
        suiAddress: MOCK_ADDRESS,
        publicBase64Key: 'ALrx3FqvT7/R8ErwdSDHYlF976KFamEasUliaL5TQh7r',
        keyScheme: 'ed25519',
        flag: 0,
        mnemonic: 'casino verb current tiny glove home apart mushroom fix advance video planet system',
        peerId: 'baf1dc5aaf4fbfd1f04af07520c762517defa2856a611ab1496268be53421eeb'
      };
      callback(null, { stdout: JSON.stringify(mockOutput), stderr: '' });
      
      // Create the mock key file in the current directory
      fs.writeFileSync(`${MOCK_ADDRESS}.key`, 'mock key file content');
    } 
    // Handle the keytool import command with the new format
    else if (cmd.match(/^sui keytool import --keystore-path .* ".*" ed25519 --alias .*/)) {
      callback(null, { stdout: 'Keypair imported successfully', stderr: '' });
    } 
    else {
      callback(new Error(`Unexpected command: ${cmd}`), { stdout: '', stderr: `Unexpected command: ${cmd}` });
    }
  }
}));

// No need to mock process.chdir anymore since we removed it from the implementation

// Setup and teardown
beforeAll(() => {
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Mock axios to return a valid Walrus config for all tests
  vi.mocked(axios.get).mockResolvedValue({
    data: yaml.dump({
      contexts: {
        testnet: {
          system_object: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
          staking_object: '0xbe46180321c30aab2f8b3501e24048377287fa708018a5b7c2792b35fe339ee3',
          subsidies_object: '0xda799d85db0429765c8291c594d334349ef5bc09220e79ad397b30106161a0af',
          exchange_objects: [
            '0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073'
          ]
        },
        mainnet: {
          system_object: '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2',
          staking_object: '0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904',
          subsidies_object: '0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e',
          exchange_objects: []
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
      }
    })
  } as any);
});

afterAll(() => {
  // Clean up test directories after successful execution
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    console.log(`Deleted test directory: ${TEST_DIR}`);
  }
  
  // Clear all mocks
  vi.clearAllMocks();
});

describe('Wallet Management Module', () => {
  describe('createWalletEnvironment', () => {
    it('should create a wallet environment for a user', async () => {
      const userName = 'test-user';
      const result = await createWalletEnvironment(userName, TEST_DIR);
      
      // Check if the result has the expected structure
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('mnemonic');
      expect(result).toHaveProperty('keystore');
      
      // Check if the address matches our mock
      expect(result.address).toBe(MOCK_ADDRESS);
      
      // Check if the mnemonic is a string of multiple words
      expect(result.mnemonic.split(' ').length).toBeGreaterThanOrEqual(12);
      
      // Check if the user directory exists
      const userDir = path.join(TEST_DIR, userName);
      expect(fs.existsSync(userDir)).toBe(true);
      
      // Check if the config files exist
      expect(fs.existsSync(path.join(userDir, 'sui_client.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'walrus_client_config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'keypair.json'))).toBe(true);
      
      // Verify the keystore path in the result
      expect(result.keystore).toBe(path.join(userDir, 'sui.keystore'));
      
      // Check sui config points to the correct keystore file
      const suiConfigPath = path.join(userDir, 'sui_client.yaml');
      const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
      const suiConfig = yaml.load(suiConfigContent) as any;
      expect(suiConfig.keystore.File).toBe(path.join(userDir, 'sui.keystore'));
    });

    it('should create a wallet environment with specified active environment', async () => {
      const userName = 'env-specific-user';
      const activeEnv = 'mainnet';
      
      const result = await createWalletEnvironment(userName, TEST_DIR, activeEnv);
      
      // Verify the environment in the configs
      const userDir = path.join(TEST_DIR, userName);
      
      // Check Sui config
      const suiConfigPath = path.join(userDir, 'sui_client.yaml');
      const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
      const suiConfig = yaml.load(suiConfigContent) as any;
      expect(suiConfig.active_env).toBe(activeEnv);
      
      // Check Walrus config
      const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
      const walrusConfigContent = fs.readFileSync(walrusConfigPath, 'utf8');
      const walrusConfig = yaml.load(walrusConfigContent) as any;
      
      // Default context should be set to the active env
      expect(walrusConfig.default_context).toBe(activeEnv);
      
      // Each context's wallet_config should have its own fixed environment
      expect(walrusConfig.contexts.testnet.wallet_config.active_env).toBe('testnet');
      expect(walrusConfig.contexts.mainnet.wallet_config.active_env).toBe('mainnet');
      expect(walrusConfig.contexts.devnet.wallet_config.active_env).toBe('devnet');
      expect(walrusConfig.contexts.localnet.wallet_config.active_env).toBe('localnet');
    });
  });
  
  describe('getUserEnvironment', () => {
    it('should return the user environment configurations', async () => {
      // First create a wallet environment
      const userName = 'env-test-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Get user environment
      const env = getUserEnvironment(userName, TEST_DIR);
      
      // Check if it returns the correct paths
      expect(env).toHaveProperty('suiConfPath');
      expect(env).toHaveProperty('walrusConfPath');
      
      expect(env.suiConfPath).toBe(path.join(TEST_DIR, userName, 'sui_client.yaml'));
      expect(env.walrusConfPath).toBe(path.join(TEST_DIR, userName, 'walrus_client_config.yaml'));
    });
    
    it('should throw error if user directory does not exist', () => {
      const userName = 'non-existent-user';
      
      // Expect an error when trying to get environment for non-existent user
      expect(() => getUserEnvironment(userName, TEST_DIR)).toThrow(
        `User directory does not exist for ${userName}`
      );
    });
  });
  
  describe('getPassPhrases', () => {
    it('should return the pass phrases for a user', async () => {
      // First create a wallet environment
      const userName = 'passphrase-test-user';
      const wallet = await createWalletEnvironment(userName, TEST_DIR);
      
      // Get pass phrases
      const passPhrases = getPassPhrases(userName, TEST_DIR);
      
      // Check if it returns the correct address and mnemonic
      expect(passPhrases).toHaveProperty('address');
      expect(passPhrases).toHaveProperty('mnemonic');
      
      // Should match what was created
      expect(passPhrases.address).toBe(wallet.address);
      expect(passPhrases.mnemonic).toBe(wallet.mnemonic);
    });
    
    it('should throw error if keypair file does not exist', () => {
      // Create a user directory without keypair file
      const userName = 'no-keypair-user';
      const userDir = path.join(TEST_DIR, userName);
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      // Expect an error when trying to get pass phrases
      expect(() => getPassPhrases(userName, TEST_DIR)).toThrow(
        `Keypair file not found for ${userName}`
      );
    });
    
    it('should throw error if keypair file has invalid format', () => {
      // Create a user directory with invalid keypair file
      const userName = 'invalid-keypair-user';
      const userDir = path.join(TEST_DIR, userName);
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      const keypairPath = path.join(userDir, 'keypair.json');
      fs.writeFileSync(keypairPath, JSON.stringify({ invalid: 'format' }));
      
      // Expect an error when trying to get pass phrases
      expect(() => getPassPhrases(userName, TEST_DIR)).toThrow(
        `Invalid keypair file format for ${userName}`
      );
    });
  });

  describe('updateSuiConfig', () => {
    it('should update the active environment in Sui config', async () => {
      // Create a wallet environment first
      const userName = 'update-sui-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Update the active environment
      updateSuiConfig(userName, { activeEnv: 'mainnet' }, TEST_DIR);
      
      // Check if the config was updated
      const userDir = path.join(TEST_DIR, userName);
      const suiConfigPath = path.join(userDir, 'sui_client.yaml');
      const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
      const suiConfig = yaml.load(suiConfigContent) as any;
      
      expect(suiConfig.active_env).toBe('mainnet');
    });
    
    it('should update the active address in Sui config', async () => {
      // Create a wallet environment first
      const userName = 'update-address-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      const newAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      // Update the active address
      updateSuiConfig(userName, { activeAddress: newAddress }, TEST_DIR);
      
      // Check if the config was updated
      const userDir = path.join(TEST_DIR, userName);
      const suiConfigPath = path.join(userDir, 'sui_client.yaml');
      const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
      const suiConfig = yaml.load(suiConfigContent) as any;
      
      expect(suiConfig.active_address).toBe(newAddress);
    });
    
    it('should throw error if user directory does not exist', () => {
      const userName = 'non-existent-sui-user';
      
      // Expect an error when trying to update config for non-existent user
      expect(() => updateSuiConfig(userName, { activeEnv: 'mainnet' }, TEST_DIR)).toThrow(
        `User directory does not exist for ${userName}`
      );
    });
  });
  
  describe('updateWalrusConfig', () => {
    it('should update the default context in Walrus config', async () => {
      // Create a wallet environment first
      const userName = 'update-walrus-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Update the default context
      updateWalrusConfig(userName, { defaultContext: 'mainnet' }, TEST_DIR);
      
      // Check if the config was updated
      const userDir = path.join(TEST_DIR, userName);
      const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
      const walrusConfigContent = fs.readFileSync(walrusConfigPath, 'utf8');
      const walrusConfig = yaml.load(walrusConfigContent) as any;
      
      expect(walrusConfig.default_context).toBe('mainnet');
    });
    
    it('should throw error if user directory does not exist', () => {
      const userName = 'non-existent-walrus-user';
      
      // Expect an error when trying to update config for non-existent user
      expect(() => updateWalrusConfig(userName, { defaultContext: 'mainnet' }, TEST_DIR)).toThrow(
        `User directory does not exist for ${userName}`
      );
    });
  });
  
  describe('setActiveEnvironment', () => {
    it('should update both Sui and Walrus configs with the same environment', async () => {
      // Create a wallet environment first
      const userName = 'set-env-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Set active environment
      setActiveEnvironment(userName, 'mainnet', TEST_DIR);
      
      // Check if both configs were updated
      const userDir = path.join(TEST_DIR, userName);
      
      // Check Sui config
      const suiConfigPath = path.join(userDir, 'sui_client.yaml');
      const suiConfigContent = fs.readFileSync(suiConfigPath, 'utf8');
      const suiConfig = yaml.load(suiConfigContent) as any;
      expect(suiConfig.active_env).toBe('mainnet');
      
      // Check Walrus config
      const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
      const walrusConfigContent = fs.readFileSync(walrusConfigPath, 'utf8');
      const walrusConfig = yaml.load(walrusConfigContent) as any;
      
      // Only default_context should change
      expect(walrusConfig.default_context).toBe('mainnet');
      
      // Each context should keep its own fixed environment setting
      expect(walrusConfig.contexts.testnet.wallet_config.active_env).toBe('testnet');
      expect(walrusConfig.contexts.mainnet.wallet_config.active_env).toBe('mainnet');
      expect(walrusConfig.contexts.devnet.wallet_config.active_env).toBe('devnet');
      expect(walrusConfig.contexts.localnet.wallet_config.active_env).toBe('localnet');
    });
  });
  
  describe('getSuiActiveEnvironment', () => {
    it('should return the active environment from Sui config', async () => {
      // Create a wallet environment with a specific environment
      const userName = 'get-env-user';
      const activeEnv = 'devnet';
      await createWalletEnvironment(userName, TEST_DIR, activeEnv);
      
      // Get active environment
      const env = getSuiActiveEnvironment(userName, TEST_DIR);
      
      // Check if it returns the correct environment
      expect(env).toBe(activeEnv);
    });
  });
}); 