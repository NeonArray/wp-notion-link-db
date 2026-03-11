export interface PluginInfo {
  plugin: string;
  url: string;
}

export const CACHE_KEY = ["plugins"];
export const CACHE_TTL = 1000 * 60 * 60; // 1 hour
