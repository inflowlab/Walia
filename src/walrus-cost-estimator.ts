import { exec } from "child_process";
import { promisify } from "util";
import { ClientConfig } from "./wallet-management";

const execAsync = promisify(exec);

/**
 * Constants derived from Walrus info and observations for RS2 encoding.
 * These might change in the future; always refer to the latest `walrus info` output.
 */
const STORAGE_UNIT_SIZE_BYTES = 1048576; // 1 MiB
const WRITE_PRICE_PER_UNIT = 25000;
const STORAGE_PRICE_PER_UNIT_PER_EPOCH = 150000;
const EPOCH_DURATION_SECONDS = 86400; // 1 day in seconds

const MIN_ENCODED_SIZE_BYTES_RS2 = 66034000; // Observed minimum encoded size for RS2
// Calculated from example: 3093058000 (encoded) / 673880980 (unencoded)
const DEFAULT_RS2_INFLATION_FACTOR = 4.590100056;

// Conversion factor from internal units to WAL
// 1 WAL = 1_000_000_000 (1 billion) units, similar to SUI's MIST conversion
const UNITS_PER_WAL = 1_000_000_000;

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

        const response: WalrusInfo = JSON.parse(stdout);
        return response;
    } catch (error) {
        console.error('Failed to get Walrus info:', error);
        throw error;
    }
}

/**
 * Options for estimating storage cost in Walrus.
 */
export interface WalrusCostEstimationOptions {
  /**
   * The original size of the file in bytes.
   */
  unencodedSizeInBytes: number;
  /**
   * Desired storage duration in days.
   * If both storageDurationInDays and epochs are provided, storageDurationInDays will be used.
   */
  storageDurationInDays?: number;
  /**
   * Desired storage duration in epochs.
   * Used if storageDurationInDays is not provided.
   */
  epochs?: number;
  /**
   * Optional: If you have a pre-calculated or more accurately estimated encoded size in bytes.
   * If provided, this will be used directly, bypassing the inflation factor calculation.
   */
  knownEncodedSizeBytes?: number;
  /**
   * Optional: The inflation factor to estimate encoded size from unencoded size for RS2.
   * Defaults to an observed factor if not provided. Ignored if knownEncodedSizeBytes is set.
   */
  rs2InflationFactor?: number;
  /**
   * Optional: The minimum encoded size in bytes for the encoding type (RS2 default provided).
   * Ignored if knownEncodedSizeBytes is set.
   */
  minEncodedSizeBytes?: number;
  /**
   * Optional: WalrusInfo object from getInfo() to use for dynamic pricing and storage parameters.
   * If not provided, hardcoded constants will be used.
   */
  walrusInfo?: WalrusInfo;
}

/**
 * Result of the cost estimation calculation for Walrus storage.
 */
export interface WalrusCostEstimationResult {
  /**
   * The total estimated storage cost in raw units.
   */
  estimatedCost: number;
  /**
   * The total estimated storage cost in WAL tokens.
   */
  estimatedCostInWal: number;
  /**
   * The estimated or provided encoded size of the file in bytes, after applying inflation and minimums.
   */
  finalEncodedSizeBytes: number;
  /**
   * Number of storage units required for the encoded file.
   */
  numStorageUnits: number;
  /**
   * Number of epochs for which the storage cost is calculated.
   */
  numEpochs: number;
  /**
   * A summary of parameters used in the calculation for transparency.
   */
  parameters: {
    unencodedSizeInBytes: number;
    storageDurationInDays?: number;
    epochsInput?: number;
    knownEncodedSizeBytesInput?: number;
    rs2InflationFactorUsed: number | null;
    minEncodedSizeBytesUsed: number;
    storageUnitSizeBytes: number;
    writePricePerUnit: number;
    storagePricePerUnitPerEpoch: number;
    epochDurationSeconds: number;
    unitsPerWal: number;
  };
}

/**
 * Estimates the storage cost for SUI Walrus with RS2-like encoding.
 *
 * IMPORTANT:
 * - This estimation is based on observed behavior and the provided `walrus info`.
 * - If walrusInfo is provided, actual network parameters will be used. Otherwise, falls back to constants.
 * - Pricing parameters and encoding behavior (inflation, minimum size) can change.
 * - The RS2 inflation factor and minimum encoded size are estimates. For precise costs,
 * always use `walrus store --dry-run`.
 *
 * @param options - The options for cost estimation.
 * @returns An object containing the estimated cost and calculation details.
 */
