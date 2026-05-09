const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");

if (!APIFY_API_TOKEN) {
  throw new Error("APIFY_API_TOKEN is not set");
}

export interface ApifyActorConfig {
  id: string;
  name: string;
  ecosystem: string;
}

// Real, publicly available Apify actors configured for Web3 opportunity discovery
export const APIFY_ACTORS: ApifyActorConfig[] = [
  {
    id: "apify/web-scraper",
    name: "Gitcoin Grants",
    ecosystem: "EVM"
  },
  {
    id: "apify/web-scraper",
    name: "Bounty Networks",
    ecosystem: "Polkadot"
  },
  {
    id: "apify/web-scraper",
    name: "Dev Grants",
    ecosystem: "Starknet"
  }
];

// Pre-configured scrape targets for each actor run
export function getActorInput(actorName: string, query: string): any {
  switch (actorName) {
    case "Gitcoin Grants":
      return {
        runMode: "singlePage",
        pageFunction: `async function pageFunction(context) {
          const { request, $, log } = context;
          const items = [];
          $('.grant-card, .opportunity-card, [data-testid="grant-card"]').each((i, el) => {
            items.push({
              title: $(el).find('.title, h2, h3').first().text().trim(),
              description: $(el).find('.description, p').first().text().trim(),
              payout: $(el).find('.funded-amount, .payout').text().trim(),
              url: $(el).find('a').first().attr('href'),
              ecosystem: 'EVM'
            });
          });
          return items;
        }`,
        startUrls: [{ url: "https://gitcoin.co/grants/explorer" }]
      };
    case "Bounty Networks":
      return {
        runMode: "singlePage",
        pageFunction: `async function pageFunction(context) {
          const { request, $, log } = context;
          const items = [];
          $('.bounty-card, .listing, .opportunity').each((i, el) => {
            items.push({
              title: $(el).find('.title, h3, h2').first().text().trim(),
              description: $(el).find('.description, p').first().text().trim(),
              payout: $(el).find('.reward, .payout, .amount').text().trim(),
              url: $(el).find('a').first().attr('href'),
              ecosystem: 'Polkadot'
            });
          });
          return items;
        }`,
        startUrls: [{ url: "https://bounties.network" }]
      };
    case "Dev Grants":
      return {
        runMode: "singlePage",
        pageFunction: `async function pageFunction(context) {
          const { request, $, log } = context;
          const items = [];
          $('.grant-item, .card, .opportunity-item').each((i, el) => {
            items.push({
              title: $(el).find('.title, h3, h2').first().text().trim(),
              description: $(el).find('.description, p').first().text().trim(),
              payout: $(el).find('.value, .amount, .grant-amount').text().trim(),
              url: $(el).find('a').first().attr('href'),
              ecosystem: 'Starknet'
            });
          });
          return items;
        }`,
        startUrls: [{ url: "https://starknet.io/ecosystem/grants" }]
      };
    default:
      return {
        runMode: "singlePage",
        pageFunction: `async function pageFunction(context) {
          const { request, $, log } = context;
          const items = [];
          $('article, .job, .opportunity, .card').each((i, el) => {
            items.push({
              title: $(el).find('.title, h2, h3').first().text().trim(),
              description: $(el).find('.description, p').first().text().trim(),
              payout: $(el).find('.salary, .payout, .amount').text().trim(),
              url: $(el).find('a').first().attr('href')
            });
          });
          return items;
        }`,
        startUrls: [{ url: `https://www.google.com/search?q=${encodeURIComponent(query || 'web3 grants bounties')}` }]
      };
  }
}

export async function runApifyActor(
  actorId: string,
  input: any,
  maxWaitSeconds: number = 60
): Promise<any[]> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Failed to start Apify actor: ${response.statusText} - ${errBody}`);
  }

  const runData = await response.json();
  const runId = runData.data.id;

  let status = "RUNNING";
  let elapsedMs = 0;
  const pollInterval = 2000;

  while (status === "RUNNING" && elapsedMs < maxWaitSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    elapsedMs += pollInterval;

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
    return [];
  }

  const datasetId = statusData.data.defaultDatasetId;
  if (!datasetId) {
    return [];
  }

  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
  );

  if (!datasetResponse.ok) {
    return [];
  }

  const items = await datasetResponse.json();
  return items;
}

export async function searchApifyStore(searchQuery: string): Promise<any[]> {
  const response = await fetch(
    `https://api.apify.com/v2/store/acts?search=${encodeURIComponent(searchQuery)}&limit=5&token=${APIFY_API_TOKEN}`
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data || [];
}
