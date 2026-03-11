if (typeof Deno.openKv !== "function") {
  console.error(
    "Error: Deno.openKv is not available. Please run with --unstable-kv flag if using Deno < 2.0.",
  );
  Deno.exit(1);
}

try {
  const kv = await Deno.openKv();
  await kv.delete(["plugins"]);
  console.log("Deno KV cache for ['plugins'] has been cleared.");
  kv.close();
} catch (err) {
  console.error("Failed to reset Deno KV:", err);
  Deno.exit(1);
}
