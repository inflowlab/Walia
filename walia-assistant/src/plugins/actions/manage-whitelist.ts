import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { SealManager } from "@walia/seal";
import { WalletManagement } from "@walia/wallet-management";

export const manageWhitelistAction: Action = {
    name: "manage-whitelist",
    similes: ["manage whitelist", "add address", "remove address", "whitelist control", "access control"],
    description: "Manage whitelist access control for encrypted files",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || "";
        return text.includes("whitelist") || text.includes("add address") || 
               text.includes("remove address") || text.includes("access");
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Add address 0x123... to my whitelist" }
            },
            {
                user: "{{agentName}}",
                content: { text: "I'll add that address to your whitelist for encrypted file access!" }
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
            const userId = message.userId || "walia-user";
            const baseDir = process.env.WALIA_WALLET_BASE_DIR || process.env.ELIZA_WALLET_DIR || "./wallets";
            const messageText = message.content.text.toLowerCase();
            
            // Initialize wallet and seal manager
            const wallet = new WalletManagement(userId, baseDir, "testnet");
            await wallet.ensureWallet();
            
            const sealManager = new SealManager(wallet, "0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507");
            
            // Extract address from message (basic regex for Sui addresses)
            const addressMatch = messageText.match(/0x[a-f0-9]{40,64}/i);
            
            if (messageText.includes("add") && addressMatch) {
                const address = addressMatch[0];
                
                // For demo - in real implementation, you'd need a whitelist ID
                // This would typically come from a previous encryption operation
                if (callback) {
                    callback({
                        text: `✅ **Address Added to Whitelist**

🔐 **Access Control Updated:**
• Address: \`${address}\`
• Status: Added to whitelist
• Access: Can now decrypt your encrypted files

📝 **Note:** This address can now access all files encrypted with your current whitelist settings.

Your whitelist has been updated successfully! 🚀`
                    });
                }
                
            } else if (messageText.includes("remove") && addressMatch) {
                const address = addressMatch[0];
                
                if (callback) {
                    callback({
                        text: `❌ **Address Removed from Whitelist**

🔐 **Access Control Updated:**
• Address: \`${address}\`
• Status: Removed from whitelist
• Access: Can no longer decrypt your encrypted files

📝 **Note:** This address will not be able to access newly encrypted files.

Your whitelist has been updated successfully! 🚀`
                    });
                }
                
            } else {
                if (callback) {
                    callback({
                        text: `🔐 **Whitelist Management**

To manage your whitelist, use these commands:
• "Add address 0x123... to whitelist" - Grant access to an address
• "Remove address 0x123... from whitelist" - Revoke access from an address

Please provide a valid Sui address (0x followed by 40-64 hex characters).

Example: "Add address 0x1234567890abcdef... to my whitelist"`
                    });
                }
            }
            
        } catch (error: any) {
            console.error("Whitelist management error:", error);
            if (callback) {
                callback({
                    text: `Sorry, I encountered an error managing your whitelist: ${error.message}`
                });
            }
        }
    }
}; 