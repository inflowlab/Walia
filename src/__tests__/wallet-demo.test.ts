import * as fs from "fs";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createWalletEnvironment, getPassPhrases, getUserEnvironment } from "../wallet-demo";

// Create a test directory
const TEST_DIR = path.join(process.cwd(), 'test-wallets');

// Setup and teardown
beforeAll(() => {
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
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
      
      // Check if the address starts with 0x
      expect(result.address).toMatch(/^0x[a-fA-F0-9]+$/);
      
      // Check if the mnemonic is a string of multiple words
      expect(result.mnemonic.split(' ').length).toBe(12);
      
      // Check if the user directory exists
      const userDir = path.join(TEST_DIR, userName);
      expect(fs.existsSync(userDir)).toBe(true);
      
      // Check if the config files exist
      expect(fs.existsSync(path.join(userDir, 'sui_client.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'walrus_client_config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(userDir, 'notes.txt'))).toBe(true);
      
      // Check if the keystore directory exists
      const keystoreDir = path.join(userDir, 'keystore');
      expect(fs.existsSync(keystoreDir)).toBe(true);
      
      // Check if keystore file exists
      expect(fs.existsSync(path.join(keystoreDir, 'sui.keystore'))).toBe(true);
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
      expect(env).toHaveProperty('suiConfig');
      expect(env).toHaveProperty('walrusConfig');
      
      expect(env.suiConfig).toBe(path.join(TEST_DIR, userName, 'sui_client.yaml'));
      expect(env.walrusConfig).toBe(path.join(TEST_DIR, userName, 'walrus_client_config.yaml'));
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
    
    it('should throw error if notes file does not exist', () => {
      // Create a user directory without notes file
      const userName = 'no-notes-user';
      const userDir = path.join(TEST_DIR, userName);
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      // Expect an error when trying to get pass phrases
      expect(() => getPassPhrases(userName, TEST_DIR)).toThrow(
        `Notes file not found for ${userName}`
      );
    });
    
    it('should throw error if notes file has invalid format', () => {
      // Create a user directory with invalid notes file
      const userName = 'invalid-notes-user';
      const userDir = path.join(TEST_DIR, userName);
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      const notesPath = path.join(userDir, 'notes.txt');
      fs.writeFileSync(notesPath, 'Invalid format');
      
      // Expect an error when trying to get pass phrases
      expect(() => getPassPhrases(userName, TEST_DIR)).toThrow(
        `Invalid notes file format for ${userName}`
      );
    });
  });
}); 