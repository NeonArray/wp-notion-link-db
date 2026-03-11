import {Client} from "@notionhq/client";
import type {PageObjectResponse, QueryDatabaseResponse,} from "@notionhq/client/build/src/api-endpoints.d.ts";

const CACHE_KEY = ["plugins"];
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Lazy KV initialization to handle environments where it might be missing or unstable
let _kv: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv | null> {
  if (_kv) return _kv;
  if (typeof Deno.openKv !== "function") {
    console.warn(
      "Deno.openKv is not available. Please run with --unstable-kv flag if using Deno < 2.0.",
    );
    return null;
  }
  try {
    _kv = await Deno.openKv();
    return _kv;
  } catch (err) {
    console.error("Failed to open Deno KV:", err);
    return null;
  }
}

interface PluginInfo {
  plugin: string;
  url: string;
}

/**
 * Accesses Notion, filters rows in a database by "Dependency/Framework" = "WordPress",
 * and saves "Plugin File Index" and the page URL to a JSON file.
 */
async function fetchFromNotion(): Promise<PluginInfo[]> {
  // 1. Load environment variables
  // In Deno Deploy, environment variables are available via Deno.env.get()
  // Locally, we load them from .env.
  let apiKey = Deno.env.get("NOTION_API_KEY");
  let databaseId = Deno.env.get("NOTION_DATABASE_ID");

  if (!apiKey || !databaseId) {
    try {
      const { load } = await import("@std/dotenv");
      const env = await load();
      apiKey = env["NOTION_API_KEY"];
      databaseId = env["NOTION_DATABASE_ID"];
    } catch (_e) {
      // In Deno Deploy, load() might fail if .env is missing, which is fine.
    }
  }

  if (!apiKey || !databaseId) {
    console.error("Missing NOTION_API_KEY or NOTION_DATABASE_ID.");
    throw new Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID.");
  }

  // 2. Initialize Notion client
  const notion = new Client({ auth: apiKey });

  try {
    console.log(`Querying Notion database: ${databaseId}...`);

    // 3. Query the specific table (database)
    // We fetch all rows and filter them in the code
    const response = (await notion.databases.query({
      database_id: databaseId,
    })) as QueryDatabaseResponse;

    return (response.results as PageObjectResponse[])
        .filter((page) => {
          // Exclude if "Dependency/Framework" != "WordPress" AND "Language" != "PHP"
          // This means we INCLUDE if "Dependency/Framework" == "WordPress" OR "Language" == "PHP"

          const dependencyProp = page.properties["Dependency/Framework"];
          const languageProp = page.properties["Language"];

          let dependency = "";
          if (dependencyProp?.type === "select") {
            dependency = dependencyProp.select?.name || "";
          } else if (dependencyProp?.type === "multi_select") {
            dependency = dependencyProp.multi_select
                ?.map((s) => s.name)
                .join(",") || "";
          }

          let language = "";
          if (languageProp?.type === "select") {
            language = languageProp.select?.name || "";
          } else if (languageProp?.type === "multi_select") {
            language = languageProp.multi_select?.map((s) => s.name).join(",") ||
                "";
          }

          return dependency === "WordPress" || language === "PHP";
        })
        .map((page) => {
          // 3.1 Extract URL from Notion (The page's direct URL)
          const url = page.url;

          // 3.2 Extract "Plugin File Index" column
          const pluginIndexProp = page.properties["Plugin File Index"];
          let plugin = "";

          if (pluginIndexProp) {
            if (pluginIndexProp.type === "rich_text") {
              plugin = pluginIndexProp.rich_text.map((t) => t.plain_text).join(
                  "",
              ) || "";
            } else if (pluginIndexProp.type === "title") {
              plugin = pluginIndexProp.title.map((t) => t.plain_text).join("") ||
                  "";
            } else if (pluginIndexProp.type === "number") {
              plugin = pluginIndexProp.number?.toString() || "";
            }
          }

          return {
            plugin,
            url,
          };
        })
        .filter((item) => item.plugin !== "");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error accessing Notion database:", error.message);
    }
    throw error;
  }
}

/**
 * Gets plugins from KV cache or fetches from Notion if expired or missing.
 */
async function getPlugins(forceRefresh = false): Promise<PluginInfo[]> {
  const kv = await getKv();

  if (!forceRefresh && kv) {
    const cached = await kv.get<{ data: PluginInfo[]; timestamp: number }>(
      CACHE_KEY,
    );
    if (cached.value) {
      const { data, timestamp } = cached.value;
      const isExpired = Date.now() - timestamp > CACHE_TTL;
      if (!isExpired) {
        console.log("Serving from Deno KV cache.");
        return data;
      }
      console.log("Cache expired, fetching fresh data...");
    } else {
      console.log("No cache found, fetching fresh data...");
    }
  }

  const results = await fetchFromNotion();

  // Update KV cache if available
  if (kv) {
    await kv.set(CACHE_KEY, {
      data: results,
      timestamp: Date.now(),
    });
  }

  // Local file generation (optional, mainly for local dev)
  try {
    const jsonOutput = JSON.stringify(results, null, 2);
    await Deno.writeTextFile("plugins.json", jsonOutput);
    console.log("File 'plugins.json' has been created successfully.");
  } catch (_e) {
    // Expected on Deno Deploy
  }

  return results;
}

/**
 * Serves the plugins list as a JSON response.
 */
function servePlugins() {
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

if (import.meta.main) {
  // Always serve in Deploy, or if started with a specific flag
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    servePlugins();
  } else {
    // Locally, just run once to generate the file and update KV
    await getPlugins();
    console.log("Done.");
    Deno.exit(0);
  }
}