export function estimateWalrusStorageCost(
  options: WalrusCostEstimationOptions,
): WalrusCostEstimationResult {
  const {
    unencodedSizeInBytes,
    storageDurationInDays,
    epochs,
    knownEncodedSizeBytes,
    rs2InflationFactor = DEFAULT_RS2_INFLATION_FACTOR,
    minEncodedSizeBytes = MIN_ENCODED_SIZE_BYTES_RS2,
    walrusInfo
  } = options;

  if (storageDurationInDays === undefined && epochs === undefined) {
    throw new Error(
      'Either storageDurationInDays or epochs must be provided.',
    );
  }
  if (unencodedSizeInBytes < 0) {
    throw new Error('unencodedSizeInBytes cannot be negative.');
  }
  if (epochs !== undefined && epochs <= 0) {
    throw new Error('epochs, if provided, must be greater than 0.');
  }
   if (storageDurationInDays !== undefined && storageDurationInDays <= 0) {
    throw new Error('storageDurationInDays, if provided, must be greater than 0.');
  }

  // Use values from walrusInfo if provided, otherwise use constants
  const storageUnitSize = walrusInfo ? walrusInfo.sizeInfo.storageUnitSize : STORAGE_UNIT_SIZE_BYTES;
  const writePricePerUnit = walrusInfo ? walrusInfo.priceInfo.writePricePerUnitSize : WRITE_PRICE_PER_UNIT;
  const storagePricePerUnitPerEpoch = walrusInfo ? walrusInfo.priceInfo.storagePricePerUnitSize : STORAGE_PRICE_PER_UNIT_PER_EPOCH;
  const epochDurationSecs = walrusInfo ? walrusInfo.epochInfo.epochDuration.secs : EPOCH_DURATION_SECONDS;

  let numEpochs: number;
  if (storageDurationInDays !== undefined) {
    // Convert days to epochs using actual epoch duration
    numEpochs = Math.ceil((storageDurationInDays * 86400) / epochDurationSecs);
  } else {
    numEpochs = epochs!;
  }

  let finalEncodedSizeBytes: number;
  let inflationFactorUsed: number | null = null;

  if (knownEncodedSizeBytes !== undefined) {
    if (knownEncodedSizeBytes < 0) throw new Error("knownEncodedSizeBytes cannot be negative.");
    finalEncodedSizeBytes = knownEncodedSizeBytes;
  } else {
    const inflatedSize = unencodedSizeInBytes * rs2InflationFactor;
    finalEncodedSizeBytes = Math.max(inflatedSize, minEncodedSizeBytes);
    inflationFactorUsed = rs2InflationFactor;
  }

  const numStorageUnits = Math.ceil(
    finalEncodedSizeBytes / storageUnitSize,
  );

  const cost =
    numStorageUnits *
    (writePricePerUnit +
      numEpochs * storagePricePerUnitPerEpoch);
      
  // Calculate cost in WAL tokens
  const costInWal = cost / UNITS_PER_WAL;

  return {
    estimatedCost: cost,
    estimatedCostInWal: costInWal,
    finalEncodedSizeBytes: finalEncodedSizeBytes,
    numStorageUnits: numStorageUnits,
    numEpochs: numEpochs,
    parameters: {
      unencodedSizeInBytes,
      storageDurationInDays: options.storageDurationInDays,
      epochsInput: options.epochs,
      knownEncodedSizeBytesInput: options.knownEncodedSizeBytes,
      rs2InflationFactorUsed: inflationFactorUsed,
      minEncodedSizeBytesUsed: knownEncodedSizeBytes === undefined ? minEncodedSizeBytes : 0,
      storageUnitSizeBytes: storageUnitSize,
      writePricePerUnit: writePricePerUnit,
      storagePricePerUnitPerEpoch: storagePricePerUnitPerEpoch,
      epochDurationSeconds: epochDurationSecs,
      unitsPerWal: UNITS_PER_WAL,
    },
  };
}

/**
 * Class for estimating Walrus storage costs with cached network information.
 * Initializes by fetching network parameters once, then can be used for multiple estimations.
 */
export class WalrusCostEstimator {
  private walrusInfo: WalrusInfo | null = null;
  private clientConf: ClientConfig;
  private isInitialized = false;
  
  /**
   * Creates a new Walrus cost estimator.
   * @param clientConf Client configuration for Walrus connections
   */
  constructor(clientConf: ClientConfig) {
    this.clientConf = clientConf;
  }
  
  /**
   * Initializes the estimator by fetching the latest Walrus network information.
   * This is called automatically on the first estimate call if not called explicitly.
   */
  public async initialize(): Promise<void> {
    if (!this.isInitialized) {
      try {
        this.walrusInfo = await getInfo(this.clientConf);
        this.isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize Walrus cost estimator:', error);
        throw error;
      }
    }
  }
  
  /**
   * Estimates the storage cost for the given file size and duration.
   * Automatically initializes the estimator if not already initialized.
   * 
   * @param fileSizeBytes The size of the file in bytes
   * @param storageDays The number of days to store the file
   * @returns Storage cost estimation result
   */
  public async estimate(fileSizeBytes: number, storageDays: number): Promise<WalrusCostEstimationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const estimation = estimateWalrusStorageCost({
      unencodedSizeInBytes: fileSizeBytes,
      storageDurationInDays: storageDays,
      walrusInfo: this.walrusInfo!
    });
    
    return estimation;
  }
  
  /**
   * Gets the cached Walrus network information.
   * @returns The cached Walrus info or null if not initialized
   */
  public getWalrusInfo(): WalrusInfo | null {
    return this.walrusInfo;
  }
  
  /**
   * Force refreshes the Walrus network information.
   * @returns The updated Walrus info
   */
  public async refreshWalrusInfo(): Promise<WalrusInfo> {
    this.walrusInfo = await getInfo(this.clientConf);
    this.isInitialized = true;
    return this.walrusInfo;
  }
}
