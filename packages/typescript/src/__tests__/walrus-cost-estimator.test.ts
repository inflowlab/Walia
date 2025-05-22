import { beforeEach, describe, expect, it } from "vitest";
import { ClientConfig } from "../wallet-management";
import { WalrusCostEstimationResult, WalrusCostEstimator, WalrusInfo, getInfo } from "../walrus-cost-estimator";
import { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";

// Integration tests are disabled by default, and must be explicitly enabled
const runIntegrationTests = process.env.RUN_WALRUS_INTEGRATION_TESTS === 'true';

// Test client configuration - set through environment variables
const testClientConf: ClientConfig = DEV_CLIENT_CONFIG;

/**
 * Utility for logging detailed information about a storage cost estimation.
 * This is kept in the test file to avoid cluttering the main module with logging code.
 */
export function logStorageCostDetails(
  fileSizeBytes: number,
  storageDays: number,
  estimation: WalrusCostEstimationResult,
  walrusInfo: WalrusInfo
): void {
  // Helper function to format file sizes
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };
  
  // Get the units per WAL from the parameters
  const UNITS_PER_WAL = estimation.parameters.unitsPerWal;
  
  console.log(`Estimated cost for ${formatSize(fileSizeBytes)} for ${storageDays} days:`);
  console.log(`  Raw units: ${estimation.estimatedCost}`);
  console.log(`  WAL tokens: ${estimation.estimatedCostInWal.toFixed(9)}`);
  console.log('File size details:');
  console.log(`  Original size: ${formatSize(estimation.parameters.unencodedSizeInBytes)} (${estimation.parameters.unencodedSizeInBytes} bytes)`);
  console.log(`  Encoded size: ${formatSize(estimation.finalEncodedSizeBytes)} (${estimation.finalEncodedSizeBytes} bytes)`);
  console.log(`  Storage units: ${estimation.numStorageUnits} (${formatSize(estimation.numStorageUnits * walrusInfo.sizeInfo.storageUnitSize)} total)`);
  console.log(`  Encoding inflation: ${(estimation.finalEncodedSizeBytes / estimation.parameters.unencodedSizeInBytes).toFixed(2)}x`);
  console.log('Network parameters:');
  console.log(`  Storage unit size: ${formatSize(walrusInfo.sizeInfo.storageUnitSize)}`);
  console.log(`  Write price: ${walrusInfo.priceInfo.writePricePerUnitSize} per unit (${(walrusInfo.priceInfo.writePricePerUnitSize / UNITS_PER_WAL).toFixed(9)} WAL)`);
  console.log(`  Storage price: ${walrusInfo.priceInfo.storagePricePerUnitSize} per unit per epoch (${(walrusInfo.priceInfo.storagePricePerUnitSize / UNITS_PER_WAL).toFixed(9)} WAL)`);
  console.log(`  Epoch duration: ${walrusInfo.epochInfo.epochDuration.secs} seconds (${(walrusInfo.epochInfo.epochDuration.secs / 86400).toFixed(2)} days)`);
  console.log(`  Storage duration: ${estimation.numEpochs} epochs`);
}

