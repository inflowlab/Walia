import { Plugin } from "@elizaos/core";
import { manageWhitelistAction } from "./actions/manage-whitelist.ts";
import { readBlobAction } from "./actions/read-blob.ts";
import { storeNoteAction } from "./actions/store-note.ts";
import { walrusStatusAction } from "./actions/walrus-status.ts";
import { walrusStorageAction } from "./actions/walrus-storage.ts";
import { walrusProvider } from "./providers/walrus-provider.ts";

console.log("🔌 Loading Walia plugin with store note action...");

export const waliaPlugin: Plugin = {
    name: "walia",
    description: "Walia decentralized storage and encryption plugin",
    actions: [
        storeNoteAction,
        readBlobAction,
        walrusStorageAction,
        walrusStatusAction,
        manageWhitelistAction
    ],
    evaluators: [],
    providers: [walrusProvider]
}; 