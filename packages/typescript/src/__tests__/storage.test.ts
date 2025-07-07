import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import DEV_WALLET, { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SealManager } from "../seal";
import { BlobParams, BurnParams, add_blob_attributes, burnBlobs, getDataDir, get_blob_attributes, list_blobs, read, sendBlob, store } from "../storage";
import { WalletManagement } from "../wallet-management";
import { WalrusCostEstimator, getInfo } from "../walrus-cost-estimator";

// Integration tests are disabled by default, and must be explicitly enabled
const runIntegrationTests = process.env.RUN_WALRUS_INTEGRATION_TESTS === 'true';

// Use the same package ID from seal.test.ts
const WALIA_SEAL_PACKAGE_ID = '0xf5083045ffb970f16dde2bbad407909b9e761f6c93342500530d9efdf7b09507';

describe('Storage Tests', () => {
    const fileName = 'test.txt';
    const testFile = path.join(__dirname, fileName);
    const testContent = 'Hello, Walrus Storage!';
    
    // Use the dev wallet config instead of creating our own
    const params: BlobParams = {
        epochs: 1,
        deletable: true,
        clientConf: DEV_CLIENT_CONFIG,
        attributes: {
            'name': fileName
        }
    };

    const wallet = new WalletManagement(
        DEV_WALLET.userName, 
        DEV_WALLET.baseDir, 
        DEV_WALLET.environment
    );
    // const testFile = path.join(getDataDir(wallet), fileName);
    getDataDir(wallet);
    const sealManager = new SealManager(wallet, WALIA_SEAL_PACKAGE_ID);

    beforeAll(() => {
        // Create test file
        fs.writeFileSync(testFile, testContent);
    });

    afterAll(() => {
        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    });

    // Ensure test file exists before each test
    beforeEach(() => {
        if (!fs.existsSync(testFile)) {
            fs.writeFileSync(testFile, testContent);
        }
    });

    it('should skip integration tests when not enabled', () => {
        if (!runIntegrationTests) {
            console.log('Skipping Walrus storage integration tests. Set RUN_WALRUS_INTEGRATION_TESTS=true to enable.');
        }
        // Always pass this test
        expect(true).toBe(true);
    });

    // Only run the real API tests if explicitly enabled
    if (runIntegrationTests) {
        it('should store and read a file', async () => {
            // Store the file and get both blobId and objectId
            const storeResult = await store(testFile, params, sealManager);
            expect(storeResult.blobId).toBeDefined();
            expect(storeResult.objectId).toBeDefined();
            expect(typeof storeResult.storageCost).toBe('number');
            expect(typeof storeResult.unencodedSize).toBe('number');
            expect(typeof storeResult.encodedSize).toBe('number');
            expect(storeResult.encodingType).toBe('RS2');
            
            // Verify size relationships
            expect(storeResult.encodedSize).toBeGreaterThan(storeResult.unencodedSize);
            expect(storeResult.storageCost).toBeGreaterThan(0);
            // expect(storeResult.unencodedSize).toBe(testContent.length);

            // Read content using blobId
            const decryptedFilePath = await read(storeResult.blobId, params, sealManager);
            const content = fs.readFileSync(decryptedFilePath);
            fs.unlinkSync(decryptedFilePath);
            expect(content.toString()).toBe(testContent);

            // Test getting blob attributes using object ID
            const attributes = await get_blob_attributes(params.clientConf, storeResult.objectId);
            expect(attributes).toBeDefined();
            expect(attributes['name']).toBe(fileName);
            expect(attributes['capId']).toBeDefined();
            expect(attributes['whitelistId']).toBeDefined();

            // Test adding new attributes using object ID
            const newAttributes = {
                'content-type': 'text/plain',
                'description': 'Test file'
            };
            await add_blob_attributes(params.clientConf, storeResult.objectId, newAttributes);

            // Verify the new attributes were added using object ID
            const updatedAttributes = await get_blob_attributes(params.clientConf, storeResult.objectId);
            expect(updatedAttributes['content-type']).toBe('text/plain');
            expect(updatedAttributes['description']).toBe('Test file');

            // Test listing blobs
            const blobs = await list_blobs(params.clientConf);
            expect(blobs).toBeDefined();
            expect(blobs.length).toBeGreaterThan(0);
            const storedBlob = blobs.find(b => b.blobId === storeResult.blobId);
            expect(storedBlob).toBeDefined();
            expect(storedBlob?.deletable).toBe(true);
        }, 60000);

        it('should burn specific blob objects', async () => {
            // Store a file first
            const storeResult = await store(testFile, params, sealManager);
            expect(storeResult.blobId).toBeDefined();
            expect(storeResult.objectId).toBeDefined();

            // Get initial blob count and verify our blob exists
            const initialBlobs = await list_blobs(params.clientConf);
            const initialCount = initialBlobs.length;
            const ourBlob = initialBlobs.find(b => b.id === storeResult.objectId);
            expect(ourBlob).toBeDefined();

            // Burn the specific blob object
            const burnParams: BurnParams = {
                blobObjectIds: [storeResult.objectId]
            };
            await burnBlobs(params.clientConf, burnParams);

            // Verify our specific blob is no longer in the list
            const finalBlobs = await list_blobs(params.clientConf);
            const burnedBlob = finalBlobs.find(b => b.id === storeResult.objectId);
            expect(burnedBlob).toBeUndefined();
            
            // The total count should be one less than before
            expect(finalBlobs.length).toBe(initialCount - 1);
        }, 120000);

        it.skip('should burn all expired blobs', async () => {
            // Store a file that will expire soon
            const expiredParams = { ...params, epochs: 1 };
            const storeResult = await store(testFile, expiredParams, sealManager);
            
            // Burn all expired blobs
            const burnParams: BurnParams = {
                all_expired: true
            };
            await burnBlobs(params.clientConf, burnParams);

            // Verify the blob is no longer in the list
            const blobs = await list_blobs(params.clientConf, true); // include expired blobs
            expect(blobs.length).toBe(0);
        }, 120000);

        it('should get Walrus system information', async () => {
            const estimator = new WalrusCostEstimator(params.clientConf);
            await estimator.initialize();
            const info = estimator.getWalrusInfo()!;
            
            // Verify the structure and basic data types
            expect(info.epochInfo).toBeDefined();
            expect(typeof info.epochInfo.currentEpoch).toBe('number');
            expect(info.epochInfo.startOfCurrentEpoch.DateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(typeof info.epochInfo.epochDuration.secs).toBe('number');
            expect(typeof info.epochInfo.maxEpochsAhead).toBe('number');

            expect(info.storageInfo).toBeDefined();
            expect(typeof info.storageInfo.nShards).toBe('number');
            expect(typeof info.storageInfo.nNodes).toBe('number');

            expect(info.sizeInfo).toBeDefined();
            expect(typeof info.sizeInfo.storageUnitSize).toBe('number');
            expect(typeof info.sizeInfo.maxBlobSize).toBe('number');

            expect(info.priceInfo).toBeDefined();
            expect(typeof info.priceInfo.storagePricePerUnitSize).toBe('number');
            expect(typeof info.priceInfo.writePricePerUnitSize).toBe('number');
            expect(Array.isArray(info.priceInfo.encodingDependentPriceInfo)).toBe(true);

            if (info.priceInfo.encodingDependentPriceInfo.length > 0) {
                const encoding = info.priceInfo.encodingDependentPriceInfo[0];
                expect(typeof encoding.marginalSize).toBe('number');
                expect(typeof encoding.metadataPrice).toBe('number');
                expect(typeof encoding.marginalPrice).toBe('number');
                expect(Array.isArray(encoding.exampleBlobs)).toBe(true);
                expect(typeof encoding.encodingType).toBe('string');
            }
        }, 60000);


        it('should send a blob to another address', async () => {
            // First store a file to get a blob
            const storeResult = await store(testFile, params, sealManager);
            expect(storeResult.blobId).toBeDefined();
            expect(storeResult.objectId).toBeDefined();

            // Get the blob object
            const blobs = await list_blobs(params.clientConf);
            const blob = blobs.find(b => b.id === storeResult.objectId);
            expect(blob).toBeDefined();

            // Test destination address (this should be a valid Sui address that you control for testing)
            const destinationAddress = '0x5a95cc411d6aee68d60e77fad8e6ce7b0fabf02b7524a5f6a8aaa41797a5baa7'; // Replace with a real test address

            // Send the blob
            await expect(sendBlob(
                storeResult.objectId,
                destinationAddress,
                sealManager
            )).resolves.not.toThrow();

            // Verify the blob is no longer in our list
            const blobsAfter = await list_blobs(params.clientConf);
            expect(blobsAfter.find(b => b.id === storeResult.objectId)).toBeUndefined();

            // Verify the destination address received the blob
            const client = sealManager.getWallet().getSuiClient();
            
            const objectInfo = await client.getObject({
                id: storeResult.objectId,
                options: { showOwner: true }
            });
            
            expect(objectInfo.data?.owner).toBeDefined();
            const owner = objectInfo.data!.owner as { AddressOwner: string };
            expect(owner.AddressOwner.toLowerCase()).toBe(destinationAddress.toLowerCase());
        }, 120000);
    }
}); 

