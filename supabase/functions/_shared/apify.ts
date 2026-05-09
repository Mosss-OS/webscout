const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN") || "";

export async function runApifyActor(actorId: string, input: any) {
  if (!APIFY_API_TOKEN) {
    console.warn("[Apify] No API token provided, returning mocked data.");
    return [{ title: "Mocked Web3 Job", source: actorId, payout: "TBD" }];
  }

  // Example: Start an Apify actor and wait for dataset results
  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Apify run failed: ${response.statusText}`);
  }

  const runData = await response.json();
  const datasetId = runData.data.defaultDatasetId;

  // Ideally, we'd wait for the run to finish (polling or webhook). 
  // For the hackathon, we assume instantaneous or we fetch a previously cached dataset.
  const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
  const items = await datasetResponse.json();

  return items;
}
