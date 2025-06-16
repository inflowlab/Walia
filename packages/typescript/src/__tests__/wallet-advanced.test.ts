import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { 
  createWalletEnvironment, 
  getPassPhrases, 
  getUserEnvironment, 
  getBalance, 
  buildAndSerializeTransaction,
  getSuiActiveEnvironment
} from "../wallet-management";

// Create a test directory
const TEST_DIR = path.join(process.cwd(), 'test-wallets-advanced');

// Mock address that will be used in tests
const MOCK_ADDRESS = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock SuiClient
vi.mock('@mysten/sui/client', () => {
  return {
    getFullnodeUrl: (env: string) => `https://fullnode.${env}.sui.io`,
    SuiClient: vi.fn().mockImplementation(() => {
      return {
        getBalance: vi.fn().mockResolvedValue({
          coinType: '0x2::sui::SUI',
          coinObjectCount: 1,
          totalBalance: '1000000000', // 1 SUI in MIST
          lockedBalance: {}
        })
      };
    })
  };
});

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

describe('Advanced Wallet Management Functions', () => {
  describe('getBalance', () => {
    it('should get balances for a user', async () => {
      // Create a wallet environment first
      const userName = 'balance-test-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Get balance
      const balance = await getBalance(userName, TEST_DIR);
      
      // Check if it returns the expected structure
      expect(balance).toHaveProperty('sui');
      expect(balance).toHaveProperty('wal');
      
      // Check if SUI balance matches our mock (1 SUI)
      expect(balance.sui).toBe('1');
      expect(balance.wal).toBe('0');
    });
    
    it('should throw error if user does not exist', async () => {
      const userName = 'non-existent-user';
      
      // Expect an error when trying to get balance for non-existent user
      await expect(getBalance(userName, TEST_DIR)).rejects.toThrow(
        `User directory does not exist for ${userName}`
      );
    });

    it('should update the active environment when getting balance', async () => {
      // Create a wallet environment first
      const userName = 'env-balance-test-user';
      await createWalletEnvironment(userName, TEST_DIR);
      
      // Get balance with a different environment
      const activeEnv = 'mainnet';
      await getBalance(userName, TEST_DIR, activeEnv);
      
      // Check if the environment was updated
      const env = getSuiActiveEnvironment(userName, TEST_DIR);
      expect(env).toBe(activeEnv);
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
        walAmount,
        TEST_DIR
      );
      
      // Parse the serialized transaction
      const tx = JSON.parse(serializedTx);
      
      // Check if it has the expected structure
      expect(tx).toHaveProperty('sender');
      expect(tx).toHaveProperty('recipient');
      expect(tx).toHaveProperty('suiAmount');
      expect(tx).toHaveProperty('walAmount');
      expect(tx).toHaveProperty('timestamp');
      expect(tx).toHaveProperty('network');
      
      // Check if sender and recipient match
      expect(tx.sender).toBe(fromWallet.address);
      expect(tx.recipient).toBe(toWallet.address);
      
      // Check if amounts match
      expect(tx.suiAmount).toBe(suiAmount);
      expect(tx.walAmount).toBe(walAmount);
      
      // Check if network matches the default
      expect(tx.network).toBe('testnet');
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
        '0',
        TEST_DIR
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
        '0',
        TEST_DIR
      )).rejects.toThrow(
        `User directory does not exist for ${toUserName}`
      );
    });

    it('should update the active environment when building transaction', async () => {
      // Create wallet environments for sender and receiver
      const fromUserName = 'env-tx-sender';
      const toUserName = 'env-tx-receiver';
      
      await createWalletEnvironment(fromUserName, TEST_DIR);
      await createWalletEnvironment(toUserName, TEST_DIR);
      
      // Build transaction with a different environment
      const activeEnv = 'mainnet';
      const serializedTx = await buildAndSerializeTransaction(
        fromUserName,
        toUserName,
        '1000000',
        '0',
        TEST_DIR,
        activeEnv
      );
      
      // Parse the serialized transaction
      const tx = JSON.parse(serializedTx);
      
      // Check if network in transaction matches specified environment
      expect(tx.network).toBe(activeEnv);
      
      // Check if the environment was updated in the config
      const env = getSuiActiveEnvironment(fromUserName, TEST_DIR);
      expect(env).toBe(activeEnv);
    });
  });
}); 