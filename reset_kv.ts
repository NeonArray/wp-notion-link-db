const kv = await Deno.openKv();
await kv.delete(["plugins"]);
console.log("Deno KV cache for ['plugins'] has been cleared.");
kv.close();
