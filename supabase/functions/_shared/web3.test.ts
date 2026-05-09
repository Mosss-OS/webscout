import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { isValidEthereumAddress, isValidStarknetAddress, isValidWalletAddress, detectWalletType } from "./web3.ts";

Deno.test("web3 - valid Ethereum address", () => {
  assertEquals(isValidEthereumAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"), true);
});

Deno.test("web3 - invalid Ethereum address (wrong length)", () => {
  assertEquals(isValidEthereumAddress("0x1234"), false);
});

Deno.test("web3 - invalid Ethereum address (no 0x prefix)", () => {
  assertEquals(isValidEthereumAddress("742d35Cc6634C0532925a3b844Bc454e4438f44e"), false);
});

Deno.test("web3 - valid Starknet address", () => {
  assertEquals(isValidStarknetAddress("0x03e4379f5d4f3c3e5a5c5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c"), true);
});

Deno.test("web3 - invalid Starknet address", () => {
  assertEquals(isValidStarknetAddress("0x1234"), false);
});

Deno.test("web3 - isValidWalletAddress accepts both types", () => {
  assertEquals(isValidWalletAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"), true);
  assertEquals(isValidWalletAddress("0x03e4379f5d4f3c3e5a5c5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c"), true);
  assertEquals(isValidWalletAddress("not-a-wallet"), false);
});

Deno.test("web3 - detectWalletType returns correct type", () => {
  assertEquals(detectWalletType("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"), "ethereum");
  assertEquals(detectWalletType("0x03e4379f5d4f3c3e5a5c5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c5a5b5a5c"), "starknet");
  assertEquals(detectWalletType("invalid"), "unknown");
});
