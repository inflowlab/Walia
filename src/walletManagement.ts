import axios from "axios";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execSync } from "child_process";

interface SuiConfig {
  keystore: {
    File: string;
  };
  envs: {
    alias: string;
    rpc: string;
    ws: null;
    basic_auth: null;
  }[];
  active_env: string;
  active_address: string;
}

interface WalrusConfig {
  contexts: {
    [key: string]: {
      system_object: string;
      staking_object: string;
      subsidies_object: string;
      exchange_objects: string[];
      wallet_config: {
        path: string;
        active_env: string;
        active_address?: string;
      };
    };
  };
  default_context: string;
}

interface WalletInfo {
  address: string;
  mnemonic: string;
  keystore: string;
}

// Dynamic imports to avoid TypeScript errors due to version mismatch
async function importSuiDependencies() {
  // Import the required dependencies
  const { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock } = await import('@mysten/sui');
  return { Ed25519Keypair, JsonRpcProvider, RawSigner, TransactionBlock };
}

export class WalletManagement {
  private baseDir: string;
  private provider: any; // Using any to avoid TypeScript errors

  constructor(baseDir: string = path.join(process.cwd(), 'wallets')) {
    this.baseDir = baseDir;
    
    // Ensure the base directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    
    // Initialize the provider asynchronously
    this.initializeProvider();
  }
  
  private async initializeProvider() {
    try {
      const { JsonRpcProvider } = await importSuiDependencies();
      this.provider = new JsonRpcProvider({ fullnode: 'https://fullnode.testnet.sui.io:443' });
    } catch (error) {
      console.error('Failed to initialize provider:', error);
    }
  }

  /**
   * Creates a wallet environment for a user
   * @param userName The name of the user
   * @returns Information about the created wallet
   */
  async createWalletEnvironment(userName: string): Promise<WalletInfo> {
    // Create user directory
    const userDir = path.join(this.baseDir, userName);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Import needed dependencies
    const { Ed25519Keypair } = await importSuiDependencies();

    // Generate a random mnemonic phrase (simulated here - in production, use a proper BIP-39 library)
    const words = [
      "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
      "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
      "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
      "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent"
    ];
    
    // Select 12 random words for the mnemonic
    const mnemonic = Array.from({ length: 12 }, () => words[Math.floor(Math.random() * words.length)]).join(" ");
    
    // Generate keypair
    const keypair = Ed25519Keypair.generate();
    const address = keypair.getPublicKey().toSuiAddress();
    
    // Create keystore directory
    const keystoreDir = path.join(userDir, 'keystore');
    if (!fs.existsSync(keystoreDir)) {
      fs.mkdirSync(keystoreDir, { recursive: true });
    }
    
    // Save keypair to keystore
    const keystorePath = path.join(keystoreDir, 'sui.keystore');
    
    // Export method might differ between versions, try both approaches
    let privateKey;
    try {
      // For newer versions
      privateKey = keypair.export().privateKey;
    } catch (error) {
      // For older versions
      privateKey = Buffer.from(keypair.getSecretKey()).toString('base64');
    }
    
    fs.writeFileSync(keystorePath, JSON.stringify({
      key: privateKey,
      address
    }));

    // Create sui_client.yaml
    const suiConfig: SuiConfig = {
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
    const walrusConfig: WalrusConfig = {
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
   * Gets the user environment configuration files
   * @param userName The name of the user
   * @returns Object containing paths to configuration files
   */
  getUserEnvironment(userName: string): { suiConfig: string; walrusConfig: string } {
    const userDir = path.join(this.baseDir, userName);
    
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
   * Gets pass phrases for a user's wallet
   * @param userName The name of the user
   * @returns The passphrase information
   */
  getPassPhrases(userName: string): { address: string; mnemonic: string } {
    const userDir = path.join(this.baseDir, userName);
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
   * Gets SUI and WAL balance for a user
   * @param userName The name of the user
   * @returns Object containing SUI and WAL balances
   */
  async getBalance(userName: string): Promise<{ sui: string; wal: string }> {
    if (!this.provider) {
      await this.initializeProvider();
    }
    
    const { address } = this.getPassPhrases(userName);
    
    // Get SUI balance
    const suiBalance = await this.provider.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI'
    });
    
    // Get WAL balance (assuming WAL is a custom coin)
    const walCoinType = '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af::wal::WAL';
    let walBalance;
    try {
      walBalance = await this.provider.getBalance({
        owner: address,
        coinType: walCoinType
      });
    } catch (error) {
      walBalance = { totalBalance: '0' };
    }
    
    return {
      sui: suiBalance.totalBalance,
      wal: walBalance.totalBalance
    };
  }

  /**
   * Builds and serializes a transaction to send SUI and WAL to a user's wallet
   * @param fromUserName The name of the sender
   * @param toUserName The name of the recipient
   * @param suiAmount Amount of SUI to send
   * @param walAmount Amount of WAL to send
   * @returns The serialized transaction
   */
  async buildAndSerializeTransaction(
    fromUserName: string,
    toUserName: string,
    suiAmount: string,
    walAmount: string
  ): Promise<string> {
    if (!this.provider) {
      await this.initializeProvider();
    }
    
    const { Ed25519Keypair, RawSigner, TransactionBlock } = await importSuiDependencies();
    
    const fromUserInfo = this.getPassPhrases(fromUserName);
    const toUserInfo = this.getPassPhrases(toUserName);
    
    // Load the sender's keypair
    const userDir = path.join(this.baseDir, fromUserName);
    const suiConfigPath = path.join(userDir, 'sui_client.yaml');
    const suiConfig = yaml.load(fs.readFileSync(suiConfigPath, 'utf8')) as SuiConfig;
    
    const keystorePath = suiConfig.keystore.File;
    const keystoreData = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
    
    // Create keypair from private key
    const privateKeyArray = Array.from(Buffer.from(keystoreData.key, 'base64'));
    const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    
    // Create signer
    const signer = new RawSigner(keypair, this.provider);
    
    // Create transaction block
    const txb = new TransactionBlock();
    
    // Add SUI transfer
    if (BigInt(suiAmount) > BigInt(0)) {
      txb.transferObjects(
        [txb.splitCoins(txb.gas, [txb.pure(suiAmount)])],
        txb.pure(toUserInfo.address)
      );
    }
    
    // Add WAL transfer if needed
    if (BigInt(walAmount) > BigInt(0)) {
      // This would require looking up WAL coins owned by the sender
      const walCoinType = '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af::wal::WAL';
      
      // Get WAL coins owned by sender
      const coins = await this.provider.getCoins({
        owner: fromUserInfo.address,
        coinType: walCoinType
      });
      
      if (coins.data.length > 0) {
        const walCoin = coins.data[0].coinObjectId;
        txb.transferObjects(
          [txb.object(walCoin)],
          txb.pure(toUserInfo.address)
        );
      }
    }
    
    // Build and serialize the transaction
    return JSON.stringify(await txb.build({ provider: this.provider }));
  }
} 