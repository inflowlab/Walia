import * as fs from "fs";
import * as path from "path";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { exec } from "child_process";
import { promisify } from "util";
import { SuiKeypairInfo, readSuiKeypair } from "./wallet-management";

const execAsync = promisify(exec);

const WAL_TO_FROST = 1_000_000_000; // 1 WAL = 1,000,000,000 FROST
const MIB = 1024 * 1024; // 1 MiB in bytes

export interface ClientConfig {
    suiCongPath: string;
    walrusConfPath: string;
}

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

export async function store(filePath: string, params: BlobParams): Promise<StoreResult> {
    try {
        let command = `walrus store --json "${filePath}"`;
        
        if (params.epochs) {
            command += ` --epochs ${params.epochs}`;
        }
        if (params.deletable) {
            command += ` --deletable`;
        }
        
        command += ` --config "${params.clientConf.walrusConfPath}"`;
        command += ` --wallet "${params.clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('Store command:', command);

        console.log('CLI output:', stdout);
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
            
            return result;
        } else if (storeResult?.alreadyCertified?.blobId) {
            // For already certified blobs, we need to get the additional info
            const info = await getInfo(params.clientConf);
            const epochDurationMs = info.epochInfo.epochDuration.secs * 1000;
            const endDateTime = new Date(Date.now() + (epochDurationMs * (params.epochs ?? 1)));
            
            const dryRunResult = await estimateResourceConsumption(params.clientConf, filePath, endDateTime);
            result = {
                blobId: storeResult.alreadyCertified.blobId,
                objectId: storeResult.alreadyCertified.object,
                storageCost: dryRunResult.storageCost,
                unencodedSize: dryRunResult.unencodedSize,
                encodedSize: dryRunResult.encodedSize,
                encodingType: dryRunResult.encodingType
            };
            
            // If attributes are provided and blob was already certified, add them
            if (params.attributes && Object.keys(params.attributes).length > 0) {
                await add_blob_attributes(params.clientConf, result.objectId, params.attributes);
            }
            
            return result;
        } else {
            console.error('Unexpected response structure:', response);
            throw new Error('Failed to store file: Invalid response from Walrus CLI');
        }
    } catch (error) {
        console.error('Failed to store file:', error);
        throw error;
    }
}

export async function read(blobId: string, params: BlobParams): Promise<Buffer> {
    try {
        const outputPath = path.join(process.cwd(), `temp-${blobId}`);
        let command = `walrus read --json "${blobId}" --out "${outputPath}"`;

        command += ` --config "${params.clientConf.walrusConfPath}"`;
        command += ` --wallet "${params.clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const fileContent = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath); // Clean up temporary file
        
        return fileContent;
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
        command += ` --wallet "${clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
    } catch (error) {
        console.error('Failed to set blob attributes:', error);
        throw error;
    }
} 


export async function get_blob_attributes(clientConf: ClientConfig, blobObjectId: string): Promise<BlobAttributes> {
    try {
        let command = `walrus get-blob-attribute "${blobObjectId}" --json`;
        
        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
        const response = JSON.parse(stdout);
        const attributes: Record<string, string> = {};
        if (response.attribute?.metadata?.contents) {
            for (const item of response.attribute.metadata.contents) {
                attributes[item.key] = item.value;
            }
        }
        console.log('Retrieved Attributes:', attributes);
        return attributes;
    } catch (error) {
        console.error('Failed to get blob attributes:', error);
        throw error;
    }
}

export async function list_blobs(clientConf: ClientConfig, includeExpired: boolean = false): Promise<BlobObject[]> {
    try {
        let command = `walrus list-blobs --json`;
        
        if (includeExpired) {
            command += ` --include-expired`;
        }

        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
        const response = JSON.parse(stdout);
        return response || [];
    } catch (error) {
        console.error('Failed to list blobs:', error);
        throw error;
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
        command += ` --wallet "${clientConf.suiCongPath}"`;
        
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

        console.log('Burn command:', command);

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
    } catch (error) {
        console.error('Failed to burn blobs:', error);
        throw error;
    }
}

export interface DateTime {
    DateTime: string;
}

export interface EpochDuration {
    secs: number;
    nanos: number;
}

export interface EpochInfo {
    currentEpoch: number;
    startOfCurrentEpoch: DateTime;
    epochDuration: EpochDuration;
    maxEpochsAhead: number;
}

export interface StorageInfo {
    nShards: number;
    nNodes: number;
}

export interface SizeInfo {
    storageUnitSize: number;
    maxBlobSize: number;
}

export interface ExampleBlob {
    unencodedSize: number;
    encodedSize: number;
    price: number;
    encodingType: string;
}

export interface EncodingDependentPriceInfo {
    marginalSize: number;
    metadataPrice: number;
    marginalPrice: number;
    exampleBlobs: ExampleBlob[];
    encodingType: string;
}

export interface PriceInfo {
    storagePricePerUnitSize: number;
    writePricePerUnitSize: number;
    encodingDependentPriceInfo: EncodingDependentPriceInfo[];
}

export interface WalrusInfo {
    epochInfo: EpochInfo;
    storageInfo: StorageInfo;
    sizeInfo: SizeInfo;
    priceInfo: PriceInfo;
}

export async function getInfo(clientConf: ClientConfig): Promise<WalrusInfo> {
    try {
        let command = `walrus info --json`;
        
        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
        const response: WalrusInfo = JSON.parse(stdout);
        return response;
    } catch (error) {
        console.error('Failed to get Walrus info:', error);
        throw error;
    }
}

export interface DryRunResponse {
    path: string;
    blobId: string;
    unencodedSize: number;
    encodedSize: number;
    storageCost: number;
    encodingType: string;
}

export async function estimateResourceConsumption(
    clientConf: ClientConfig,
    filePath: string,
    endDateTime: Date
): Promise<DryRunResponse> {
    try {
        // Get system info to calculate epochs
        const info = await getInfo(clientConf);
        
        const epochDurationSecs = info.epochInfo.epochDuration.secs;
        const startOfCurrentEpoch = new Date(info.epochInfo.startOfCurrentEpoch.DateTime);
        
        // Calculate epochs from the target date
        const epochsFromStart = Math.ceil((endDateTime.getTime() - startOfCurrentEpoch.getTime()) / (epochDurationSecs * 1000));
        
        // Verify if the requested duration is within limits
        if (epochsFromStart > info.epochInfo.maxEpochsAhead) {
            throw new Error(`Cannot store for more than ${info.epochInfo.maxEpochsAhead} epochs ahead. Requested: ${epochsFromStart} epochs`);
        }

        if (epochsFromStart <= 0) {
            throw new Error('End date must be in the future');
        }

        let command = `walrus store --json --dry-run "${filePath}" --epochs ${epochsFromStart}`;
        command += ` --config "${clientConf.walrusConfPath}"`;
        command += ` --wallet "${clientConf.suiCongPath}"`;

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        const responses: DryRunResponse[] = JSON.parse(stdout);
        if (!Array.isArray(responses) || responses.length === 0) {
            throw new Error('Invalid response: expected non-empty array');
        }

        return responses[0];
    } catch (error) {
        console.error('Failed to estimate resource consumption:', error);
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
        command += ` --wallet "${clientConf.suiCongPath}"`;

        console.log('Fund shared blob command:', command);

        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error('CLI warning:', stderr);
        }

        console.log('CLI output:', stdout);
    } catch (error) {
        console.error('Failed to fund shared blob:', error);
        throw error;
    }
}

export async function sendBlob(
    clientConf: ClientConfig,
    blob: BlobObject,
    destinationSuiAddress: string
): Promise<void> {
    try {
        if (!blob.id) {
            throw new Error('Blob ID is undefined');
        }

        // Initialize Sui client and load keypair
        const { keypair, activeAddress, activeEnv } = readSuiKeypair(clientConf.suiCongPath);
        
        // Get fullnode URL based on environment
        const fullnodeUrl = 
            activeEnv === 'testnet' ? 'https://fullnode.testnet.sui.io:443' :
            activeEnv === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' :
            activeEnv === 'devnet' ? 'https://fullnode.devnet.sui.io:443' :
            'http://127.0.0.1:9000'; // localnet
        
        const client = new SuiClient({ url: fullnodeUrl });
        
        // Create transaction
        const tx = new Transaction();
        tx.transferObjects([tx.object(blob.id as any)], tx.pure(destinationSuiAddress));
        
        // Execute transaction
        const result = await client.signAndExecuteTransaction({
            signer: keypair,
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








