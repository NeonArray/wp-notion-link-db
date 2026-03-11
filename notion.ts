import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints.d.ts";
import { PluginInfo } from "./types.ts";

/**
 * Accesses Notion, filters rows in a database, and extracts plugin info.
 */
export async function fetchFromNotion(): Promise<PluginInfo[]> {
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
    throw new Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID.");
  }

  const notion = new Client({ auth: apiKey });

  console.log(`Querying Notion database: ${databaseId}...`);

  const response = (await notion.databases.query({
    database_id: databaseId,
  })) as QueryDatabaseResponse;

  return (response.results as PageObjectResponse[])
    .filter((page) => {
      const dependencyProp = page.properties["Dependency/Framework"];
      const languageProp = page.properties["Language"];

      let dependency = "";
      if (dependencyProp?.type === "select") {
        dependency = dependencyProp.select?.name || "";
      } else if (dependencyProp?.type === "multi_select") {
        dependency = dependencyProp.multi_select?.map((s) => s.name).join(",") ||
          "";
      }

      let language = "";
      if (languageProp?.type === "select") {
        language = languageProp.select?.name || "";
      } else if (languageProp?.type === "multi_select") {
        language = languageProp.multi_select?.map((s) => s.name).join(",") || "";
      }

      return dependency === "WordPress" || language === "PHP";
    })
    .map((page) => {
      const url = page.url;
      const pluginIndexProp = page.properties["Plugin File Index"];
      let plugin = "";

      if (pluginIndexProp) {
        if (pluginIndexProp.type === "rich_text") {
          plugin = pluginIndexProp.rich_text.map((t) => t.plain_text).join("") ||
            "";
        } else if (pluginIndexProp.type === "title") {
          plugin = pluginIndexProp.title.map((t) => t.plain_text).join("") || "";
        } else if (pluginIndexProp.type === "number") {
          plugin = pluginIndexProp.number?.toString() || "";
        }
      }

      return { plugin, url };
    })
    .filter((item) => item.plugin !== "");
}
