// Integration for Zynd AI Network (ZNS)
// This shows how we would integrate with the official Zynd SDK in a real implementation

const ZYND_API_KEY = Deno.env.get("ZYND_API_KEY");

// Interface for ZNS records (simplified version of what Zynd provides)
interface ZNSAgentRecord {
  agent_name: string;
  endpoint_url: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// Cache for resolved endpoints to reduce API calls
const ENDPOINT_CACHE = new Map<string, { endpoint: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Mock local registry for development/testing when Zynd is not available
const LOCAL_REGISTRY: Record<string, string> = {
  "webscout.orchestrator": "http://localhost:54321/functions/v1/agent-orchestrator",
  "webscout.discovery": "http://localhost:54321/functions/v1/discovery-agent",
  "webscout.matching": "http://localhost:54321/functions/v1/matching-agent",
  "webscout.action": "http://localhost:54321/functions/v1/action-agent",
};

/**
 * Register an agent on the Zynd Name Service (ZNS)
 * In a real implementation, this would use the Zynd SDK to register on-chain
 */
export async function registerAgentOnZNS(record: ZNSAgentRecord): Promise<boolean> {
  // If we don't have a Zynd API key, fall back to local mode
  if (!ZYND_API_KEY) {
    console.info(`[Zynd AI] No API key available, simulating registration of ${record.agent_name}`);
    // In local mode, we just simulate success
    return true;
  }

  try {
    console.log(`[Zynd AI] Registering agent ${record.agent_name} via ZNS...`);
    
    // In a real implementation, this would be something like:
    // const zynd = new ZyndSDK({ apiKey: ZYND_API_KEY });
    // await zynd.names.register(record.agent_name, {
    //   endpoint: record.endpoint_url,
    //   description: record.description,
    //   ...record.metadata
    // });
    
    // For now, we simulate the API call
    const response = await fetch("https://api.zynd.ai/v1/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ZYND_API_KEY}`
      },
      body: JSON.stringify({
        name: record.agent_name,
        endpoint: record.endpoint_url,
        description: record.description,
        metadata: record.metadata
      })
    });
    
    if (!response.ok) {
      throw new Error(`ZNS registration failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`[Zynd AI] Successfully registered ${record.agent_name}:`, result);
    return true;
  } catch (error) {
    console.error(`[Zynd AI] Failed to register agent ${record.agent_name}:`, error);
    // In a hackathon context, we might want to continue even if registration fails
    return false;
  }
}

/**
 * Resolve an agent's endpoint using ZNS (Zynd Name Service)
 * Falls back to local registry or environment variables if Zynd is unavailable
 */
export async function resolveAgentEndpoint(agentName: string): Promise<string> {
  // Check cache first
  const cached = ENDPOINT_CACHE.get(agentName);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.endpoint;
  }

  let endpoint: string | null = null;

  // If we have a Zynd API key, try to resolve via ZNS
  if (ZYND_API_KEY) {
    try {
      console.log(`[Zynd AI] Resolving endpoint for ${agentName} via ZNS...`);
      
      // In a real implementation, this would be something like:
      // const zynd = new ZyndSDK({ apiKey: ZYND_API_KEY });
      // const record = await zynd.names.resolve(agentName);
      // endpoint = record?.endpoint;
      
      // For now, we simulate the API call
      const response = await fetch(`https://api.zynd.ai/v1/resolve/${encodeURIComponent(agentName)}`, {
        headers: {
          "Authorization": `Bearer ${ZYND_API_KEY}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        endpoint = data.endpoint;
      } else {
        console.warn(`[Zynd AI] ZNS resolution failed for ${agentName}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[Zynd AI] Error resolving ${agentName} via ZNS:`, error);
    }
  }

  // Fall back to local registry
  if (!endpoint) {
    endpoint = LOCAL_REGISTRY[agentName] || null;
  }

  // Fall back to environment variables (e.g., WEBSCOUT_DISCOVERY_URL)
  if (!endpoint) {
    const envVarName = agentName.replace(/\./g, "_").toUpperCase() + "_URL";
    endpoint = Deno.env.get(envVarName) || null;
  }

  // If we still don't have an endpoint, throw an error
  if (!endpoint) {
    throw new Error(`Could not resolve ZNS name: ${agentName}. Tried ZNS, local registry, and environment variables.`);
  }

  // Cache the result
  ENDPOINT_CACHE.set(agentName, { endpoint, timestamp: Date.now() });
  
  return endpoint;
}

/**
 * Call another agent via Zynd network
 * Handles service-to-service communication with proper authentication
 */
export async function callAgent(agentName: string, payload: any): Promise<any> {
  try {
    const endpoint = await resolveAgentEndpoint(agentName);
    
    console.log(`[Zynd AI] Calling agent ${agentName} at ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // In a real implementation, we might use Zynd-specific auth headers
        "Authorization": `Bearer ${Deno.env.get("FUNCTION_SECRET") || ""}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Agent ${agentName} responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Zynd AI] Failed to call agent ${agentName}:`, error);
    throw error;
  }
}

/**
 * Clear the endpoint cache (useful for testing or when endpoints change)
 */
export function clearEndpointCache(): void {
  ENDPOINT_CACHE.clear();
  console.info("[Zynd AI] Endpoint cache cleared");
}
