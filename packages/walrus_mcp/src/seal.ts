import * as fs from "fs";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { WalletManagement } from "./wallet-management";

import {
    SealClient,
    getAllowlistedKeyServers,
    SessionKey
} from '@mysten/seal';


const WHITELIST_MODULE_NAME = 'whitelist';
const WHITELIST_FUNCTION_NAME = 'create_whitelist_entry';

// Interface for WaliaObjCap fields
interface WaliaObjCapObj {
    id: { id: string };
    cap: {
      id: { id: string };
      wl_id: string;
    };
    walrus_obj_id: string;
}

/**
 * Whitelist creation result
 */
export interface WhitelistCreationResult {
  whitelistId: string;
  capId: string;
}

/**
 * Access policy for encryption/decryption
 */
export interface AccessPolicy {
  /** Whitelist ID for access control */
  whitelistId: string;
  /** Required capability object ID */
  capId?: string;
  /** Additional constraints */
  constraints?: Record<string, any>;
}

/**
 * Key server response structure
 */
interface KeyServerResponse {
  success: boolean;
  keyShare?: string;
  error?: string;
}

interface EncodedFileResult {
  encodedFilePath: string;
  capId: string;
  whitelistId: string;
}

/**
 * SealManager provides encryption and decryption capabilities using
 * MystenLabs Seal with integration to the Walia whitelist contract
 */
export class SealManager {
  private wallet: WalletManagement;
  private sealClient: SealClient;
  private waliaSealPackageId: string;

  constructor(wallet: WalletManagement, waliaSealPackageId: string) {
    this.wallet = wallet;
    
    // Get the network and key servers with fallback
    const network = this.mapEnvironmentToNetwork(wallet.getActiveEnvironment());
    const keyServers = getAllowlistedKeyServers(network);
    
    // Debug logging
    console.log(`SealManager: network=${network}, keyServers=`, keyServers);
    
    // Handle the case where keyServers might be undefined or empty
    const serverConfigs = keyServers && keyServers.length > 0 
      ? keyServers.map((id) => ({ objectId: id, weight: 1 }))
      : []; // Use empty array as fallback
    
    this.sealClient = new SealClient({
      suiClient: this.wallet.getSuiClient(),
      serverConfigs,
      verifyKeyServers: false,
    });
    this.waliaSealPackageId = waliaSealPackageId;
  }

  /**
   * Get the wallet instance
   */
  getWallet(): WalletManagement {
    return this.wallet;
  }

  /**
   * Maps EnvironmentType to supported Seal network types
   */
  private mapEnvironmentToNetwork(env: string): "testnet" | "mainnet" {
    switch (env) {
      case 'mainnet':
        return 'mainnet';
      case 'testnet':
      case 'devnet':
      case 'localnet':
      default:
        return 'testnet';
    }
  }

  async encodeFile(filePath: string): Promise<EncodedFileResult> {
    try {
      // Read the file
      const fileData = fs.readFileSync(filePath);
      
      // Create whitelist and cap
      const { whitelistId, capId } = await this.createWhitelistWithCap();
      
      // Add wallet address to the whitelist
      const walletAddress = this.wallet.getKeypair().getPublicKey().toSuiAddress();
      console.log(`Whitelist ID: ${whitelistId}`);
      console.log(`filePath: ${filePath}. is exist ${fs.existsSync(filePath)}`);
      // Add 1 second timeout to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.addMembersToWhitelistViaCap(whitelistId, capId, [walletAddress]);
      console.log(`Passed addMembersToWhitelistViaCaps`);

      // Encrypt the file data
      const encryptedData = await this.encrypt(fileData, whitelistId);
      
      // Create output file path with .enc suffix
      const encodedFilePath = filePath + '.enc';
      
      // Write encrypted data to new file
      fs.writeFileSync(encodedFilePath, encryptedData);
      
      console.log(`File encoded successfully: ${encodedFilePath}`);
      console.log(`Whitelist ID: ${whitelistId}`);
      console.log(`Cap ID: ${capId}`);
      
      return {
        encodedFilePath,
        capId,
        whitelistId
      };
    } catch (error) {
      throw new Error(`Failed to encode file: ${error}`);
    }
  }

  async decodeFile(filePath: string, whitelistId: string): Promise<string> {
    try {
      const fileData = fs.readFileSync(filePath);
      
      const encryptedData = await this.decrypt(fileData, whitelistId);

      const decodedFilePath = filePath.replace('.enc', '');
      fs.writeFileSync(decodedFilePath, encryptedData);

      // console.log(`File decoded successfully: ${decodedFilePath}`);

      return decodedFilePath;
    } catch (error) {
      throw new Error(`Failed to decode file: ${error}`);
    }
  }

