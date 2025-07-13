#!/usr/bin/env node

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
config();

import { 
  store, 
  read, 
  list_blobs, 
  add_blob_attributes, 
  get_blob_attributes, 
  burnBlobs, 
  fundSharedBlob, 
  sendBlob,
  getBlobObjectIdByBlobId,
  BlobParams,
  BurnParams,
  StoreResult,
  BlobObject,
  BlobAttributes,
  StorageObject
} from './storage.js';
import { SealManager } from './seal.js';
import { WalletManagement, ClientConfig, EnvironmentType } from './wallet-management.js';

class WaliaCLI {
  private getWaliaSealPackageId(environment: string): string {
    // Default fallback package ID
    const DEFAULT_PACKAGE_ID = '0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507';
    
    // Try to get environment-specific package ID from environment variables
    const envVarName = `WALIA_SEAL_PACKAGE_ID_${environment.toUpperCase()}`;
    const envSpecificId = process.env[envVarName];
    
    if (envSpecificId) {
      return envSpecificId;
    }
    
    // Fallback to generic environment variable
    const fallbackId = process.env.WALIA_SEAL_PACKAGE_ID;
    if (fallbackId) {
      return fallbackId;
    }
    
    // Final fallback to hardcoded default
    return DEFAULT_PACKAGE_ID;
  }

  private async initializeComponents(userName: string, walletsDir: string, environment: string): Promise<{
    walletManagement: WalletManagement;
    sealManager: SealManager;
    clientConfig: ClientConfig;
  }> {
    // Initialize wallet management
    const walletManagement = new WalletManagement(userName, walletsDir, environment as EnvironmentType);
    
    // Initialize seal manager
    const waliaSealPackageId = this.getWaliaSealPackageId(environment);
    const sealManager = new SealManager(walletManagement, waliaSealPackageId);
    
    // Set up client configuration
    const clientConfig: ClientConfig = {
      suiConfPath: path.join(walletManagement.getWalletDirectory(), 'sui_client.yaml'),
      walrusConfPath: path.join(walletManagement.getWalletDirectory(), 'walrus_client_config.yaml')
    };

    // Verify configuration files exist
    if (!fs.existsSync(clientConfig.suiConfPath)) {
      throw new Error(`Sui client configuration not found at: ${clientConfig.suiConfPath}`);
    }
    if (!fs.existsSync(clientConfig.walrusConfPath)) {
      throw new Error(`Walrus client configuration not found at: ${clientConfig.walrusConfPath}`);
    }

    return { walletManagement, sealManager, clientConfig };
  }

  private printUsage(): void {
    console.log(`
Walia Storage CLI - Command line interface for Walrus storage operations

Usage: walia-cli <command> <json-params>

Commands:
  store                   Store a file to Walrus with seal encryption
  read                    Read and decrypt a file from Walrus
  list-blobs              List all blobs in Walrus storage
  get-blob-attributes     Get attributes for a specific blob
  add-blob-attributes     Add attributes to a blob
  burn-blobs              Delete blobs from Walrus storage
  fund-shared-blob        Fund a shared blob with WAL tokens
  send-blob               Transfer a blob to another Sui address
  get-blob-object-id      Get blob object ID from blob ID
  get-wallet-balance      Get SUI and Walrus balance for a wallet

Common parameters (JSON format):
  {
    "userName": "walia",                    // Username for wallet management
    "walletsDir": "./dev-wallets",          // Directory path for wallets
    "environment": "testnet"                // Network environment (testnet, mainnet, localnet, devnet)
  }

Examples:
  # Store a file
  walia-cli store '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","filePath":"./test.txt","epochs":5,"deletable":false}'

  # Read a file
  walia-cli read '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobId":"abc123"}'

  # List blobs
  walia-cli list-blobs '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","includeExpired":false}'

  # Get blob attributes
  walia-cli get-blob-attributes '{"userName":"walia","walletsDir":"./dev-wallets","environment":"testnet","blobObjectId":"0x123..."}'
`);
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
      this.printUsage();
      process.exit(1);
    }

    const command = args[0];
    const jsonParams = args[1];

    if (!jsonParams) {
      console.error('Error: JSON parameters are required');
      this.printUsage();
      process.exit(1);
    }

