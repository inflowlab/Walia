import * as fs from "fs";
import * as path from "path";
import { Action, Content, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { SealManager } from "@walia/seal";
import { getDataDir, read } from "@walia/storage";
import { WalletManagement } from "@walia/wallet-management";

console.log("🔧 Loading read blob action module...");

export const readBlobAction: Action = {
    name: "READ_BLOB",
    similes: [
        "RETRIEVE_BLOB",
        "GET_BLOB",
        "FETCH_BLOB",
        "DOWNLOAD_BLOB",
        "READ_FILE",
        "GET_NOTE",
        "RETRIEVE_NOTE"
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("🔍 READ_BLOB Action - Validate called");
        console.log("👤 User ID:", message.userId);
        console.log("🕐 Timestamp:", new Date().toISOString());
        console.log("📨 Message text:", message.content.text);
        
        const text = message.content.text?.toLowerCase().trim() || "";
        const keywords = [
            "read blob",
            "retrieve blob", 
            "get blob",
            "fetch blob",
            "download blob",
            "read file",
            "get note",
            "retrieve note",
            "show blob"
        ];
        
        // Check if message contains blob ID patterns (hex strings)
        const blobIdPattern = /\b0x[a-fA-F0-9]{8,}\b|\b[a-fA-F0-9]{8,}\b/;
        const hasBlobId = blobIdPattern.test(text);
        
        // Check for read/retrieve keywords
        const hasKeywords = keywords.some(keyword => text.includes(keyword));
        
        console.log("🔗 Has blob ID pattern:", hasBlobId);
        console.log("💬 Has keywords:", hasKeywords);
        console.log("✅ Validation result:", hasBlobId || hasKeywords);
        
        return hasBlobId || hasKeywords;
    },
    description: "Read and retrieve blob content from Walrus storage",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        console.log("🚀 READ_BLOB Action - Handler started");
        console.log("👤 User ID:", message.userId);
        console.log("🤖 Agent ID:", message.agentId);
        
        try {
            const userId = message.userId;
            const baseDir = process.env.WALIA_WALLET_BASE_DIR || process.env.ELIZA_WALLET_DIR || "./wallets";
            
            console.log("📁 Base directory:", baseDir);
            console.log("👤 Processing for user:", userId);
            
            // Extract blob ID from message
            const messageText = message.content.text?.trim() || "";
            console.log("📨 Full message:", messageText);
            
            // Try to find blob ID in the message
            const blobIdPatterns = [
                /\b(0x[a-fA-F0-9]{64,})\b/,  // Full hex with 0x prefix
                /\b([a-fA-F0-9]{64,})\b/,     // Full hex without 0x
                /\b(0x[a-fA-F0-9]{16,})\b/,  // Partial hex with 0x
                /\b([a-fA-F0-9]{16,})\b/      // Partial hex without 0x
            ];
            
            let blobId: string | null = null;
            
            for (const pattern of blobIdPatterns) {
                const match = messageText.match(pattern);
                if (match) {
                    blobId = match[1];
                    // Ensure it starts with 0x
                    if (!blobId.startsWith('0x')) {
                        blobId = '0x' + blobId;
                    }
                    break;
                }
            }
            
            if (!blobId) {
                console.log("❌ No blob ID found in message");
                if (callback) {
                    callback({
                        text: `❌ **No Blob ID Found**

Please provide a blob ID to retrieve. You can use:

🔗 **Full blob ID:** \`0x1234567890abcdef...\`
🔗 **Partial blob ID:** \`1234567890abcdef\` or \`0x1234567890abcdef\`

**Usage Examples:**
• \`read blob 0x1234567890abcdef\`
• \`retrieve blob 1234567890abcdef\` 
• \`get note 0x1234567890abcdef\`
• \`show blob content 1234567890abcdef\`

💡 **Find your blob IDs with:** "show my storage status"`,
                        source: "read-blob"
                    });
                }
                return;
            }
            
            console.log("🔗 Extracted blob ID:", blobId);
            
            // Initialize wallet
            console.log("🔑 Initializing wallet...");
            const wallet = new WalletManagement(userId, baseDir);
            await wallet.ensureWallet();
            
            // Create user-specific temp directory for downloads
            const userDataDir = getDataDir(wallet);
            const tempDir = path.resolve(path.join(userDataDir, "temp"));
            console.log("📂 Temp directory:", tempDir);
            
            if (!fs.existsSync(tempDir)) {
                console.log("📁 Creating temp directory...");
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            try {
                console.log("🐋 Retrieving blob from Walrus...");
                console.log("🔐 Initializing Seal manager for decryption...");
                const sealManager = new SealManager(wallet, "0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507");
                
                const clientConf = wallet.getUserEnvironment();
                const params = {
                    clientConf: clientConf
                };
                
                // Try to retrieve the blob
                const retrievedFilePath = await read(blobId, params, sealManager);
                console.log("✅ Blob retrieved successfully!");
                console.log("📁 Retrieved file path:", retrievedFilePath);
                
                // Check if file exists and read content
                if (!fs.existsSync(retrievedFilePath)) {
                    throw new Error("Retrieved file not found");
                }
                
                const fileStats = fs.statSync(retrievedFilePath);
                const fileSize = fileStats.size;
                
                console.log("📏 File size:", fileSize);
                
                // Try to read as text first (for notes and text files)
                let content = "";
                let isTextFile = false;
                
                try {
                    content = fs.readFileSync(retrievedFilePath, 'utf8');
                    // Check if it's likely text content (no null bytes in first 1024 chars)
                    const sample = content.substring(0, 1024);
                    isTextFile = !sample.includes('\0') && /^[\x20-\x7E\s]*$/.test(sample);
                } catch (error) {
                    console.log("📄 Could not read as text, treating as binary");
                    isTextFile = false;
                }
                
                // Clean up temp file
                fs.unlinkSync(retrievedFilePath);
                console.log("🗑️ Cleaned up temp file");
                
                if (callback) {
                    if (isTextFile && content.length > 0) {
                        // Display text content
                        const preview = content.length > 500 ? content.substring(0, 500) + "..." : content;
                        
                        callback({
                            text: `✅ **Blob Retrieved Successfully!**

🔗 **Blob ID:** \`${blobId.slice(0, 16)}...\`
📏 **File Size:** ${formatBytes(fileSize)}
📄 **Content Type:** Text/Note

📝 **Content:**
\`\`\`
${preview}
\`\`\`

${content.length > 500 ? `💡 **Note:** Showing first 500 characters. Full content is ${content.length} characters.` : ""}

🌐 **Retrieved from Walrus decentralized storage**`,
                            source: "read-blob"
                        });
                    } else {
                        // Binary or encrypted file
                        callback({
                            text: `✅ **Blob Retrieved Successfully!**

🔗 **Blob ID:** \`${blobId.slice(0, 16)}...\`
📏 **File Size:** ${formatBytes(fileSize)}
📄 **Content Type:** Binary/Encrypted

🔐 **This appears to be a binary or encrypted file.**

💡 **Options:**
• If this is an encrypted file, it may have been automatically decrypted
• Binary files cannot be displayed as text
• The file was successfully retrieved from Walrus storage

🌐 **Retrieved from Walrus decentralized storage**`,
                            source: "read-blob"
                        });
                    }
                }
                
            } catch (retrieveError) {
                console.error("❌ Failed to retrieve blob:", retrieveError);
                
                // Try to get more specific error information
                let errorMessage = retrieveError instanceof Error ? retrieveError.message : "Unknown error";
                let suggestions = "";
                
                if (errorMessage.includes("not found") || errorMessage.includes("404")) {
                    suggestions = `
💡 **Possible Solutions:**
• Check if the blob ID is correct and complete
• The blob may have expired or been deleted
• Verify you have access permissions to this blob
• Try with the full blob ID if using a partial one`;
                } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
                    suggestions = `
💡 **Network Issue:**
• Check your internet connection
• Walrus network may be temporarily unavailable
• Try again in a few moments`;
                } else if (errorMessage.includes("decrypt") || errorMessage.includes("seal")) {
                    suggestions = `
💡 **Decryption Issue:**
• You may not have access to decrypt this blob
• The blob might be encrypted for different users
• Check if you're using the correct wallet/account`;
                }
                
                if (callback) {
                    callback({
                        text: `❌ **Failed to Retrieve Blob**

🔗 **Blob ID:** \`${blobId.slice(0, 16)}...\`
❌ **Error:** ${errorMessage}

${suggestions}

🔧 **Try Again:**
• Use "show my storage status" to see your accessible blobs
• Verify the blob ID is correct
• Check if you have the right permissions`,
                        source: "read-blob"
                    });
                }
            }
            
        } catch (error) {
            console.error("💥 Read blob error:", error);
            console.error("🔍 Error stack:", error instanceof Error ? error.stack : "No stack trace");
            if (callback) {
                callback({
                    text: `❌ **Blob Reading Error**

Error: ${error instanceof Error ? error.message : "Unknown error"}

Please try again with a valid blob ID:
\`read blob 0x1234567890abcdef...\``,
                    source: "read-blob"
                });
            }
        }
        
        console.log("🏁 READ_BLOB Action - Handler completed");
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "read blob 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "✅ **Blob Retrieved Successfully!**\n\n🔗 **Blob ID:** `0x1234567890abcd...`\n📏 **File Size:** 42 Bytes\n📄 **Content Type:** Text/Note\n\n📝 **Content:**\n```\nThis is my important note about the project\n```"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "retrieve note 1234567890abcdef"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "✅ **Blob Retrieved Successfully!**\n\n🔗 **Blob ID:** `0x1234567890abcd...`\n📏 **File Size:** 128 Bytes\n📄 **Content Type:** Text/Note\n\n📝 **Content:**\n```\nMeeting notes from today - discussed blockchain integration and wallet security features\n```"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "get blob abc123"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "❌ **Failed to Retrieve Blob**\n\n🔗 **Blob ID:** `0xabc123...`\n❌ **Error:** Blob not found\n\n💡 **Possible Solutions:**\n• Check if the blob ID is correct and complete"
                }
            }
        ]
    ]
};

// Helper function to format bytes
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
} 