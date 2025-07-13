import * as fs from "fs";
import DEV_WALLET, { DEV_CLIENT_CONFIG } from "./helper/dev-wallet-config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SealManager } from "../seal";
import { WalletManagement } from "../wallet-management";

// Test configuration using the provided package ID
// const WALIA_SEAL_PACKAGE_ID = '0xa34c6b853c9d90b8fa674d0c0a2b00052c13da1e520de3d15481d0ad7a5b894d';
const WALIA_SEAL_PACKAGE_ID = '0x271cba067da069738b4bd2d1b2e49789c08845c637704f4de169cb48f0bf01a0';

describe('SealManager createWhitelistWithCap Integration Test', () => {
  beforeAll(async () => {});

  afterAll(() => {});

  beforeEach(() => {});

  const wallet = new WalletManagement(
    DEV_WALLET.userName, 
    DEV_WALLET.baseDir, 
    DEV_WALLET.environment
  );
  const sealManager = new SealManager(wallet, WALIA_SEAL_PACKAGE_ID);

  it('should create whitelist with cap using real WalletManagement', async () => {
    expect(sealManager).toBeDefined();

    // Test createWhitelistWithCap with real wallet integration
    const result = await sealManager.createWhitelistWithCap();

    // Verify the result
    expect(result).toEqual({
      whitelistId: expect.any(String),
      capId: expect.any(String)
    });

  });

  it('should encypt the string using real WalletManagement', async () => {
    expect(sealManager).toBeDefined();

    const whitelistResult = {
        whitelistId: '0x8d0b99b608ffcc188b090fa8d36651c25dc67b6ee796a05fb419988d547c1d90',
        capId: '0xe52b085f66280d42e30ae429c7ded0394fbf7122d05a447116812b5ab3632983',
    };

    // Test createWhitelistWithCap with real wallet integration
    const result = await sealManager.encrypt('Hello, Walrus Storage!', 
        whitelistResult.whitelistId);

    console.log(`result : ${Buffer.from(result).toString()}`);

    // Verify result is a Uint8Array and not empty
    expect(result instanceof Uint8Array).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // Print result as string
    console.log('Encrypted data as string:', result.toString());

  });

  it('should decrypt the string using real WalletManagement', async () => {
    expect(sealManager).toBeDefined();

    const whitelistResult = {
      whitelistId: '0x8d0b99b608ffcc188b090fa8d36651c25dc67b6ee796a05fb419988d547c1d90',
      capId: '0xe52b085f66280d42e30ae429c7ded0394fbf7122d05a447116812b5ab3632983',
  };

    await sealManager.addMembersToWhitelistViaCap(
        whitelistResult.whitelistId,
        whitelistResult.capId,
        [wallet.getKeypair().getPublicKey().toSuiAddress()]
    );

    const data = 'Hello, Walrus Storage!';
    // Test createWhitelistWithCap with real wallet integration
    const encryopted_data = await sealManager.encrypt(data, 
        whitelistResult.whitelistId);

    console.log(`result : ${Buffer.from(encryopted_data).toString()}`);

    const decrypted_data = await sealManager.decrypt(encryopted_data, whitelistResult.whitelistId);
    
    const result = Buffer.from(decrypted_data).toString();
    // Print result as string
    console.log('Decrypted data as string:', result);
    expect(result).toBe(data);

  });

  it('add whitelist entries', async () => {
    expect(sealManager).toBeDefined();

    const whitelistResult = {
      whitelistId: '0x8d0b99b608ffcc188b090fa8d36651c25dc67b6ee796a05fb419988d547c1d90',
      capId: '0xe52b085f66280d42e30ae429c7ded0394fbf7122d05a447116812b5ab3632983',
    };
    await sealManager.addMembersToWhitelistViaCap(
        whitelistResult.whitelistId,
        whitelistResult.capId,
        ['0x6febc34064b1b40f8fadcaaa2798974303b59f51a0675404731bbfeb209602de']
    );

    const entries = await sealManager.getWhitelistEntries(whitelistResult.whitelistId);
    console.log(`entries : ${entries}`);

    expect(entries).toBeDefined();
    expect(entries!.length).toBeGreaterThan(1);
    
  });

  it('check whitelist entries', async () => {
    expect(sealManager).toBeDefined();

    const whitelistResult = {
      whitelistId: '0x8d0b99b608ffcc188b090fa8d36651c25dc67b6ee796a05fb419988d547c1d90',
      capId: '0xe52b085f66280d42e30ae429c7ded0394fbf7122d05a447116812b5ab3632983',
  };

    const entries = await sealManager.getWhitelistEntries(whitelistResult.whitelistId);
    console.log(`Wallet address: ${wallet.getKeypair().getPublicKey().toSuiAddress()}`);
    console.log(`entries : ${entries}`);

    expect(entries).toBeDefined();
    expect(entries!.length).toBeGreaterThanOrEqual(1);

  });
}); 