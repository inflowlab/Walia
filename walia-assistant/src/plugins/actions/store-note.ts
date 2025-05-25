import * as fs from "fs";
import * as path from "path";
import { Action, Content, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { SealManager } from "@walia/seal";
import { BlobParams, getDataDir, store } from "@walia/storage";
import { WalletManagement } from "@walia/wallet-management";

console.log("🔧 Loading store note action module...");

export const storeNoteAction: Action = {
    name: "STORE_NOTE",
    similes: [
        "SAVE_NOTE",
        "NOTE_STORAGE",
        "STORE_TEXT",
        "SAVE_TEXT",
        "CREATE_NOTE"
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("🔍 STORE_NOTE Action - Validate called");
        console.log("👤 User ID:", message.userId);
        console.log("🕐 Timestamp:", new Date().toISOString());
        console.log("📨 Message text:", message.content.text);
        
        const text = message.content.text?.trim() || "";
        const startsWithNote = text.toLowerCase().startsWith("note:");
        
        console.log("📝 Starts with 'note:':", startsWithNote);
        console.log("✅ Validation result:", startsWithNote);
        
        return startsWithNote;
    },
    description: "Store text notes to Walrus when message starts with 'note:'",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        console.log("🚀 STORE_NOTE Action - Handler started");
        console.log("👤 User ID:", message.userId);
        console.log("🤖 Agent ID:", message.agentId);
        
        try {
            const userId = message.userId;
            const baseDir = process.env.WALIA_WALLET_BASE_DIR || process.env.ELIZA_WALLET_DIR || "./wallets";
            
            console.log("📁 Base directory:", baseDir);
            console.log("👤 Processing for user:", userId);
            
            // Extract note content
            const fullText = message.content.text?.trim() || "";
            if (!fullText.toLowerCase().startsWith("note:")) {
                console.log("❌ Message doesn't start with 'note:'");
                if (callback) {
                    callback({
                        text: "❌ **Invalid Note Format**\n\nPlease start your message with 'note:' followed by your note content.\n\n**Example:** `note: This is my important note`",
                        source: "store-note"
                    });
                }
                return;
            }
            
            // Remove "note:" prefix and get the actual note content
            const noteContent = fullText.substring(5).trim();
            
            if (!noteContent) {
                console.log("❌ Empty note content");
                if (callback) {
                    callback({
                        text: "❌ **Empty Note**\n\nPlease provide note content after 'note:'.\n\n**Example:** `note: This is my important note`",
                        source: "store-note"
                    });
                }
                return;
            }
            
            console.log("📝 Note content:", noteContent);
            console.log("📏 Content length:", noteContent.length);
            
            
            // Initialize wallet and seal manager
            console.log("🔑 Initializing wallet...");
            const wallet = new WalletManagement(userId, baseDir);
            await wallet.ensureWallet();

            // Create user-specific notes directory
            const userNotesDir = getDataDir(wallet);
            console.log("📂 User notes directory:", userNotesDir);
            
            if (!fs.existsSync(userNotesDir)) {
                console.log("📁 Creating notes directory...");
                fs.mkdirSync(userNotesDir, { recursive: true });
            }
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `note_${timestamp}.txt`;
            const tempFilepath = path.resolve(path.join(userNotesDir, filename));
            
            console.log("📄 Writing note to temp file:", tempFilepath);
            fs.writeFileSync(tempFilepath, noteContent, 'utf8');
            
            try {
                console.log("🔐 Initializing Seal manager...");
                const sealManager = new SealManager(wallet, "0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507");
                
                const clientConf = wallet.getUserEnvironment();
                const params: BlobParams = {
                    epochs: 5,
                    deletable: true,
                    clientConf: clientConf,
                    attributes: {
                        filename: filename,
                        fileType: "text/plain",
                        uploadedBy: userId
                    }
                };

                console.log("🐋 Storing note to Walrus...");
                console.log("📁 File path:", tempFilepath);
                console.log("📊 File exists:", fs.existsSync(tempFilepath));
                
                const walrusResult = await store(tempFilepath, params, sealManager);
                
                console.log("✅ Note stored successfully!");
                console.log("🔗 Blob ID:", walrusResult.blobId);
                
                // Clean up temporary file
                if (fs.existsSync(tempFilepath)) {
                    fs.unlinkSync(tempFilepath);
                    console.log("🗑️ Cleaned up temp file");
                }
                
                if (callback) {
                    callback({
                        text: `✅ **Note Stored Successfully!**

📝 **Note Preview:** ${noteContent.substring(0, 100)}${noteContent.length > 100 ? "..." : ""}

🐋 **Walrus Storage Details:**
🔗 **Blob ID:** \`${walrusResult.blobId.slice(0, 16)}...\`
📏 **Original Size:** ${Buffer.byteLength(noteContent, 'utf8')} bytes
📦 **Encoded Size:** ${walrusResult.encodedSize} bytes
💰 **Storage Cost:** ${walrusResult.storageCost} units
🔐 **Encrypted:** Yes (Seal encryption)
🌐 **Network:** Walrus decentralized storage

💡 **What's Next?**
• Your note is encrypted and stored securely
• Use the blob ID to retrieve it later
• Share the blob ID with others for access
• Check your storage with "show my storage status"`,
                        source: "store-note"
                    });
                }
                
            } catch (storageError) {
                console.error("❌ Failed to store note to Walrus:", storageError);
                
                // Keep the temp file as fallback - keep local copy
                const fallbackPath = path.resolve(path.join(userNotesDir, filename));
                
                if (callback) {
                    callback({
                        text: `⚠️ **Note Saved Locally (Walrus Storage Failed)**

📝 **Note Content:** ${noteContent.substring(0, 100)}${noteContent.length > 100 ? "..." : ""}

📁 **Local File:** \`${fallbackPath}\`
❌ **Storage Error:** ${storageError instanceof Error ? storageError.message : "Unknown error"}

💡 **The note has been saved locally. Try again later for Walrus storage.**`,
                        source: "store-note"
                    });
                }
            }
            
        } catch (error) {
            console.error("💥 Store note error:", error);
            console.error("🔍 Error stack:", error instanceof Error ? error.stack : "No stack trace");
            if (callback) {
                callback({
                    text: `❌ **Note Storage Error**

Error: ${error instanceof Error ? error.message : "Unknown error"}

Please try again with format: \`note: Your note content here\``,
                    source: "store-note"
                });
            }
        }
        
        console.log("🏁 STORE_NOTE Action - Handler completed");
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "note: This is my important note about the project"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "✅ **Note Stored Successfully!**\n\n📝 **Note Preview:** This is my important note about the project\n\n🐋 **Walrus Storage Details:**\n🔗 **Blob ID:** `abc12345...`\n📏 **Original Size:** 42 bytes\n📦 **Encoded Size:** 2048 bytes\n💰 **Storage Cost:** 150 units"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "note: Meeting notes from today - discussed blockchain integration and wallet security features"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "✅ **Note Stored Successfully!**\n\n📝 **Note Preview:** Meeting notes from today - discussed blockchain integration and wallet security features\n\n🐋 **Walrus Storage Details:**\n🔗 **Blob ID:** `def67890...`\n📏 **Original Size:** 89 bytes\n📦 **Encoded Size:** 3072 bytes"
                }
            }
        ]
    ]
}; 