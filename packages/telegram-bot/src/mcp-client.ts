import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from 'path';
import * as readline from "node:readline";

export interface MCPToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface WalrusFileInfo {
  blobId?: string;
  objectId?: string;
  storageCost?: number;
  unencodedSize?: number;
  encodedSize?: number;
  encodingType?: string;
}

export interface BlobObject {
  id: string;
  blobId: string;
  storage: {
    id: string;
    startEpoch: number;
    endEpoch: number;
    storageSize: number;
  };
  certifiedEpoch: number;
  attributes: {
    original_name?: string;
    upload_timestamp?: string;
    whitelistId?: string;
    capId?: string;
  }
  deletable: boolean;
}

export class WaliaMCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  constructor() {
    this.client = new Client({
      name: 'walia-telegram-bot',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Note: Using 'as any' to bypass TypeScript type checking issues with MCP SDK
    // Changed to use shell command to handle directory change internally
    this.transport = new StdioClientTransport({
      command: 'sh',
      args: ['-c', 'cd ../walrus_mcp && npm run mcp-server']
    } as any);

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && this.transport) {
      await this.client.close();
      this.isConnected = false;
      this.transport = null;
    }
  }

  async listTools(): Promise<any> {
    await this.ensureConnected();
    // Note: Using 'as any' to bypass TypeScript type checking issues with MCP SDK
    // The request method expects 2-3 arguments but the single object format is correct
    return await (this.client.request as any)({
      method: 'tools/list',
      params: {}
    });
  }