  /**
   * Encrypt data using Seal with automatic whitelist creation
   * This follows the pattern from MystenLabs Seal SDK
   */
async encrypt(data: string | Buffer, 
    id: string): Promise<Uint8Array> {
    try {
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      const { encryptedObject: encryptedBytes } = await this.sealClient.encrypt({
        threshold: 2,
        packageId: this.waliaSealPackageId,
        id: id,
        data: dataBuffer,
      });


      return encryptedBytes;
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using Seal with whitelist verification
   */
  async decrypt(encryptedBytes: Uint8Array,
    id: string): Promise<Buffer> {
    try {
        const txBytes = await this.constructTxBytes([id]);

		const sessionKey = new SessionKey({
			address: this.wallet.getKeypair().getPublicKey().toSuiAddress(),
			packageId: this.waliaSealPackageId,
			ttlMin: 10,
			signer: this.wallet.getKeypair(),
			suiClient: this.wallet.getSuiClient(),
		});

        const decryptedBytes = await this.sealClient.decrypt({
			data: encryptedBytes,
			sessionKey,
			txBytes,
		});
    
        return Buffer.from(decryptedBytes);
    } catch (error) {
        throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Create a whitelist and get the Cap object
   * This follows the Seal pattern where we create the whitelist first
   */
  async createWhitelistWithCap(): Promise<WhitelistCreationResult> {
    try {
        // Create transaction
        const tx = new Transaction();
        tx.moveCall({
        target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::${WHITELIST_FUNCTION_NAME}`,
        arguments: [],
        });

        // Sign and execute transaction
        const result = await this.wallet.getSuiClient().signAndExecuteTransaction({
            transaction: tx,
            signer: this.wallet.getKeypair(),
            options: {
            showEffects: true,
            showObjectChanges: true,
            },
        });

        // Check transaction status
        if (result.effects?.status.status !== 'success') {
            throw new Error(`Transaction failed: ${result.effects?.status.error}`);
        }

        console.log(`result : ${JSON.stringify(result)}`);  

        // Extract Cap and Whitelist object IDs
        const capObjectId = this.extractCreatedObjectId(result, 'Cap', 'WHITELIST CAP');
        const whitelistObjectId = this.extractCreatedObjectId(result, 'Whitelist', 'WHITELIST');

        return {
            whitelistId: whitelistObjectId,
            capId: capObjectId
        };
    } catch (error) {
      throw new Error(`Failed to create whitelist with cap: ${error}`);
    }
  }



async constructTxBytes(innerIds: string[]): Promise<Uint8Array> {
	const tx = new Transaction();
	for (const innerId of innerIds) {
		const keyIdArg = tx.pure.vector('u8', fromHex(innerId));
		const objectArg = tx.object(innerId);
		tx.moveCall({
			target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::seal_approve`,
			arguments: [keyIdArg, objectArg],
		});
	}
	return await tx.build({ client: this.wallet.getSuiClient(), onlyTransactionKind: true });
}

  

  /**
   * Extract object ID of a created object from transaction result
   */
  private extractCreatedObjectId(result: any, objectTypeName: string, logPrefix: string): string {
    const createdObjects = result.objectChanges?.filter(
        (change: any) =>
        change.type === 'created' &&
        change.objectType === `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::${objectTypeName}`,
    );

    if (!createdObjects || createdObjects.length === 0) {
        throw new Error(`No ${objectTypeName} object created in transaction`);
    }

    console.log(`createdObjects ${logPrefix} : ${JSON.stringify(createdObjects)}`);
    
    // Get the object ID (handle the type properly)
    const objectId = createdObjects[0].objectId;
    console.log(`New ${objectTypeName} object ID: ${objectId}`);

    return objectId;
  }

  /**
   * Add members to the whitelist using the Cap
   */
  async addMembersToWhitelistViaCap(
    whitelistId: string,
    capId: string,
    members: string[]
  ): Promise<void> {
    await this.changeWhitelistViaCap(
      whitelistId,
      capId,
      members,
      'add'
    );
  }

  /**
   * Remove members from the whitelist using the Cap
   */
  async removeMembersToWhitelistViaCap(
    whitelistId: string,
    capId: string,
    members: string[]
  ): Promise<void> {
    await this.changeWhitelistViaCap(
      whitelistId,
      capId,
      members,
      'remove'
    );
  }

  async changeWhitelistViaCap(
    whitelistId: string,
    capId: string,
    members: string[],
    functionName: string
  ): Promise<void> {
    try {
    const tx = new Transaction();
    for (const member of members) { // TODO: add check for duplicate members
      tx.moveCall({
        target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::${functionName}`,
        arguments: [
                  tx.object(whitelistId),
                  tx.object(capId),
                  tx.pure.address(member),
              ],
      });
    }
    const result = await this.wallet.getSuiClient().signAndExecuteTransaction({
          transaction: tx,
          signer: this.wallet.getKeypair(),
          options: {
              showEffects: true,
              showObjectChanges: true,
          },
    });

    if (result.effects?.status.status !== 'success') {
          throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }
    
    console.log(`result : ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`Error in changeWhitelistViaCap: ${error}`);
      throw error;
    }
  }

  /**
   * Create a WaliaObjCap for a Walrus blob
   */
  async createWaliaObjCap(
    capId: string,
    walrusBlobObjectId: string
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
        target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::create_walia_obj_cap`,
        arguments: [
            tx.object(capId),
            tx.pure.address(walrusBlobObjectId),
        ],
    })

    const result = await this.wallet.getSuiClient().signAndExecuteTransaction({
        transaction: tx,
        signer: this.wallet.getKeypair(),
        options: {
            showEffects: true,
            showObjectChanges: true,
        },
    });

    if (result.effects?.status.status !== 'success') {
        throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }
    
    return this.extractCreatedObjectId(result, 'WaliaObjCap', 'WALIA OBJ CAP');
  }

  async getWaliaObjCapByObjectId(
    waliaObjCapId: string
  ): Promise<WaliaObjCapObj | null> {
    try {
        // Fetch WaliaObjCap object
        const object = await this.wallet.getSuiClient().getObject({
          id: waliaObjCapId,
          options: { showContent: true },
        });
    
        // Check if object exists and has content
        if (object.data?.content?.dataType !== 'moveObject') {
          throw new Error(`Object ${waliaObjCapId} is not a valid Move object`);
        }
    
        // Extract fields
        const waliaObjCapObj = object.data.content.fields as unknown as WaliaObjCapObj;
        
        console.log('WaliaObjCapObj:', waliaObjCapObj);
    
        return waliaObjCapObj;
      } catch (error) {
        console.error('Error fetching IDs:', error);
        return null;
      }
  }

  async findWaliaObjCapByWalrusId(
    walrusBlobObjectId: string
  ): Promise<WaliaObjCapObj | null> {
    try {
        // Fetch all WaliaObjCap objects owned by the wallet
        const objects = await this.wallet.getSuiClient().getOwnedObjects({
          owner: this.wallet.getKeypair().getPublicKey().toSuiAddress(),
          filter: { StructType: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::WaliaObjCap` },
          options: { showContent: true },
        });
    
        // Iterate through objects to find the matching walrus_obj_id
        for (const obj of objects.data) {
          const objectId = obj.data?.objectId;
          const content = obj.data?.content;
    
          if (!objectId || content?.dataType !== 'moveObject') {
            continue;
          }
    
          const fields = content.fields as unknown as WaliaObjCapObj;
          if (fields.walrus_obj_id === walrusBlobObjectId) {
            const capId = fields.cap.id.id;
            const whitelistId = fields.cap.wl_id;
    
            console.log('Found WaliaObjCap ID:', objectId);
            console.log('Cap Object ID:', capId);
            console.log('Whitelist Object ID:', whitelistId);
    
            return fields;
          }
        }
    
        // No matching WaliaObjCap found
        console.log(`No WaliaObjCap found with walrus_obj_id: ${walrusBlobObjectId}`);
        return null;
      } catch (error) {
        console.error('Error finding WaliaObjCap:', error);
        return null;
      }
  }

  /**
   * Burn a WaliaObjCap object and the embedded Cap
   */
  async burnWaliaObjCap(
    waliaObjCapId: string
  ): Promise<void> {
    const tx = new Transaction();
    tx.moveCall({
        target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::burn_walia_obj_cap`,
        arguments: [
            tx.object(waliaObjCapId),
        ],
    })

    const result = await this.wallet.getSuiClient().signAndExecuteTransaction({
        transaction: tx,
        signer: this.wallet.getKeypair(),
        options: {
            showEffects: true,
            showObjectChanges: true,
        },
    });

    if (result.effects?.status.status !== 'success') {
        throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }
    
    console.log(`Burned WaliaObjCap: ${waliaObjCapId}`);
  }

  async getWhitelistEntries(
    whitelistId: string
  ): Promise<string[] | null> {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.waliaSealPackageId}::${WHITELIST_MODULE_NAME}::get_addresses`,
        arguments: [tx.object(whitelistId)],
      });
  
      // Use devInspect to avoid gas cost for read-only query
      const response = await this.wallet.getSuiClient().devInspectTransactionBlock({
        transactionBlock: tx,
        sender: this.wallet.getKeypair().getPublicKey().toSuiAddress(),
      });
      console.log(`response : ${JSON.stringify(response)}`);
  
      if (response.error) {
        throw new Error(`Inspection failed: ${response.error}`);
      }
  
      const returnValues = response.results?.[0]?.returnValues?.[0];
      if (!returnValues) {
        throw new Error('No entries returned');
      }
  
      // Decode BCS-serialized vector<address>
      const addressBytes = returnValues[0] as number[];
      const addresses = [];
      for (let i = 1; i < addressBytes.length; i += 32) {
        const address = `0x${Buffer.from(addressBytes.slice(i, i + 32)).toString('hex')}`;
        addresses.push(address);
      }

      console.log(`Whitelist ${whitelistId} addresses:`, addresses);
      return addresses;
    } catch (error) {
      console.error('Error fetching Whitelist entries:', error);
      return null;
    }
  }

  
}

