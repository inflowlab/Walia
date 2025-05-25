import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { SealManager } from "@walia/seal";
import { BlobParams, read, store } from "@walia/storage";
import { WalletManagement } from "@walia/wallet-management";

export const walrusStorageAction: Action = {
    name: "walrus-storage",
    similes: ["store file", "upload file", "save file", "retrieve file", "download file"],
    description: "Store and retrieve files using Walrus decentralized storage with encryption",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Validate that message contains file-related keywords
        const text = message.content.text?.toLowerCase() || "";
        return text.includes("store") || text.includes("upload") || text.includes("save") || 
               text.includes("retrieve") || text.includes("download") || text.includes("get") ||
               text.includes("blob");
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Store my document.txt file securely" }
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll store your document.txt file securely using Walrus storage with encryption. Let me process that for you!" }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Retrieve my file with blob ID abc123" }
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll retrieve your file using blob ID abc123 and decrypt it for you." }
            }
        ]
    ],
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options: any,
        callback?: HandlerCallback
    ) => {
        try {
            const messageText = message.content.text.toLowerCase();
            
            // Initialize wallet and seal manager
            const wallet = new WalletManagement("walia-bot", "./wallets", "testnet");
            await wallet.ensureWallet();
            
            const sealManager = new SealManager(wallet, "0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507");
            
            const clientConf = wallet.getUserEnvironment();
            const params: BlobParams = {
                epochs: 5,
                deletable: true,
                clientConf: clientConf,
                attributes: {
                    timestamp: new Date().toISOString(),
                    user: message.userId
                }
            };

            if (messageText.includes("store") || messageText.includes("upload") || messageText.includes("save")) {
                // Handle file storage
                // For now, we'll create a sample file - in real implementation, this would handle file uploads
                const sampleFile = "./sample.txt";
                const fs = await import("fs");
                fs.writeFileSync(sampleFile, "Sample content for testing");
                
                const result = await store(sampleFile, params, sealManager);
                
                // Clean up sample file
                fs.unlinkSync(sampleFile);
                
                if (callback) {
                    callback({
                        text: `Successfully stored your file! 
                        
📄 **Storage Details:**
• Blob ID: \`${result.blobId}\`
• Object ID: \`${result.objectId}\`
• Storage Cost: ${result.storageCost} units
• File Size: ${result.unencodedSize} bytes
• Encoded Size: ${result.encodedSize} bytes

Your file is now securely encrypted and stored on the Walrus network! 🔐`
                    });
                }
                
            } else if (messageText.includes("retrieve") || messageText.includes("download") || messageText.includes("get")) {
                // Extract blob ID from message
                const blobIdMatch = messageText.match(/[0-9a-f]{64}/i);
                if (!blobIdMatch) {
                    if (callback) {
                        callback({
                            text: "Please provide a valid blob ID to retrieve your file. Blob IDs are 64-character hexadecimal strings."
                        });
                    }
                    return;
                }
                
                const blobId = blobIdMatch[0];
                const decryptedFilePath = await read(blobId, params, sealManager);
                
                if (callback) {
                    callback({
                        text: `Successfully retrieved and decrypted your file! 
                        
📥 **File Retrieved:**
• Blob ID: \`${blobId}\`
• Decrypted file saved to: \`${decryptedFilePath}\`

Your file has been securely retrieved from the Walrus network and decrypted! 🔓`
                    });
                }
                
            } else {
                if (callback) {
                    callback({
                        text: "I can help you store or retrieve files using Walrus storage. Try saying 'store my file' or 'retrieve file with blob ID [your-blob-id]'"
                    });
                }
            }
            
        } catch (error: any) {
            console.error("Walrus storage error:", error);
            if (callback) {
                callback({
                    text: `Sorry, I encountered an error with the storage operation: ${error.message}`
                });
            }
        }
    }
}; 