    let params: any;
    try {
      params = JSON.parse(jsonParams);
    } catch (error) {
      console.error('Error: Invalid JSON parameters');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    try {
      await this.executeCommand(command, params);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  private async executeCommand(command: string, params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet' } = params;

    switch (command) {
      case 'store':
        await this.handleStore(params);
        break;
      case 'read':
        await this.handleRead(params);
        break;
      case 'list-blobs':
        await this.handleListBlobs(params);
        break;
      case 'get-blob-attributes':
        await this.handleGetBlobAttributes(params);
        break;
      case 'add-blob-attributes':
        await this.handleAddBlobAttributes(params);
        break;
      case 'burn-blobs':
        await this.handleBurnBlobs(params);
        break;
      case 'fund-shared-blob':
        await this.handleFundSharedBlob(params);
        break;
      case 'send-blob':
        await this.handleSendBlob(params);
        break;
      case 'get-blob-object-id':
        await this.handleGetBlobObjectId(params);
        break;
      case 'get-wallet-balance':
        await this.handleGetWalletBalance(params);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async handleStore(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', filePath, epochs, deletable = false, attributes = {} } = params;

    if (!filePath) {
      throw new Error('filePath is required');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    // Check wallet balance before proceeding with storage
    const balance = await walletManagement.getBalance();
    const suiBalance = parseFloat(balance.sui);
    const walBalance = parseFloat(balance.wal);

    const MIN_SUI_REQUIRED = 0.5;
    const MIN_WAL_REQUIRED = 0.5;

    if (suiBalance < MIN_SUI_REQUIRED || walBalance < MIN_WAL_REQUIRED) {
      const insufficientBalances = [];
      if (suiBalance < MIN_SUI_REQUIRED) {
        insufficientBalances.push(`SUI: ${balance.sui} (required: ${MIN_SUI_REQUIRED})`);
      }
      if (walBalance < MIN_WAL_REQUIRED) {
        insufficientBalances.push(`WAL: ${balance.wal} (required: ${MIN_WAL_REQUIRED})`);
      }

      throw new Error(
        `Insufficient balance to store file. Please top up your account.\n` +
        `Current balances: ${insufficientBalances.join(', ')}\n` +
        `Please ensure you have at least ${MIN_SUI_REQUIRED} SUI and ${MIN_WAL_REQUIRED} WAL tokens before storing files.`
      );
    }

    const blobParams: BlobParams = {
      clientConf: clientConfig,
      epochs,
      deletable,
      attributes
    };

    const result: StoreResult = await store(filePath, blobParams, sealManager);
    console.log(JSON.stringify(result, null, 2));
  }

  private async handleRead(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobId } = params;

    if (!blobId) {
      throw new Error('blobId is required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const blobParams: BlobParams = {
      clientConf: clientConfig
    };

    const filePath = await read(blobId, blobParams, sealManager);
    console.log(JSON.stringify({ filePath, message: `File decrypted and saved to: ${filePath}` }, null, 2));
  }

  private async handleListBlobs(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', includeExpired = false } = params;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const blobs: BlobObject[] = await list_blobs(clientConfig, includeExpired);
    console.log(JSON.stringify(blobs, null, 2));
  }

  private async handleGetBlobAttributes(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobObjectId } = params;

    if (!blobObjectId) {
      throw new Error('blobObjectId is required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const attributes: BlobAttributes = await get_blob_attributes(clientConfig, blobObjectId);
    console.log(JSON.stringify(attributes, null, 2));
  }

  private async handleAddBlobAttributes(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobObjectId, attributes } = params;

    if (!blobObjectId) {
      throw new Error('blobObjectId is required');
    }
    if (!attributes) {
      throw new Error('attributes are required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    await add_blob_attributes(clientConfig, blobObjectId, attributes);
    console.log(JSON.stringify({ message: `Attributes added successfully to blob: ${blobObjectId}` }, null, 2));
  }

  private async handleBurnBlobs(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobObjectIds, all_expired = false, all = false } = params;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const burnParams: BurnParams = {
      blobObjectIds,
      all_expired,
      all
    };

    await burnBlobs(clientConfig, burnParams);
    console.log(JSON.stringify({ message: 'Blobs burned successfully' }, null, 2));
  }

  private async handleFundSharedBlob(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', storageId, storageStartEpoch, storageEndEpoch, storageSize, amountWAL } = params;

    if (!storageId || !storageStartEpoch || !storageEndEpoch || !storageSize || !amountWAL) {
      throw new Error('storageId, storageStartEpoch, storageEndEpoch, storageSize, and amountWAL are required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const storage: StorageObject = {
      id: storageId,
      startEpoch: storageStartEpoch,
      endEpoch: storageEndEpoch,
      storageSize
    };

    await fundSharedBlob(clientConfig, storage, amountWAL);
    console.log(JSON.stringify({ message: `Shared blob funded successfully with ${amountWAL} WAL tokens` }, null, 2));
  }

  private async handleSendBlob(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobObjectId, destinationAddress } = params;

    if (!blobObjectId) {
      throw new Error('blobObjectId is required');
    }
    if (!destinationAddress) {
      throw new Error('destinationAddress is required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    await sendBlob(blobObjectId, destinationAddress, sealManager);
    console.log(JSON.stringify({ message: `Blob ${blobObjectId} sent successfully to ${destinationAddress}` }, null, 2));
  }

  private async handleGetBlobObjectId(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet', blobId } = params;

    if (!blobId) {
      throw new Error('blobId is required');
    }

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const objectId = await getBlobObjectIdByBlobId(blobId, clientConfig);
    
    if (!objectId) {
      throw new Error(`No blob object found for blob ID: ${blobId}`);
    }
    
    console.log(JSON.stringify({ blobId, objectId }, null, 2));
  }

  private async handleGetWalletBalance(params: any): Promise<void> {
    const { userName = 'walia', walletsDir = './dev-wallets', environment = 'testnet' } = params;

    const { walletManagement } = await this.initializeComponents(userName, walletsDir, environment);

    const balance = await walletManagement.getBalance();
    console.log(JSON.stringify(balance, null, 2));
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new WaliaCLI();
  cli.run().catch((error) => {
    console.error('CLI Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { WaliaCLI };