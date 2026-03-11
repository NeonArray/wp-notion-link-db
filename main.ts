import { getPlugins, servePlugins, setCronJob } from "./server.ts";

if (import.meta.main) {
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    // Deno Deploy environment: Start server and cron job
    try {
      await setCronJob();
    } catch (err) {
      console.error("Failed to register Deno.cron:", err);
    }
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
