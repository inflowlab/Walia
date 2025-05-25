import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { getWalrusContextFormatted } from "../providers/walrus-provider";

export const walrusStatusAction: Action = {
    name: "WALRUS_STATUS",
    similes: [
        "CHECK_WALRUS_STATUS",
        "SHOW_STORAGE_STATUS", 
        "VIEW_WALLET_INFO",
        "DISPLAY_BLOB_OBJECTS",
        "STORAGE_OVERVIEW"
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // This action can always be called to check status
        return true;
    },
    description: "Check your Walrus storage status, wallet information, and blob objects",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            const userId = message.userId;
            const agentId = message.agentId;
            
            const formattedStatus = await getWalrusContextFormatted(runtime, userId, agentId);
            
            if (callback) {
                callback({
                    text: formattedStatus,
                    source: "walrus-status"
                });
            }
        } catch (error) {
            console.error("Error in walrus status action:", error);
            if (callback) {
                callback({
                    text: `❌ **Error retrieving Walrus status**\n\nError: ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or check your wallet configuration.`,
                    source: "walrus-status"
                });
            }
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me my Walrus storage status"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔍 **WALRUS STORAGE STATUS**\n\n💰 **Wallet Information**\n✅ Wallet Status: Active\n📍 Address: 0x1234...\n💎 SUI Balance: 1.5 SUI\n🪙 WAL Balance: 100 WAL\n\n📦 **Storage Overview**\n📊 Total Blobs: 3\n💾 Storage Used: 2.5 MB\n\n🗃️ **Your Blob Objects**\n1. **document.pdf**\n   🔗 ID: `abc123...`\n   📏 Size: 1.2 MB (RS2)\n   ⏰ Epoch 12345\n   ✅ Active | Expires: 2024-06-15"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's in my Walrus wallet?"
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔍 **WALRUS STORAGE STATUS**\n\n💰 **Wallet Information**\n❌ Wallet Status: Not Found\n📍 Address: N/A\n\n⚠️ **Setup Required**\nWallet needs to be created or configured:\n• Assistant can help create a new wallet\n• Ensure proper Sui CLI configuration\n• Set up Walrus client configuration"
                }
            }
        ]
    ]
}; 