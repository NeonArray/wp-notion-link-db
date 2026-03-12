import { getPlugins, servePlugins } from "./server.ts";
import "./crons.ts";

if (import.meta.main) {
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    servePlugins();
  } else {
    // Local environment: Perform a single sync and exit
    try {
      await getPlugins();
      console.log("Done.");
      Deno.exit(0);
    } catch (err) {
      console.error("Script failed:", err);
      Deno.exit(1);
    }
  }
}
