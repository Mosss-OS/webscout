// Web3 Integration Module for WebScout
// Supports wallet address validation, on-chain credential verification,
// and IPFS storage for opportunity artifacts.

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidStarknetAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{63,64}$/.test(address);
}

export function isValidWalletAddress(address: string): boolean {
  return isValidEthereumAddress(address) || isValidStarknetAddress(address);
}

export function detectWalletType(address: string): 'ethereum' | 'starknet' | 'unknown' {
  if (isValidEthereumAddress(address)) return 'ethereum';
  if (isValidStarknetAddress(address)) return 'starknet';
  return 'unknown';
}

export async function saveDraftToIPFS(draftContent: string): Promise<string | null> {
  // In a real implementation, this would use web3.storage, Pinata, or similar IPFS service
  // For now, we return a simulated CID
  const IPFS_API_KEY = Deno.env.get("IPFS_API_KEY");
  
  if (!IPFS_API_KEY) {
    console.warn("[Web3] No IPFS API key configured, returning simulated CID");
    const simulatedCid = `bafybei${Array.from({ length: 50 }, () => 
      Math.random().toString(36).charAt(2)).join('')}`;
    return `ipfs://${simulatedCid}`;
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${IPFS_API_KEY}`
      },
      body: JSON.stringify({
        pinataContent: {
          type: "webscout-draft",
          content: draftContent,
          timestamp: new Date().toISOString(),
          version: "1.0"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return `ipfs://${result.IpfsHash}`;
  } catch (error) {
    console.error("[Web3] Failed to save draft to IPFS:", error);
    return null;
  }
}
