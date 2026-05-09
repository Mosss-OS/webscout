// Validate required environment variables
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");

if (!APIFY_API_TOKEN) {
  throw new Error("APIFY_API_TOKEN is not set");
}

/**
 * Run an Apify actor and wait for results
 * @param actorId The ID of the Apify actor to run
 * @param input Input data for the actor
 * @param maxWaitSeconds Maximum time to wait for the actor to finish (default: 30 seconds)
 * @returns Array of results from the actor's dataset
 */
export async function runApifyActor(
  actorId: string, 
  input: any, 
  maxWaitSeconds: number = 30
): Promise<any[]> {
  // Start the actor run
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to start Apify actor: ${response.statusText}`);
  }

  const runData = await response.json();
  const runId = runData.data.id;

  // Wait for the actor to finish (simple polling approach)
  let status = "RUNNING";
  let elapsedSeconds = 0;
  const pollInterval = 2000; // 2 seconds

  while (status === "RUNNING" && elapsedSeconds < maxWaitSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    elapsedSeconds += pollInterval;

    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check Apify actor status: ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    status = statusData.data.status;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify actor failed or timed out with status: ${status}`);
  }

  // Get the default dataset ID for this run
  const datasetId = statusData.data.defaultDatasetId;
  if (!datasetId) {
    throw new Error("No dataset ID found for completed Apify actor run");
  }

  // Fetch results from the dataset
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch Apify dataset: ${datasetResponse.statusText}`);
  }

  const items = await datasetResponse.json();
  return items;
}
