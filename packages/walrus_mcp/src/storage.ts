import * as fs from "fs";
import * as path from "path";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { exec } from "child_process";
import { promisify } from "util";
import { SealManager } from "./seal";
import { ClientConfig, WalletManagement, readSuiKeypair } from "./wallet-management";

const execAsync = promisify(exec);

const WAL_TO_FROST = 1_000_000_000; // 1 WAL = 1,000,000,000 FROST

const DATA_DIR = 'data';

export interface BlobAttributes {
    [key: string]: string;
}

export interface BlobParams {
    epochs?: number;
    deletable?: boolean;
    clientConf: ClientConfig;
    attributes?: BlobAttributes;
}

export interface StorageObject {
    id: string;
    startEpoch: number;
    endEpoch: number;
    storageSize: number;
}

export interface BlobObject {
    id: string;
    registeredEpoch: number;
    blobId: string;
    size: number;
    encodingType: string;
    certifiedEpoch: number;
    storage: StorageObject;
    deletable: boolean;
    name?: string;
    whitelistId?: string;
    endEpoch?: number;
    endDate?: string;
    // Additional enriched fields
    timestamp?: string;
    formattedSize?: string;
    isExpired?: boolean;
    daysUntilExpiry?: number;
    attributes?: BlobAttributes;
}

interface WalrusStoreResponse {
    blobStoreResult: {
        newlyCreated?: {
            blobObject: BlobObject;
            resourceOperation: {
                reuseStorage?: {
                    encodedLength: number;
                };
                registerFromScratch?: {
                    encodedLength: number;
                    epochsAhead: number;
                };
            };
            cost: number;
        };
        alreadyCertified?: {
            blobId: string;
            object: string;
            endEpoch: number;
        };
    };
    path: string;
}

export interface StoreResult {
    blobId: string;
    objectId: string;
    storageCost: number;
    unencodedSize: number;
    encodedSize: number;
    encodingType: string;
}

export function getDataDir(walletManagement: WalletManagement): string {
    const dataDir = path.join(walletManagement.getWalletDirectory(), DATA_DIR);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    return dataDir;
}

// remove files after storing
async function removeFiles(filePath: string, encodedFilePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    if (fs.existsSync(encodedFilePath)) {
        fs.unlinkSync(encodedFilePath);
    }
}

