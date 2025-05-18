import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BlobParams, BurnParams, StoreResult, add_blob_attributes, burnBlobs, estimateResourceConsumption, getInfo, get_blob_attributes, list_blobs, read, sendBlob, store } from "../storage";
import { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";

describe('Storage Integration Tests', () => {
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

    it('should store and read a file', async () => {
        // Store the file and get both blobId and objectId
        const storeResult = await store(testFile, params);
        expect(storeResult.blobId).toBeDefined();
        expect(storeResult.objectId).toBeDefined();
        expect(typeof storeResult.storageCost).toBe('number');
        expect(typeof storeResult.unencodedSize).toBe('number');
        expect(typeof storeResult.encodedSize).toBe('number');
        expect(storeResult.encodingType).toBe('RS2');
        
        // Verify size relationships
        expect(storeResult.encodedSize).toBeGreaterThan(storeResult.unencodedSize);
        expect(storeResult.storageCost).toBeGreaterThan(0);
        expect(storeResult.unencodedSize).toBe(testContent.length);

        // Read content using blobId
        const content = await read(storeResult.blobId, params);
        expect(content.toString()).toBe(testContent);

        // Test getting blob attributes using object ID
        const attributes = await get_blob_attributes(params.clientConf, storeResult.objectId);
        expect(attributes).toBeDefined();
        expect(attributes['name']).toBe(fileName);

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
        const storeResult = await store(testFile, params);
        expect(storeResult.blobId).toBeDefined();
        expect(storeResult.objectId).toBeDefined();

        // Burn the specific blob object
        const burnParams: BurnParams = {
            blobObjectIds: [storeResult.objectId]
        };
        await burnBlobs(params.clientConf, burnParams);

        // Verify the blob is no longer in the list
        const blobs = await list_blobs(params.clientConf);
        expect(blobs.length).toBe(0);
    }, 120000);

    it.skip('should burn all expired blobs', async () => {
        // Store a file that will expire soon
        const expiredParams = { ...params, epochs: 1 };
        const storeResult = await store(testFile, expiredParams);
        
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
        const info = await getInfo(params.clientConf);
        
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

    it('should estimate resource consumption', async () => {
        // Get current system info to calculate a valid future date
        const info = await getInfo(params.clientConf);
        
        // Calculate a future date 2 epochs ahead
        const epochDurationMs = info.epochInfo.epochDuration.secs * 1000;
        const endDate = new Date(Date.now() + (epochDurationMs * 2));
        
        // Get resource consumption estimate
        const estimate = await estimateResourceConsumption(params.clientConf, testFile, endDate);
        
        // Check the response structure
        expect(estimate.path).toBe(testFile);
        expect(estimate.blobId).toBeDefined();
        expect(typeof estimate.unencodedSize).toBe('number');
        expect(typeof estimate.encodedSize).toBe('number');
        expect(typeof estimate.storageCost).toBe('number');
        expect(estimate.encodingType).toBe('RS2');
        
        // Verify size relationships
        expect(estimate.encodedSize).toBeGreaterThan(estimate.unencodedSize);
        expect(estimate.storageCost).toBeGreaterThan(0);
        
        // Test invalid dates
        const pastDate = new Date(Date.now() - epochDurationMs);
        await expect(estimateResourceConsumption(params.clientConf, testFile, pastDate))
            .rejects.toThrow('End date must be in the future');
        
        const tooFarDate = new Date(Date.now() + (epochDurationMs * (info.epochInfo.maxEpochsAhead + 1)));
        await expect(estimateResourceConsumption(params.clientConf, testFile, tooFarDate))
            .rejects.toThrow(/Cannot store for more than \d+ epochs ahead/);
    }, 60000);

    it.skip('should send a blob to another address', async () => {
        // First store a file to get a blob
        const storeResult = await store(testFile, params);
        expect(storeResult.blobId).toBeDefined();
        expect(storeResult.objectId).toBeDefined();

        // Get the blob object
        const blobs = await list_blobs(params.clientConf);
        const blob = blobs.find(b => b.id === storeResult.objectId);
        expect(blob).toBeDefined();

        // Test destination address (this should be a valid Sui address that you control for testing)
        const destinationAddress = '0x6a0effbaa0556cd684ec4ec60617ebf9f39fd1b8152a41857bb2eb8f5bd137d0'; // Replace with a real test address

        // Send the blob
        await expect(sendBlob(
            params.clientConf,
            blob!,
            destinationAddress
        )).resolves.not.toThrow();

        // Verify the blob is no longer in our list
        const blobsAfter = await list_blobs(params.clientConf);
        expect(blobsAfter.find(b => b.id === storeResult.objectId)).toBeUndefined();

        // Verify the destination address received the blob
        const suiConfig = yaml.load(fs.readFileSync(params.clientConf.suiCongPath, 'utf8')) as any;
        const client = new SuiClient({ url: getFullnodeUrl(suiConfig.active_env) });
        
        const objectInfo = await client.getObject({
            id: storeResult.objectId,
            options: { showOwner: true }
        });
        
        expect(objectInfo.data?.owner).toBeDefined();
        const owner = objectInfo.data!.owner as { AddressOwner: string };
        expect(owner.AddressOwner.toLowerCase()).toBe(destinationAddress.toLowerCase());
    }, 120000);
}); 

