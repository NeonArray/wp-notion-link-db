import { clearCache } from "./kv.ts";

try {
  await clearCache();
  console.log("Deno KV cache for ['plugins'] has been cleared.");
} catch (err) {
  console.error("Failed to reset Deno KV:", err);
  Deno.exit(1);
}