export async function store(filePath: string, params: BlobParams, sealManager: SealManager): Promise<StoreResult> {
    let encodedFilePath: string | undefined;
    
    try {
        const encodedFileResult = await sealManager.encodeFile(filePath);
        encodedFilePath = encodedFileResult.encodedFilePath;
        const capId = encodedFileResult.capId;
        const whitelistId = encodedFileResult.whitelistId;
        // Add seal management attributes to track capId and whitelistId
        if (!params.attributes) {
            params.attributes = {};
        }
        params.attributes.capId = capId;
        params.attributes.whitelistId = whitelistId;

        let command = `walrus store --json "${encodedFilePath}"`;
        
        if (params.epochs) {
            command += ` --epochs ${params.epochs}`;
        }
        if (params.deletable) {
            command += ` --deletable`;
        }
        
        command += ` --config "${params.clientConf.walrusConfPath}"`;
        command += ` --wallet "${params.clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const responses: WalrusStoreResponse[] = JSON.parse(stdout);
        
        if (!Array.isArray(responses) || responses.length === 0) {
            throw new Error('Invalid response: expected non-empty array');
        }

        const response = responses[0];
        if (!response.blobStoreResult) {
            throw new Error('Invalid response: missing blobStoreResult');
        }

        const storeResult = response.blobStoreResult;
        let result: StoreResult;
        
        if (storeResult?.newlyCreated?.blobObject) {
            const resourceOp = storeResult.newlyCreated.resourceOperation;
            const encodedLength = resourceOp?.registerFromScratch?.encodedLength || resourceOp?.reuseStorage?.encodedLength || 0;
            
            result = {
                blobId: storeResult.newlyCreated.blobObject.blobId,
                objectId: storeResult.newlyCreated.blobObject.id,
                storageCost: storeResult.newlyCreated.cost,
                unencodedSize: storeResult.newlyCreated.blobObject.size,
                encodedSize: encodedLength,
                encodingType: storeResult.newlyCreated.blobObject.encodingType
            };
            
            // If attributes are provided and blob was newly created, add them
            if (params.attributes && Object.keys(params.attributes).length > 0) {
                await add_blob_attributes(params.clientConf, result.objectId, params.attributes);
            }
            
            // remove files after storing
            await removeFiles(filePath, encodedFilePath);
            
            return result;
        } else if (storeResult?.alreadyCertified?.blobId) {
            // For already certified blobs, we need to get the additional info
        
            result = {
                blobId: storeResult.alreadyCertified.blobId,
                objectId: storeResult.alreadyCertified.object,
                storageCost: 0,
                unencodedSize: 0,
                encodedSize: 0,
                encodingType: 'RS2'
            };
            
            // If attributes are provided and blob was already certified, add them
            if (params.attributes && Object.keys(params.attributes).length > 0) {
                await add_blob_attributes(params.clientConf, result.objectId, params.attributes);
            }
            
            // remove files after storing
            await removeFiles(filePath, encodedFilePath);
            
            return result;
        } else {
            await removeFiles(filePath, encodedFilePath);
            console.error('Unexpected response structure:', response);
            throw new Error('Failed to store file: Invalid response from Walrus CLI');
        }
    } catch (error) {
        // Clean up files on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        if (encodedFilePath && fs.existsSync(encodedFilePath)) {
            fs.unlinkSync(encodedFilePath);
        }
        
        console.error('Failed to store file:', error);
        throw error;
    }
}


export async function read(blobId: string, params: BlobParams, sealManager: SealManager): Promise<string> {
    try {
        const outputPath =  path.join(getDataDir(sealManager.getWallet()),  `${blobId}.enc`);
        let command = `walrus read --json "${blobId}" --out "${outputPath}"`;

        command += ` --config "${params.clientConf.walrusConfPath}"`;
        command += ` --wallet "${params.clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const blobObjectId = await getBlobObjectIdByBlobId(blobId, params.clientConf);
        if (!blobObjectId) {
            throw new Error(`No blob object ID found for blob ID: ${blobId}`);
        }

        const attributes = await get_blob_attributes(params.clientConf, blobObjectId);
        const capId = attributes.capId;
        const whitelistId = attributes.whitelistId;
        
        // Decrypt the file data
        const decryptedFilePath = await sealManager.decodeFile(outputPath, whitelistId);
        fs.unlinkSync(outputPath);
        // Ensure decryptedFilePath is absolute
        const absoluteDecryptedFilePath = path.isAbsolute(decryptedFilePath)
            ? decryptedFilePath
            : path.resolve(process.cwd(), decryptedFilePath);
        
        return decryptedFilePath;
    } catch (error) {
        console.error('Failed to read file:', error);
        throw error;
    }
}

export async function add_blob_attributes(clientConf: ClientConfig, blobObjectId: string, attributes: BlobAttributes): Promise<void> {
    try {
        let command = `walrus set-blob-attribute "${blobObjectId}"`;
        
        // Add each attribute as a separate --attr flag
        for (const [key, value] of Object.entries(attributes)) {
            command += ` --attr "${key}" "${value}"`;
        }

        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }
    } catch (error) {
        console.error('Failed to set blob attributes:', error);
        throw error;
    }
} 

export async function get_blob_attributes(clientConf: ClientConfig, blobObjectId: string): Promise<BlobAttributes> {
    try {
        let command = `walrus get-blob-attribute "${blobObjectId}" --json`;
        
        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const response = JSON.parse(stdout);
        const attributes: Record<string, string> = {};
        if (response.attribute?.metadata?.contents) {
            for (const item of response.attribute.metadata.contents) {
                attributes[item.key] = item.value;
            }
        }
        return attributes;
    } catch (error) {
        console.error('Failed to get blob attributes:', error);
        throw error;
    }
}