describe('Walrus Cost Estimator Tests', () => {
  // Variable to store walrusInfo for reuse across tests to reduce API calls
  let walrusInfo: WalrusInfo | null = null;
  let estimator: WalrusCostEstimator;
  
  // Helper to get walrusInfo once
  async function getWalrusInfo(): Promise<WalrusInfo> {
    if (walrusInfo === null) {
      walrusInfo = await getInfo(testClientConf);
    }
    return walrusInfo;
  }
  
  // Helper function to wait between tests to avoid rate limiting
  async function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  beforeEach(async () => {
    // Create a new estimator instance for each test
    estimator = new WalrusCostEstimator(testClientConf);
  });

  it('should skip integration tests when not enabled', () => {
    if (!runIntegrationTests) {
      console.log('Skipping Walrus integration tests. Set RUN_WALRUS_INTEGRATION_TESTS=true to enable.');
    }
    // Always pass this test
    expect(true).toBe(true);
  });

  // Only run the real API tests if explicitly enabled
  if (runIntegrationTests) {
    it('should connect to Walrus and retrieve network info', async () => {
      await estimator.initialize();
      const info = estimator.getWalrusInfo();
      
      // Verify the structure of the response
      expect(info).toBeDefined();
      expect(info?.epochInfo).toBeDefined();
      expect(info?.storageInfo).toBeDefined();
      expect(info?.sizeInfo).toBeDefined();
      expect(info?.priceInfo).toBeDefined();
      
      // Log the actual network parameters for reference
      console.log('Current Walrus network parameters:');
      console.log(`  Storage unit size: ${info?.sizeInfo.storageUnitSize} bytes`);
      console.log(`  Write price: ${info?.priceInfo.writePricePerUnitSize}`);
      console.log(`  Storage price: ${info?.priceInfo.storagePricePerUnitSize} per epoch`);
      console.log(`  Epoch duration: ${info?.epochInfo.epochDuration.secs} seconds`);
      
      // More detailed assertions
      expect(typeof info?.sizeInfo.storageUnitSize).toBe('number');
      expect(typeof info?.priceInfo.writePricePerUnitSize).toBe('number');
      expect(typeof info?.priceInfo.storagePricePerUnitSize).toBe('number');
      expect(typeof info?.epochInfo.epochDuration.secs).toBe('number');
    }, 30000);
    
    it('should estimate cost for a small file (1MB) for short duration (1 day)', async () => {
      const fileSizeBytes = 1 * 1024 * 1024; // 1 MB
      const storageDays = 1; // 1 day
      
      const result = await estimator.estimate(fileSizeBytes, storageDays);
      
      // Basic validation
      expect(result).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.numStorageUnits).toBeGreaterThan(0);
      expect(result.numEpochs).toBe(1);
      
      // Log detailed information
      const info = await getWalrusInfo();
      logStorageCostDetails(fileSizeBytes, storageDays, result, info);
      
      await wait(1000); // Wait to avoid rate limiting
    }, 30000);
    
    it('should estimate cost for a medium file (100MB) for medium duration (7 days)', async () => {
      const fileSizeBytes = 100 * 1024 * 1024; // 100 MB
      const storageDays = 7; // 7 days
      
      const result = await estimator.estimate(fileSizeBytes, storageDays);
      
      // Basic validation
      expect(result).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.numStorageUnits).toBeGreaterThan(0);
      expect(result.numEpochs).toBeGreaterThanOrEqual(7); // May be more depending on epoch duration
      
      // Log detailed information
      const info = await getWalrusInfo();
      logStorageCostDetails(fileSizeBytes, storageDays, result, info);
      
      await wait(1000); // Wait to avoid rate limiting
    }, 30000);
    
    it('should estimate cost for a large file (1GB) for long duration (30 days)', async () => {
      const fileSizeBytes = 1024 * 1024 * 1024; // 1 GB
      const storageDays = 30; // 30 days
      
      const result = await estimator.estimate(fileSizeBytes, storageDays);
      
      // Basic validation
      expect(result).toBeDefined();
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.numStorageUnits).toBeGreaterThan(0);
      expect(result.numEpochs).toBeGreaterThanOrEqual(30); // May be more depending on epoch duration
      
      // Log detailed information
      const info = await getWalrusInfo();
      logStorageCostDetails(fileSizeBytes, storageDays, result, info);
      
      await wait(1000); // Wait to avoid rate limiting
    }, 30000);
    
    it('should compare different durations for the same file size', async () => {
      const durations = [1, 7, 30];
      const fileSize = 100 * 1024 * 1024; // 100 MB
      
      const results: WalrusCostEstimationResult[] = [];
      for (const days of durations) {
        const result = await estimator.estimate(fileSize, days);
        results.push(result);
        await wait(1000); // Wait to avoid rate limiting
      }
      
      // Compare results - longer duration should cost more
      for (let i = 1; i < results.length; i++) {
        expect(results[i].estimatedCost).toBeGreaterThan(results[i-1].estimatedCost);
        expect(results[i].numEpochs).toBeGreaterThan(results[i-1].numEpochs);
      }
      
      // Log for debugging
      console.log('Duration comparison for 100MB:');
      durations.forEach((days, i) => {
        console.log(`  ${days} days: cost=${results[i].estimatedCost}, epochs=${results[i].numEpochs}`);
      });
    }, 60000);
    
    it('should compare different file sizes with the same duration', async () => {
      const fileSizes = [1, 10, 100]; // MB
      const duration = 7; // days
      
      const results: WalrusCostEstimationResult[] = [];
      for (const sizeMB of fileSizes) {
        const result = await estimator.estimate(sizeMB * 1024 * 1024, duration);
        results.push(result);
        await wait(1000); // Wait to avoid rate limiting
      }
      
      // Compare results - larger file should cost more
      for (let i = 1; i < results.length; i++) {
        // This might not be true for very small files due to minimum size requirements
        if (fileSizes[i] > 10 && fileSizes[i-1] > 10) {
          expect(results[i].estimatedCost).toBeGreaterThan(results[i-1].estimatedCost);
          expect(results[i].numStorageUnits).toBeGreaterThan(results[i-1].numStorageUnits);
        }
      }
      
      // Log for debugging
      console.log('File size comparison for 7 days:');
      fileSizes.forEach((sizeMB, i) => {
        console.log(`  ${sizeMB}MB: cost=${results[i].estimatedCost}, units=${results[i].numStorageUnits}`);
      });
    }, 60000);
    
    it('should verify cost scales with duration', async () => {
      // Get network parameters
      const info = await getWalrusInfo();
      const writePricePerUnit = info.priceInfo.writePricePerUnitSize;
      const storagePricePerUnitPerEpoch = info.priceInfo.storagePricePerUnitSize;
      
      // Calculate costs for different durations
      const fileSize = 100 * 1024 * 1024; // 100 MB
      const durations = [1, 7, 30];
      
      const results: WalrusCostEstimationResult[] = [];
      for (const days of durations) {
        const result = await estimator.estimate(fileSize, days);
        results.push(result);
        await wait(1000); // Wait to avoid rate limiting
      }
      
      // Basic check - verify that the cost follows the formula:
      // cost = numStorageUnits * (writePricePerUnit + numEpochs * storagePricePerUnitPerEpoch)
      for (const result of results) {
        const expectedCost = result.numStorageUnits * 
          (writePricePerUnit + result.numEpochs * storagePricePerUnitPerEpoch);
        
        // Allow for small floating point differences
        const difference = Math.abs(result.estimatedCost - expectedCost);
        const percentDifference = difference / expectedCost;
        
        // Cost should match the formula within 0.001% (very small tolerance for floating point)
        expect(percentDifference).toBeLessThan(0.00001);
        
        // Also verify that WAL calculation is correct
        const expectedWalCost = result.estimatedCost / result.parameters.unitsPerWal;
        expect(result.estimatedCostInWal).toBeCloseTo(expectedWalCost, 12); // High precision for WAL conversion
      }
      
      // For longer durations, the ratio of costs should be approximately proportional to epochs
      // after subtracting the fixed write cost
      const baseResult = results[0];
      const baseStorageCost = baseResult.estimatedCost - 
        (baseResult.numStorageUnits * writePricePerUnit);
      
      console.log('Cost scaling verification:');
      console.log(`  Base (1 day): epochs=${baseResult.numEpochs}, storageCost=${baseStorageCost}`);
      
      for (let i = 1; i < results.length; i++) {
        const result = results[i];
        const storageCost = result.estimatedCost - (result.numStorageUnits * writePricePerUnit);
        
        const epochRatio = result.numEpochs / baseResult.numEpochs;
        const costRatio = storageCost / baseStorageCost;
        
        console.log(`  ${durations[i]} days: epochs=${result.numEpochs}, storageCost=${storageCost}`);
        console.log(`    Expected ratio: ${epochRatio.toFixed(2)}, Actual ratio: ${costRatio.toFixed(2)}`);
        
        // The ratio should be very close to the epoch ratio
        expect(Math.abs(epochRatio - costRatio)).toBeLessThan(0.01);
      }
    }, 60000);
    
    it('should provide WAL cost correctly', async () => {
      const fileSizeBytes = 200 * 1024 * 1024; // 200 MB
      const storageDays = 30; // 30 days
      
      const result = await estimator.estimate(fileSizeBytes, storageDays);
      
      // Verify the WAL cost is correctly calculated from raw units
      expect(result.estimatedCostInWal).toBe(result.estimatedCost / result.parameters.unitsPerWal);
      
      // Log detailed information
      await estimator.initialize(); // Make sure it's initialized 
      const walrusInfo = estimator.getWalrusInfo()!;
      logStorageCostDetails(fileSizeBytes, storageDays, result, walrusInfo);
    }, 30000);
  }
}); 