  async storeFile(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    filePath: string;
    epochs?: number;
    deletable?: boolean;
    attributes?: Record<string, string>;
  }): Promise<WalrusFileInfo> {
    await this.ensureConnected();
    
    console.log('MCP Client: Calling walia_store with params:', params);
    
    try {
      const response = await (this.client.request as any)(
        {
          method: 'tools/call',
          params: {
            name: 'walia_store',
            arguments: params
          }
        },
        CallToolResultSchema
      ) as MCPToolResponse;

      console.log('MCP Client: storeFile - response:', response);
      return this.parseStorageResponse(response);
    } catch (error) {
      console.error('MCP Client: Error calling walia_store:', error);
      console.error('MCP Client: Error details:', error instanceof Error ? error.message : String(error));
      
      // Handle MCP errors specifically
      if (error && typeof error === 'object') {
        if ('code' in error && 'message' in error) {
          console.error('MCP Client: MCP Error code:', (error as any).code);
          console.error('MCP Client: MCP Error message:', (error as any).message);
        }
        
        if ('response' in error) {
          console.log('MCP Client: Error response:', (error as any).response);
        }
      }
      
      throw error;
    }
  }

  async readFile(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobId: string;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_read',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    const result = this.parseTextResponse(response);
    // Extract file path from response text like "File decrypted and saved to: /path/to/file"
    const match = result.match(/File decrypted and saved to: (.+)$/);
    const filePath = match ? match[1].trim() : result;
    console.log('MCP Client: readFile - filePath:', filePath);
    
    // Convert relative path to absolute path if needed
    return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  }

  async listBlobs(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    includeExpired?: boolean;
  }): Promise<BlobObject[]> {
    await this.ensureConnected();
    
    console.log('MCP Client: Calling walia_list_blobs with params:', params);
    
    try {
      // Workaround for MCP SDK bug: pass an explicit empty resultSchema as the second argument
      const response = await (this.client.request as any)(
        {
          method: 'tools/call',
          params: {
            name: 'walia_list_blobs',
            arguments: params
          }
        },
        CallToolResultSchema
      ) as MCPToolResponse;

      console.log('MCP Client: Received response:', response);
      return this.parseBlobListResponse(response);
    } catch (error) {
      console.error('MCP Client: Error calling walia_list_blobs:', error);
      console.error('MCP Client: Error details:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getBlobAttributes(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobObjectId: string;
  }): Promise<Record<string, string>> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_get_blob_attributes',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    return this.parseAttributesResponse(response);
  }

  async addBlobAttributes(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobObjectId: string;
    attributes: Record<string, string>;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_add_blob_attributes',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    return this.parseTextResponse(response);
  }

  async burnBlobs(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobObjectIds?: string[];
    all_expired?: boolean;
    all?: boolean;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_burn_blobs',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    return this.parseTextResponse(response);
  }

  async sendBlob(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobObjectId: string;
    destinationAddress: string;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_send_blob',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    return this.parseTextResponse(response);
  }

  async getBlobObjectId(params: {
    userName: string;
    walletsDir: string;
    environment: string;
    blobId: string;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_get_blob_object_id',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    const result = this.parseTextResponse(response);
    // Extract object ID from response text
    const match = result.match(/Blob object ID: (0x[a-fA-F0-9]+)/);
    return match ? match[1] : '';
  }

  async getWalletAddress(params: {
    userName: string;
    walletsDir: string;
    environment: string;
  }): Promise<string> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_get_wallet_address',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    console.log('MCP Client: getWalletAddress - response:', response);
    const result = this.parseTextResponse(response);
    // Extract address from response text
    const match = result.match(/Wallet address for user .+: (0x[a-fA-F0-9]+)/);
    return match ? match[1] : '';
  }

  async getWalletBalance(params: {
    userName: string;
    walletsDir: string;
    environment: string;
  }): Promise<{ sui: string; wal: string }> {
    await this.ensureConnected();
    
    const response = await (this.client.request as any)(
      {
        method: 'tools/call',
        params: {
          name: 'walia_get_wallet_balance',
          arguments: params
        }
      },
      CallToolResultSchema
    ) as MCPToolResponse;

    console.log('MCP Client: getWalletBalance - response:', response);
    const result = this.parseTextResponse(response);
    try {
      return JSON.parse(result);
    } catch (error) {
      console.error('MCP Client: getWalletBalance - Failed to parse balance response:', error);
      return { sui: '0', wal: '0' };
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  private parseTextResponse(response: MCPToolResponse): string {
    console.log('MCP Client: parseTextResponse - response:', response);
    console.log('MCP Client: parseTextResponse - response.content:', response?.content);
    
    if (response && response.content && response.content.length > 0) {
      console.log('MCP Client: parseTextResponse - content[0]:', response.content[0]);
      return response.content[0].text;
    }
    console.warn('MCP Client: parseTextResponse - returning empty string due to invalid response structure');
    return '';
  }

  private parseStorageResponse(response: MCPToolResponse): WalrusFileInfo {
    console.log('MCP Client: parseStorageResponse - response type:', typeof response);
    console.log('MCP Client: parseStorageResponse - response:', response);
    
    const text = this.parseTextResponse(response);
    console.log('MCP Client: parseStorageResponse - text:', text);
    
    try {
      const parsed = JSON.parse(text);
      console.log('MCP Client: parseStorageResponse - parsed JSON:', parsed);
      return parsed;
    } catch (error) {
      console.error('MCP Client: parseStorageResponse - Failed to parse JSON:', error);
      console.error('MCP Client: parseStorageResponse - Raw text that failed to parse:', text);
      return {};
    }
  }

  private parseBlobListResponse(response: MCPToolResponse): BlobObject[] {
    console.log('MCP Client: parseBlobListResponse - response type:', typeof response);
    console.log('MCP Client: parseBlobListResponse - response:', response);
    
    const text = this.parseTextResponse(response);
    console.log('MCP Client: parseBlobListResponse - extracted text:', text);
    
    try {
      const parsed = JSON.parse(text);
      console.log('MCP Client: parseBlobListResponse - successfully parsed:', parsed);
      return parsed;
    } catch (error) {
      console.error('Failed to parse blob list response:', error);
      console.error('Text that failed to parse:', text);
      return [];
    }
  }

  private parseAttributesResponse(response: MCPToolResponse): Record<string, string> {
    const text = this.parseTextResponse(response);
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse attributes response:', error);
      return {};
    }
  }
}