export async function list_blobs(clientConf: ClientConfig, includeExpired: boolean = false): Promise<BlobObject[]> {
    try {
        console.info('list_blobs called with:', {
            clientConf,
            includeExpired
        });
        let command = `walrus list-blobs --json`;
        
        if (includeExpired) {
            command += ` --include-expired`;
        }

        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const response = JSON.parse(stdout);
        const blobs: BlobObject[] = response || [];
        
        // Enrich each blob with additional computed fields
        const enrichedBlobs = await Promise.all(blobs.map(async (blob) => {
            // Format size in human readable format
            blob.formattedSize = formatBytes(blob.size);
            
            // Create timestamp from registered epoch
            // blob.timestamp = `Epoch ${blob.registeredEpoch}`;
            
            // Calculate expiry information if storage info is available
            if (blob.storage?.endEpoch) {
                blob.endEpoch = blob.storage.endEpoch;
                // Assume each epoch is ~24 hours (this is approximate)
                const epochsUntilExpiry = blob.storage.endEpoch - blob.registeredEpoch;
                blob.daysUntilExpiry = Math.max(0, epochsUntilExpiry);
                blob.isExpired = epochsUntilExpiry <= 0;
                
                // Create human readable end date (approximate)
                const now = new Date();
                const expiryDate = new Date(now.getTime() + (epochsUntilExpiry * 24 * 60 * 60 * 1000));
                blob.endDate = blob.isExpired ? 'Expired' : expiryDate.toISOString().split('T')[0];
            } else {
                blob.isExpired = false;
                blob.daysUntilExpiry = undefined;
                blob.endDate = 'Unknown';
            }
            
            // Try to get blob attributes (non-blocking, don't fail if it errors)
            try {
                blob.attributes = await get_blob_attributes(clientConf, blob.id);
                
                // Extract name from attributes if available
                if (blob.attributes?.name) {
                    blob.name = blob.attributes.name;
                }
                
                // Extract whitelistId from attributes if available
                if (blob.attributes?.whitelistId) {
                    blob.whitelistId = blob.attributes.whitelistId;
                }
            } catch (error) {
                // Don't fail the entire operation if attributes can't be fetched
                console.debug(`Could not fetch attributes for blob ${blob.id}:`, error);
                blob.attributes = {};
            }
            
            return blob;
        }));
        
        return enrichedBlobs;
    } catch (error) {
        console.error('Failed to list blobs:', error);
        throw error;
    }
}

// Helper function to format bytes in human readable format
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get blob object ID by blobId from list_blobs result
 */
export async function getBlobObjectIdByBlobId(blobId: string, clientConf: ClientConfig): Promise<string | null> {
    try {
        // List all blobs
        const blobs = await list_blobs(clientConf, false);
        
        // Find the blob with matching blobId
        const targetBlob = blobs.find(blob => blob.blobId === blobId);
        
        if (!targetBlob) {
            console.log(`No blob found with blobId: ${blobId}`);
            return null;
        }

        console.log(`Found blob object ID: ${targetBlob.id} for blobId: ${blobId}`);
        return targetBlob.id;
    } catch (error) {
        console.error('Error getting blob object ID:', error);
        return null;
    }
}

export interface BurnParams {
    blobObjectIds?: string[];
    all_expired?: boolean;
    all?: boolean;
}

export async function burnBlobs(clientConf: ClientConfig, params: BurnParams): Promise<void> {
    try {
        let command = 'walrus burn-blobs --yes';

        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiConfPath}"`;
        
        // Priority handling:
        // 1. blobObjectIds if not empty
        // 2. all_expired if true and blobObjectIds is empty
        // 3. all if true and both above conditions are not met
        if (params.blobObjectIds && params.blobObjectIds.length > 0) {
            command += ` --object-ids ${params.blobObjectIds.join(' ')}`;
        } else if (params.all_expired) {
            command += ' --all-expired';
        } else if (params.all) {
            command += ' --all';
        } else {
            throw new Error('Invalid burn parameters: must specify either blobObjectIds, all_expired, or all');
        }

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }
    } catch (error) {
        console.error('Failed to burn blobs:', error);
        throw error;
    }
}

export async function fundSharedBlob(
    clientConf: ClientConfig,
    storage: StorageObject,
    amountWAL: number
): Promise<void> {
    try {
        const amountFROST = amountWAL * WAL_TO_FROST;
        
        let command = `walrus fund-shared-blob "${storage.id}" --json`;
        command += ` --amount ${amountFROST}`;
        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiConfPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }
    } catch (error) {
        console.error('Failed to fund shared blob:', error);
        throw error;
    }
}

export async function sendBlob(
    blobObjId: string,
    destinationSuiAddress: string,
    sealManager: SealManager
): Promise<void> {
    try {
        // Create transaction
        const tx = new Transaction();
        
        const blobAttrs = await get_blob_attributes(sealManager.getWallet().getUserEnvironment(), blobObjId);
        const capId = blobAttrs.capId;
        const whitelistId = blobAttrs.whitelistId;

        sealManager.addMembersToWhitelistViaCap(whitelistId, capId, [destinationSuiAddress]);
        // Add 1 second delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Use tx.object directly and then transfer the object
        // Typescript will validate the object during build phase
        tx.transferObjects([blobObjId, capId], destinationSuiAddress);
        
        // Execute transaction
        const result = await sealManager.getWallet().getSuiClient().signAndExecuteTransaction({
            signer: sealManager.getWallet().getKeypair(),
            transaction: tx,
            options: {
                showEffects: true,
            },
        });

        if (result.effects?.status?.status !== 'success') {
            throw new Error(`Failed to send blob: ${JSON.stringify(result.effects?.status)}`);
        }

        console.log('Transfer successful:', result.digest);
    } catch (error) {
        console.error('Failed to send blob:', error);
        throw error;
    }
}










