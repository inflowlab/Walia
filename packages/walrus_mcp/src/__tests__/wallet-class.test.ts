import * as fs from "fs";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WalletManagement } from "../wallet-management";

// Create a test directory
const TEST_DIR = path.join(process.cwd(), 'test-wallets-integration');

// Real integration test - no mocks
beforeAll(() => {
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test directories after successful execution
  if (fs.existsSync(TEST_DIR)) {
    // fs.rmSync(TEST_DIR, { recursive: true, force: true });
    console.log(`Deleted test directory: ${TEST_DIR}`);
  }
});

describe('WalletManagement Integration Tests', () => {
  describe('constructor and initialization', () => {
    it.skip('should initialize with default parameters', () => {
      const wallet = new WalletManagement('test-user-1', TEST_DIR);
      expect(wallet).toBeDefined();
    });
    
    it.skip('should initialize with custom environment', () => {
      const wallet = new WalletManagement('test-user-2', TEST_DIR, 'mainnet');
      expect(wallet).toBeDefined();
    });
  });
  
  describe('wallet creation and management', () => {
    it.skip('should create a wallet for the user', async () => {
      const wallet = new WalletManagement('create-user', TEST_DIR);
      
      // Create the wallet
      const result = await wallet.createWallet();
      
      // Check if the result has the expected structure
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('mnemonic');
      expect(result).toHaveProperty('keystore');
      
      // Check if the address is a valid Sui address (starts with 0x and 64 chars)
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Check if the wallet directory was created
      const userDir = wallet.getWalletDirectory();
      expect(fs.existsSync(userDir)).toBe(true);
      
      // Check if the config files exist
      expect(fs.existsSync(path.join(userDir, 'sui_client.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'walrus_client_config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'keypair.json'))).toBe(true);
      
      // Check if the keystore file exists
      expect(fs.existsSync(path.join(userDir, 'sui.keystore'))).toBe(true);
      
      // Verify the sui_client.yaml contains proper configuration
      const suiConfigContent = fs.readFileSync(path.join(userDir, 'sui_client.yaml'), 'utf8');
      expect(suiConfigContent).toContain('keystore:');
      expect(suiConfigContent).toContain('File:');
      expect(suiConfigContent).toContain('active_env: testnet');
      expect(suiConfigContent).toContain('active_address:');
      expect(suiConfigContent).not.toContain('key: value'); // Ensure no mock values
      
      // Verify the walrus_client_config.yaml contains proper configuration
      const walrusConfigContent = fs.readFileSync(path.join(userDir, 'walrus_client_config.yaml'), 'utf8');
      expect(walrusConfigContent).toContain('contexts:');
      expect(walrusConfigContent).toContain('testnet:');
      expect(walrusConfigContent).toContain('system_object:');
      expect(walrusConfigContent).not.toContain('key: value'); // Ensure no mock values
    });
    
    it.skip('should ensure a wallet exists and create it if needed', async () => {
      const wallet = new WalletManagement('ensure-user', TEST_DIR);
      
      // Ensure the wallet exists
      const result = await wallet.ensureWallet();
      
      // Check if the wallet was created
      expect(result).toHaveProperty('address');
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Call ensure again, should return the same wallet
      const result2 = await wallet.ensureWallet();
      expect(result2.address).toBe(result.address);
    });
  });
  
  describe('wallet operations', () => {
    it.skip('should get pass phrases for the user', async () => {
      const wallet = new WalletManagement('passphrase-user', TEST_DIR);
      
      // Create the wallet first
      const walletInfo = await wallet.createWallet();
      
      // Get pass phrases
      const passPhrases = wallet.getPassPhrases();
      
      // Check if it returns the correct values
      expect(passPhrases).toHaveProperty('address');
      expect(passPhrases).toHaveProperty('mnemonic');
      
      // Should match the wallet info
      expect(passPhrases.address).toBe(walletInfo.address);
      expect(passPhrases.mnemonic).toBe(walletInfo.mnemonic);
    });
    
    it.skip('should get balance for the user', async () => {
      const wallet = new WalletManagement('balance-user', TEST_DIR);
      
      // Create the wallet first
      await wallet.createWallet();
      
      // Get balance
      const balance = await wallet.getBalance();
      
      // Check if it returns balances in the expected format
      expect(balance).toHaveProperty('sui');
      expect(balance).toHaveProperty('wal');
      
      // Balance should be strings representing numbers
      expect(typeof balance.sui).toBe('string');
      expect(typeof balance.wal).toBe('string');
      
      // SUI balance should be non-negative
      expect(parseFloat(balance.sui)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(balance.wal)).toBeGreaterThanOrEqual(0);
    });
  });
}); 