import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface WalletInfo {
  address: string;
  mnemonic: string;
  keystore: string;
}

/**
 * Create a wallet environment for a user
 */
export async function createWalletEnvironment(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets')
): Promise<WalletInfo> {
  // Create user directory
  const userDir = path.join(baseDir, userName);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Generate a random mnemonic phrase
  const words = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
    "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act"
  ];
  
  const mnemonic = Array.from({ length: 12 }, () => words[Math.floor(Math.random() * words.length)]).join(" ");
  
  // Generate a sample address (in a real app, this would be derived from keypair)
  const address = `0x${Array.from({ length: 64 }, () => 
    '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;
  
  // Create keystore directory
  const keystoreDir = path.join(userDir, 'keystore');
  if (!fs.existsSync(keystoreDir)) {
    fs.mkdirSync(keystoreDir, { recursive: true });
  }
  
  // Save random keypair to keystore
  const keystorePath = path.join(keystoreDir, 'sui.keystore');
  const privateKey = Array.from({ length: 64 }, () => 
    '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  
  fs.writeFileSync(keystorePath, JSON.stringify({
    key: Buffer.from(privateKey, 'hex').toString('base64'),
    address
  }));

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
      }
    ],
    active_env: 'testnet',
    active_address: address
  };
  
  const suiConfigPath = path.join(userDir, 'sui_client.yaml');
  fs.writeFileSync(suiConfigPath, yaml.dump(suiConfig));

  // Create notes.txt with pass phrases
  const notesPath = path.join(userDir, 'notes.txt');
  fs.writeFileSync(notesPath, `Address: ${address}\nMnemonic: ${mnemonic}`);

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
          active_env: 'mainnet'
        }
      }
    },
    default_context: 'testnet'
  };
  
  const walrusConfigPath = path.join(userDir, 'walrus_client_config.yaml');
  fs.writeFileSync(walrusConfigPath, yaml.dump(walrusConfig));

  return {
    address,
    mnemonic,
    keystore: keystorePath
  };
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
  const notesPath = path.join(userDir, 'notes.txt');
  
  if (!fs.existsSync(notesPath)) {
    throw new Error(`Notes file not found for ${userName}`);
  }
  
  const notesContent = fs.readFileSync(notesPath, 'utf8');
  const addressMatch = notesContent.match(/Address: (0x[a-fA-F0-9]+)/);
  const mnemonicMatch = notesContent.match(/Mnemonic: (.+)/);
  
  if (!addressMatch || !mnemonicMatch) {
    throw new Error(`Invalid notes file format for ${userName}`);
  }
  
  return {
    address: addressMatch[1],
    mnemonic: mnemonicMatch[1]
  };
}

/**
 * Get SUI and WAL balance for a user
 * Mock implementation for demonstration purposes
 */
export async function getBalance(
  userName: string, 
  baseDir = path.join(process.cwd(), 'wallets')
): Promise<{ sui: string; wal: string }> {
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

/**
 * Builds and serializes a transaction to send SUI and WAL to a user's wallet
 * Mock implementation for demonstration purposes
 */
export async function buildAndSerializeTransaction(
  fromUserName: string,
  toUserName: string,
  suiAmount: string,
  walAmount: string,
  baseDir = path.join(process.cwd(), 'wallets')
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

// Note: The functions above are mock implementations
// In a production environment, they would use the Sui SDK
// to interact with the blockchain