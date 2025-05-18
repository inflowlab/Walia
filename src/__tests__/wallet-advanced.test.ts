import * as fs from "fs";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createWalletEnvironment, getPassPhrases, getUserEnvironment } from "../wallet-demo";

// Create a test directory
const TEST_DIR = path.join(process.cwd(), 'test-wallets-advanced');

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

// Mock functions for advanced wallet functionality
async function getBalance(userName: string, baseDir = TEST_DIR): Promise<{ sui: string; wal: string }> {
  // Check if user exists first
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    throw new Error(`User directory does not exist for ${userName}`);
  }
  
  // This would normally connect to the blockchain
  // Mock implementation returns zero balances
  return {
    sui: '0',
    wal: '0'
  };
}

async function buildAndSerializeTransaction(
  fromUserName: string,
  toUserName: string,
  suiAmount: string,
  walAmount: string,
  baseDir = TEST_DIR
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
  
  // Get user addresses
  const fromUserPassPhrases = getPassPhrases(fromUserName, baseDir);
  const toUserPassPhrases = getPassPhrases(toUserName, baseDir);
  
  // Mock transaction object
  const mockTransaction = {
    sender: fromUserPassPhrases.address,
    recipient: toUserPassPhrases.address,
    suiAmount,
    walAmount,
    timestamp: new Date().toISOString()
  };
  
  // Return serialized transaction
  return JSON.stringify(mockTransaction);
}

describe('Advanced Wallet Management Functions', () => {
  describe('getBalance', () => {
    it('should get zero balances for a new user', async () => {
      // Create a wallet environment first
      const userName = 'balance-test-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Get balance
      const balance = await getBalance(userName);
      
      // Check if it returns the expected structure
      expect(balance).toHaveProperty('sui');
      expect(balance).toHaveProperty('wal');
      
      // Check if balances are zero (for a new user)
      expect(balance.sui).toBe('0');
      expect(balance.wal).toBe('0');
    });
    
    it('should throw error if user does not exist', async () => {
      const userName = 'non-existent-user';
      
      // Expect an error when trying to get balance for non-existent user
      await expect(getBalance(userName)).rejects.toThrow(
        `User directory does not exist for ${userName}`
      );
    });
  });
  
  describe('buildAndSerializeTransaction', () => {
    it('should build and serialize a transaction between users', async () => {
      // Create wallet environments for sender and receiver
      const fromUserName = 'tx-sender-user';
      const toUserName = 'tx-receiver-user';
      
      const fromWallet = await createWalletEnvironment(fromUserName, TEST_DIR);
      const toWallet = await createWalletEnvironment(toUserName, TEST_DIR);
      
      // Build transaction
      const suiAmount = '1000000';
      const walAmount = '0';
      const serializedTx = await buildAndSerializeTransaction(
        fromUserName,
        toUserName,
        suiAmount,
        walAmount
      );
      
      // Parse the serialized transaction
      const tx = JSON.parse(serializedTx);
      
      // Check if it has the expected structure
      expect(tx).toHaveProperty('sender');
      expect(tx).toHaveProperty('recipient');
      expect(tx).toHaveProperty('suiAmount');
      expect(tx).toHaveProperty('walAmount');
      expect(tx).toHaveProperty('timestamp');
      
      // Check if sender and recipient match
      expect(tx.sender).toBe(fromWallet.address);
      expect(tx.recipient).toBe(toWallet.address);
      
      // Check if amounts match
      expect(tx.suiAmount).toBe(suiAmount);
      expect(tx.walAmount).toBe(walAmount);
    });
    
    it('should throw error if sender does not exist', async () => {
      const fromUserName = 'non-existent-sender';
      const toUserName = 'tx-receiver-user';
      
      // Create only the receiver wallet
      await createWalletEnvironment(toUserName, TEST_DIR);
      
      // Expect an error when sender doesn't exist
      await expect(buildAndSerializeTransaction(
        fromUserName,
        toUserName,
        '1000000',
        '0'
      )).rejects.toThrow(
        `User directory does not exist for ${fromUserName}`
      );
    });
    
    it('should throw error if recipient does not exist', async () => {
      const fromUserName = 'tx-sender-user-2';
      const toUserName = 'non-existent-receiver';
      
      // Create only the sender wallet
      await createWalletEnvironment(fromUserName, TEST_DIR);
      
      // Expect an error when recipient doesn't exist
      await expect(buildAndSerializeTransaction(
        fromUserName,
        toUserName,
        '1000000',
        '0'
      )).rejects.toThrow(
        `User directory does not exist for ${toUserName}`
      );
    });
  });
}); 