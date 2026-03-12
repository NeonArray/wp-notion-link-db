
Deno.cron("Daily Notion Sync", "0 0 * * *", async () => {
    console.log("CRON: Starting daily Notion sync...");
    await getPlugins(true);
    console.log("CRON: Daily Notion sync completed.");
});

