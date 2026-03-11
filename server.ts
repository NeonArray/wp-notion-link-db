import { fetchFromNotion } from "./notion.ts";
import { getCachedPlugins, storePlugins } from "./kv.ts";
import { CACHE_TTL, PluginInfo } from "./types.ts";

/**
 * Orchestrates plugin retrieval from cache or Notion.
 */
export async function getPlugins(forceRefresh = false): Promise<PluginInfo[]> {
  if (!forceRefresh) {
    const cached = await getCachedPlugins();
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
      if (!isExpired) {
        console.log("Serving from Deno KV cache.");
        return cached.data;
      }
      console.log("Cache expired, fetching fresh data...");
    } else {
      console.log("No cache found, fetching fresh data...");
    }
  }

  const results = await fetchFromNotion();

  // Update KV cache
  await storePlugins(results);

  // Local file generation (for local development)
  try {
    const jsonOutput = JSON.stringify(results, null, 2);
    await Deno.writeTextFile("plugins.json", jsonOutput);
    console.log("File 'plugins.json' has been created successfully.");
  } catch (_e) {
    // Expected to fail on Deno Deploy's read-only file system
  }

  return results;
}

/**
 * Serves the plugins list as a JSON response.
 */
export function servePlugins(): void {
  Deno.serve({ port: 8000 }, async (req) => {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has("refresh");

    try {
      const plugins = await getPlugins(forceRefresh);
      return new Response(JSON.stringify(plugins, null, 2), {
        headers: { "content-type": "application/json" },
      });
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch plugins" }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  });
}

/**
 * Sets up a daily cron job to sync Notion plugins.
 */
export async function setCronJob(): Promise<void> {
  if (typeof Deno.cron !== "function") {
    return;
  }

  await Deno.cron("Daily Notion Sync", "0 0 * * *", async () => {
    console.log("CRON: Starting daily Notion sync...");
    await getPlugins(true);
    console.log("CRON: Daily Notion sync completed.");
  });
}
