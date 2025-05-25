import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { BlobObject, list_blobs } from "@walia/storage";
import { WalletManagement } from "@walia/wallet-management";

interface WalrusContext {
    walletExists: boolean;
    walletAddress: string;
    walletBalance?: {
        sui: string;
        wal: string;
    };
    blobObjects: Array<{
        id: string;
        blobId: string;
        objectId: string;
        name: string;
        size: number;
        encodingType: string;
        registeredEpoch: number;
        endEpoch: number;
        whitelistId: string;
        formattedSize?: string;
        timestamp?: string;
        isExpired?: boolean;
        endDate?: string;
    }>;
    totalBlobs: number;
    storageUsed: number;
}

// Helper function to format bytes (fallback if not available from storage module)
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Function to create formatted output from cached context
export async function getWalrusContextFormatted(runtime: IAgentRuntime, userId: string, agentId: string): Promise<string> {
    try {
        const cachedContext = await runtime.cacheManager.get(`${agentId}-${userId}-ctx`) as string;
        
        if (!cachedContext) {
            return `
🔍 **WALRUS STORAGE STATUS**

❌ **No wallet information available**
- Please interact with the assistant to initialize your Walrus storage context
- The assistant will automatically check your wallet and storage status
`;
        }

        const context = JSON.parse(cachedContext) as WalrusContext & { error?: string };
        
        if (context.error) {
            return `
🔍 **WALRUS STORAGE STATUS**

❌ **Error retrieving wallet information**
- Error: ${context.error}
- Suggested actions:
  - Check wallet configuration
  - Ensure Sui CLI is properly installed
  - Try creating a new wallet
`;
        }

        const baseDir = process.env.WALIA_WALLET_BASE_DIR || process.env.ELIZA_WALLET_DIR || "./wallets";
        
        return `
🔍 **WALRUS STORAGE STATUS**

💰 **Wallet Information**
${context.walletExists ? '✅' : '❌'} Wallet Status: ${context.walletExists ? 'Active' : 'Not Found'}
📍 Address: ${context.walletAddress || 'N/A'}
💎 SUI Balance: ${context.walletBalance?.sui || '0'} SUI
🪙 WAL Balance: ${context.walletBalance?.wal || '0'} WAL

📦 **Storage Overview**
📊 Total Blobs: ${context.totalBlobs}
💾 Storage Used: ${formatBytes(context.storageUsed)}

${context.blobObjects.length > 0 ? `
🗃️ **Your Blob Objects**
${context.blobObjects.map((blob, index) => {
    const status = blob.isExpired ? '❌ Expired' : '✅ Active';
    const size = blob.formattedSize || formatBytes(blob.size);
    const expiry = blob.endDate && blob.endDate !== 'Unknown' ? ` | Expires: ${blob.endDate}` : '';
    
    return `${index + 1}. **${blob.name}**
   🔗 ID: \`${blob.id}\`
   🔗 BlobID: \`${blob.blobId}\`
   📏 Size: ${size} (${blob.encodingType})
   ⏰ ${blob.timestamp || `Epoch ${blob.registeredEpoch}`}
   ${status}${expiry}`;
}).join('\n\n')}` : `
🗃️ **Your Blob Objects**
📭 No blob objects found
   - Start by storing your first file to Walrus
   - Use the assistant to help with file storage operations`}

${context.walletExists 
    ? `
🚀 **Ready for Operations**
Your wallet is operational and ready for Walrus storage operations including:
• Store new files with automatic encryption
• Retrieve and decrypt existing files  
• Manage blob attributes and permissions
• Transfer blobs to other users
• Check storage costs and fund blobs`
    : `
⚠️ **Setup Required**
Wallet needs to be created or configured:
• Assistant can help create a new wallet
• Ensure proper Sui CLI configuration
• Set up Walrus client configuration`
}
`;
    } catch (error) {
        console.error("Error formatting Walrus context:", error);
        return `
🔍 **WALRUS STORAGE STATUS**

❌ **Error formatting storage information**
- Error: ${error instanceof Error ? error.message : "Unknown error"}
- Please try refreshing the context by asking about your storage status
`;
    }
}

export const walrusProvider: Provider = {
    get: async function(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<void> {
        try {
            // Get user identifier from message
            const userId = message.userId;
            
            // Get base directory from environment variable or use default
            const baseDir = process.env.WALIA_WALLET_BASE_DIR || process.env.ELIZA_WALLET_DIR || "./wallets";
            
            const context: WalrusContext = {
                walletExists: false,
                walletAddress: '',
                blobObjects: [],
                totalBlobs: 0,
                storageUsed: 0
            };

            // Try to ensure wallet exists using WalletManagement
            try {
                const walletManager = new WalletManagement(userId, baseDir);
                const walletInfo = await walletManager.ensureWallet();
                
                context.walletExists = true;
                context.walletAddress = walletInfo.address;
                
                // Get wallet balance
                const balance = await walletManager.getBalance();
                context.walletBalance = balance;
                
                console.log(`Wallet verified for ${userId}: ${walletInfo.address}`);
            } catch (error) {
                console.log(`Failed to create/verify wallet for ${userId}:`, error);
                context.walletExists = false;
            }

            // Try to get blob objects if wallet exists
            if (context.walletExists && context.walletAddress) {
                try {
                    const walletManager = new WalletManagement(userId, baseDir);
                    const userEnv = walletManager.getUserEnvironment();
                    
                    // Get blob objects using list_blobs function
                    const blobObjects = await list_blobs(userEnv);
                    
                    context.blobObjects = blobObjects.map((blob: BlobObject) => ({
                        id: blob.id,
                        blobId: blob.blobId,
                        objectId: blob.id,
                        size: blob.size,
                        encodingType: blob.encodingType,
                        registeredEpoch: blob.registeredEpoch,
                        endEpoch: blob.endEpoch || 0,
                        whitelistId: blob.whitelistId || '',
                        name: blob.name || `Blob-${blob.blobId.slice(0, 8)}`,
                        formattedSize: blob.formattedSize,
                        timestamp: blob.timestamp,
                        isExpired: blob.isExpired,
                        endDate: blob.endDate
                    }));
                    
                    context.totalBlobs = blobObjects.length;
                    context.storageUsed = blobObjects.reduce((total: number, blob: BlobObject) => total + blob.size, 0);
                } catch (error) {
                    console.log(`Failed to fetch blob objects:`, error);
                }
            }
            const waliaCtx = JSON.stringify(context); 
            await runtime.cacheManager.set(`${message.agentId}-${message.userId}-ctx`, waliaCtx);
        } catch (error) {
            console.error("Error in Walrus provider:", error);
            // Store error context in cache
            const errorContext = {
                walletExists: false,
                walletAddress: '',
                blobObjects: [],
                totalBlobs: 0,
                storageUsed: 0,
                error: error instanceof Error ? error.message : "Unknown error"
            };
            await runtime.cacheManager.set(`${message.agentId}-${message.userId}-ctx`, JSON.stringify(errorContext));
        }
    }
}; 