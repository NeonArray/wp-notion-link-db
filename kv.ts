import { CACHE_KEY, PluginInfo } from "./types.ts";

let _kv: Deno.Kv | null = null;

/**
 * Lazy initialization of Deno KV.
 */
export async function getKv(): Promise<Deno.Kv | null> {
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

/**
 * Stores plugins in Deno KV.
 */
export async function storePlugins(plugins: PluginInfo[]): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(CACHE_KEY, {
      data: plugins,
      timestamp: Date.now(),
    });
  }
}

/**
 * Retrieves plugins from Deno KV.
 */
export async function getCachedPlugins(): Promise<{
  data: PluginInfo[];
  timestamp: number;
} | null> {
  const kv = await getKv();
  if (!kv) return null;

  const cached = await kv.get<{ data: PluginInfo[]; timestamp: number }>(
    CACHE_KEY,
  );
  return cached.value;
}

/**
 * Clears the plugins cache.
 */
export async function clearCache(): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.delete(CACHE_KEY);
  }
}
