#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

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
import * as path from 'path';
import * as fs from 'fs';

class WaliaStorageMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'walia-storage-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private getEnvironmentConfig(): { walletsDir: string; environment: string } {
    const walletsDir = process.env.WALLET_DIR || process.env.WALIA_WALLETS_DIR;
    const environment = process.env.WALLET_ENV;
    
    if (!walletsDir) {
      throw new Error('WALLET_DIR or WALIA_WALLETS_DIR environment variable is required');
    }
    
    if (!environment) {
      throw new Error('WALLET_ENV environment variable is required');
    }

    if (!['testnet', 'mainnet', 'localnet', 'devnet'].includes(environment)) {
      throw new Error(`Invalid WALLET_ENV: ${environment}. Must be one of: testnet, mainnet, localnet, devnet`);
    }

    return { walletsDir, environment };
  }

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
    // if (!fs.existsSync(clientConfig.suiConfPath)) {
    //   throw new Error(`Sui client configuration not found at: ${clientConfig.suiConfPath}`);
    // }
    // if (!fs.existsSync(clientConfig.walrusConfPath)) {
    //   throw new Error(`Walrus client configuration not found at: ${clientConfig.walrusConfPath}`);
    // }

    return { walletManagement, sealManager, clientConfig };
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'walia_store',
          description: 'Store a file to Walrus with seal encryption',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              filePath: {
                type: 'string',
                description: 'Path to the file to store'
              },
              epochs: {
                type: 'number',
                description: 'Number of epochs to store the file'
              },
              deletable: {
                type: 'boolean',
                description: 'Whether the blob should be deletable',
                default: false
              },
              attributes: {
                type: 'object',
                description: 'Additional attributes to store with the blob',
                additionalProperties: {
                  type: 'string'
                }
              }
            },
            required: ['userName', 'filePath']
          },
        },
        {
          name: 'walia_read',
          description: 'Read and decrypt a file from Walrus',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobId: {
                type: 'string',
                description: 'Blob ID to read'
              }
            },
            required: ['userName', 'blobId']
          },
        },
        {
          name: 'walia_list_blobs',
          description: 'List all blobs in Walrus storage',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              includeExpired: {
                type: 'boolean',
                description: 'Whether to include expired blobs',
                default: false
              }
            },
            required: ['userName']
          },
        },
        {
          name: 'walia_get_blob_attributes',
          description: 'Get attributes for a specific blob',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobObjectId: {
                type: 'string',
                description: 'Blob object ID'
              }
            },
            required: ['userName', 'blobObjectId']
          },
        },
        {
          name: 'walia_add_blob_attributes',
          description: 'Add attributes to a blob',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobObjectId: {
                type: 'string',
                description: 'Blob object ID'
              },
              attributes: {
                type: 'object',
                description: 'Attributes to add',
                additionalProperties: {
                  type: 'string'
                }
              }
            },
            required: ['userName', 'blobObjectId', 'attributes']
          },
        },
        {
          name: 'walia_burn_blobs',
          description: 'Delete blobs from Walrus storage',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobObjectIds: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Array of blob object IDs to delete'
              },
              all_expired: {
                type: 'boolean',
                description: 'Delete all expired blobs',
                default: false
              },
              all: {
                type: 'boolean',
                description: 'Delete all blobs',
                default: false
              }
            },
            required: ['userName']
          },
        },
        {
          name: 'walia_fund_shared_blob',
          description: 'Fund a shared blob with WAL tokens',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              storageId: {
                type: 'string',
                description: 'Storage object ID'
              },
              storageStartEpoch: {
                type: 'number',
                description: 'Storage start epoch'
              },
              storageEndEpoch: {
                type: 'number',
                description: 'Storage end epoch'
              },
              storageSize: {
                type: 'number',
                description: 'Storage size'
              },
              amountWAL: {
                type: 'number',
                description: 'Amount of WAL tokens to fund'
              }
            },
            required: ['userName', 'storageId', 'storageStartEpoch', 'storageEndEpoch', 'storageSize', 'amountWAL']
          },
        },
        {
          name: 'walia_send_blob',
          description: 'Transfer a blob to another Sui address',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobObjectId: {
                type: 'string',
                description: 'Blob object ID to send'
              },
              destinationAddress: {
                type: 'string',
                description: 'Destination Sui address'
              }
            },
            required: ['userName', 'blobObjectId', 'destinationAddress']
          },
        },
        {
          name: 'walia_get_blob_object_id',
          description: 'Get blob object ID from blob ID',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              },
              blobId: {
                type: 'string',
                description: 'Blob ID'
              }
            },
            required: ['userName', 'blobId']
          },
        },
        {
          name: 'walia_get_wallet_balance',
          description: 'Get SUI and Walrus balance for a wallet',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              }
            },
            required: ['userName']
          },
        },
        {
          name: 'walia_get_wallet_address',
          description: 'Get the wallet address for a user',
          inputSchema: {
            type: 'object',
            properties: {
              userName: {
                type: 'string',
                description: 'Username for wallet management'
              }
            },
            required: ['userName']
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      console.log('MCP Server: Received request:', { name, args });

      try {
        let result;
        switch (name) {
          case 'walia_store':
            result = await this.handleStore(args);
            break;
          case 'walia_read':
            result = await this.handleRead(args);
            break;
          case 'walia_list_blobs':
            result = await this.handleListBlobs(args);
            break;
          case 'walia_get_blob_attributes':
            result = await this.handleGetBlobAttributes(args);
            break;
          case 'walia_add_blob_attributes':
            result = await this.handleAddBlobAttributes(args);
            break;
          case 'walia_burn_blobs':
            result = await this.handleBurnBlobs(args);
            break;
          case 'walia_fund_shared_blob':
            result = await this.handleFundSharedBlob(args);
            break;
          case 'walia_send_blob':
            result = await this.handleSendBlob(args);
            break;
          case 'walia_get_blob_object_id':
            result = await this.handleGetBlobObjectId(args);
            break;
          case 'walia_get_wallet_balance':
            result = await this.handleGetWalletBalance(args);
            break;
          case 'walia_get_wallet_address':
            result = await this.handleGetWalletAddress(args);
            break;
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
        
        console.log('MCP Server: Returning result:', result);
        return result;
      } catch (error) {
        console.error('MCP Server: Request handler caught error:', error);
        
        // Handle MCP errors properly
        if (error instanceof McpError) {
          throw error;
        }
        
        // Convert regular errors to MCP errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('MCP Server: Error message:', errorMessage);
        
        throw new McpError(
          ErrorCode.InternalError,
          errorMessage
        );
      }
    });
  }



  private async handleStore(args: any) {
    console.log('MCP Server: handleStore called with args:', args);
    
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, filePath, epochs, deletable = false, attributes = {} } = args;

    console.log('MCP Server: handleStore - parsed params:', {
      userName,
      walletsDir,
      environment,
      filePath,
      epochs,
      deletable,
      attributes
    });

    // Validate required parameters
    if (!userName) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'userName is required'
      );
    }
    
    if (!filePath) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'filePath is required'
      );
    }

    console.log('MCP Server: handleStore - Current working directory:', process.cwd());
    console.log('MCP Server: handleStore - Checking file existence:', filePath);
    console.log('MCP Server: handleStore - File exists?', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      console.error('MCP Server: handleStore - File not found:', filePath);
      throw new McpError(
        ErrorCode.InvalidParams,
        `File not found: ${filePath}`
      );
    }

    console.log('MCP Server: handleStore - File exists, initializing components');

    try {
      const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

      console.log('MCP Server: handleStore - Components initialized, checking balance');

      // Check wallet balance before proceeding with storage
      const balance = await walletManagement.getBalance();
      console.log('MCP Server: handleStore - Current balance:', balance);
      
      const suiBalance = parseFloat(balance.sui);
      const walBalance = parseFloat(balance.wal);

      const MIN_SUI_REQUIRED = 0.3;
      const MIN_WAL_REQUIRED = 0.3;

      if (suiBalance < MIN_SUI_REQUIRED || walBalance < MIN_WAL_REQUIRED) {
        const insufficientBalances = [];
        if (suiBalance < MIN_SUI_REQUIRED) {
          insufficientBalances.push(`SUI: ${balance.sui} (required: ${MIN_SUI_REQUIRED})`);
        }
        if (walBalance < MIN_WAL_REQUIRED) {
          insufficientBalances.push(`WAL: ${balance.wal} (required: ${MIN_WAL_REQUIRED})`);
        }

        const errorMessage = 
          `Insufficient balance to store file. Please top up your account.\n` +
          `Current balances: ${insufficientBalances.join(', ')}\n` +
          `Please ensure you have at least ${MIN_SUI_REQUIRED} SUI and ${MIN_WAL_REQUIRED} WAL tokens before storing files.`;
        
        console.error('MCP Server: handleStore - Insufficient balance:', errorMessage);
        throw new McpError(
          ErrorCode.InvalidParams,
          errorMessage
        );
      }

      console.log('MCP Server: handleStore - Balance check passed, preparing blob params');

      const blobParams: BlobParams = {
        clientConf: clientConfig,
        epochs,
        deletable,
        attributes
      };

      console.log('MCP Server: handleStore - Calling store function');
      
      const result: StoreResult = await store(filePath, blobParams, sealManager);

      console.log('MCP Server: handleStore - Store function completed, result:', result);

      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };

      console.log('MCP Server: handleStore - Returning response:', response);
      return response;
    } catch (error) {
      console.error('MCP Server: handleStore - Error during execution:', error);
      if (error instanceof Error) {
        console.error('MCP Server: handleStore - Error name:', error.name);
        console.error('MCP Server: handleStore - Error message:', error.message);
        console.error('MCP Server: handleStore - Error stack:', error.stack);
      }
      
      // If it's already an MCP error, rethrow it
      if (error instanceof McpError) {
        throw error;
      }
      
      // Convert regular errors to MCP errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        errorMessage
      );
    }
  }

  private async handleRead(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobId } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const blobParams: BlobParams = {
      clientConf: clientConfig
    };

    const filePath = await read(blobId, blobParams, sealManager);

    return {
      content: [
        {
          type: 'text',
          text: filePath,
        },
      ],
    };
  }

  private async handleListBlobs(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, includeExpired = false } = args;

    console.error('userName:', userName);
    console.log('walletsDir:', walletsDir);
    console.log('environment:', environment);
    console.log('includeExpired:', includeExpired);

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    console.log('walletManagement:', walletManagement);
    console.log('clientConfig:', clientConfig);

    const blobs: BlobObject[] = await list_blobs(clientConfig, includeExpired);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(blobs, null, 2),
        },
      ],
    };
  }

  private async handleGetBlobAttributes(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobObjectId } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const attributes: BlobAttributes = await get_blob_attributes(clientConfig, blobObjectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(attributes, null, 2),
        },
      ],
    };
  }

  private async handleAddBlobAttributes(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobObjectId, attributes } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    await add_blob_attributes(clientConfig, blobObjectId, attributes);

    return {
      content: [
        {
          type: 'text',
          text: `Attributes added successfully to blob: ${blobObjectId}`,
        },
      ],
    };
  }

  private async handleBurnBlobs(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobObjectIds, all_expired = false, all = false } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const burnParams: BurnParams = {
      blobObjectIds,
      all_expired,
      all
    };

    await burnBlobs(clientConfig, burnParams);

    return {
      content: [
        {
          type: 'text',
          text: 'Blobs burned successfully',
        },
      ],
    };
  }

  private async handleFundSharedBlob(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, storageId, storageStartEpoch, storageEndEpoch, storageSize, amountWAL } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const storage: StorageObject = {
      id: storageId,
      startEpoch: storageStartEpoch,
      endEpoch: storageEndEpoch,
      storageSize
    };

    await fundSharedBlob(clientConfig, storage, amountWAL);

    return {
      content: [
        {
          type: 'text',
          text: `Shared blob funded successfully with ${amountWAL} WAL tokens`,
        },
      ],
    };
  }

  private async handleSendBlob(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobObjectId, destinationAddress } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    await sendBlob(blobObjectId, destinationAddress, sealManager);

    return {
      content: [
        {
          type: 'text',
          text: `Blob ${blobObjectId} sent successfully to ${destinationAddress}`,
        },
      ],
    };
  }

  private async handleGetBlobObjectId(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName, blobId } = args;

    const { walletManagement, sealManager, clientConfig } = await this.initializeComponents(userName, walletsDir, environment);

    const objectId = await getBlobObjectIdByBlobId(blobId, clientConfig);

    return {
      content: [
        {
          type: 'text',
          text: objectId ? `Blob object ID: ${objectId}` : `No blob object found for blob ID: ${blobId}`,
        },
      ],
    };
  }

  private async handleGetWalletBalance(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName } = args;

    const { walletManagement } = await this.initializeComponents(userName, walletsDir, environment);

    const balance = await walletManagement.getBalance();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(balance, null, 2),
        },
      ],
    };
  }

  private async handleGetWalletAddress(args: any) {
    const { walletsDir, environment } = this.getEnvironmentConfig();
    const { userName } = args;

    const { walletManagement } = await this.initializeComponents(userName, walletsDir, environment);

    const address = await walletManagement.getWalletAddress();

    return {
      content: [
        {
          type: 'text',
          text: `Wallet address for user ${userName}: ${address}`,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Walia Storage MCP Server running on stdio');
  }
}

const server = new WaliaStorageMCPServer();
server.run().catch(console.error);