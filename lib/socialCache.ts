/**
 * Social Cache - Industry-Standard Caching Layer
 * Implements Stale-While-Revalidate (SWR) pattern for social features
 * 
 * Features:
 * - In-memory cache (instant reads)
 * - AsyncStorage persistence (survives app restart)
 * - TTL-based expiration
 * - Background refresh
 * - Cache invalidation on mutations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
interface CacheConfig {
    ttlMs: number;           // Time-to-live in milliseconds
    persist: boolean;        // Whether to persist to AsyncStorage
    staleWhileRevalidate: boolean;  // Return stale data while fetching
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    isStale: boolean;
}

// Default configurations for different cache types
const CACHE_CONFIGS: Record<string, CacheConfig> = {
    friends_list: { ttlMs: 5 * 60 * 1000, persist: true, staleWhileRevalidate: true },      // 5 min
    friend_requests: { ttlMs: 1 * 60 * 1000, persist: false, staleWhileRevalidate: true },  // 1 min
    leaderboard: { ttlMs: 2 * 60 * 1000, persist: false, staleWhileRevalidate: true },      // 2 min
    friend_stats: { ttlMs: 5 * 60 * 1000, persist: true, staleWhileRevalidate: true },      // 5 min
};

const CACHE_PREFIX = '@social_cache:';

// In-memory cache
const memoryCache: Map<string, CacheEntry<any>> = new Map();

// Pending fetches (to prevent duplicate requests)
const pendingFetches: Map<string, Promise<any>> = new Map();

// Background refresh callbacks
const refreshCallbacks: Map<string, () => void> = new Map();

/**
 * Get an item from cache
 * Returns cached data immediately, triggers background refresh if stale
 */
export async function getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    configKey: string = key
): Promise<T> {
    const config = CACHE_CONFIGS[configKey] || CACHE_CONFIGS.friends_list;
    const fullKey = `${CACHE_PREFIX}${key}`;

    // 1. Check memory cache first (fastest)
    const memoryEntry = memoryCache.get(fullKey);
    if (memoryEntry) {
        const age = Date.now() - memoryEntry.timestamp;
        const isExpired = age > config.ttlMs;

        if (!isExpired) {
            // Fresh data - return immediately
            return memoryEntry.data;
        }

        if (config.staleWhileRevalidate) {
            // Stale but usable - return and refresh in background
            triggerBackgroundRefresh(key, fetcher, config);
            return memoryEntry.data;
        }
    }

    // 2. Check AsyncStorage if persistent
    if (config.persist) {
        try {
            const stored = await AsyncStorage.getItem(fullKey);
            if (stored) {
                const entry: CacheEntry<T> = JSON.parse(stored);
                const age = Date.now() - entry.timestamp;

                // Cache to memory
                memoryCache.set(fullKey, entry);

                if (age <= config.ttlMs) {
                    return entry.data;
                }

                if (config.staleWhileRevalidate) {
                    triggerBackgroundRefresh(key, fetcher, config);
                    return entry.data;
                }
            }
        } catch (e) {
            console.log('[SocialCache] AsyncStorage read error:', e);
        }
    }

    // 3. No cache, fetch fresh data
    return fetchAndCache(key, fetcher, config);
}

/**
 * Fetch fresh data and update cache
 */
async function fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
): Promise<T> {
    const fullKey = `${CACHE_PREFIX}${key}`;

    // Prevent duplicate fetches for the same key
    const pending = pendingFetches.get(fullKey);
    if (pending) {
        return pending as Promise<T>;
    }

    const fetchPromise = (async () => {
        try {
            const data = await fetcher();

            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                isStale: false
            };

            // Update memory cache
            memoryCache.set(fullKey, entry);

            // Persist if configured
            if (config.persist) {
                try {
                    await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
                } catch (e) {
                    console.log('[SocialCache] AsyncStorage write error:', e);
                }
            }

            return data;
        } finally {
            pendingFetches.delete(fullKey);
        }
    })();

    pendingFetches.set(fullKey, fetchPromise);
    return fetchPromise;
}

/**
 * Trigger a background refresh without blocking
 */
function triggerBackgroundRefresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig
): void {
    const fullKey = `${CACHE_PREFIX}${key}`;

    // Already refreshing
    if (pendingFetches.has(fullKey)) return;

    // Background fetch (non-blocking)
    fetchAndCache(key, fetcher, config).catch(e => {
        console.log('[SocialCache] Background refresh failed:', e);
    });
}

/**
 * Invalidate a specific cache key
 */
export async function invalidateCache(key: string): Promise<void> {
    const fullKey = `${CACHE_PREFIX}${key}`;
    memoryCache.delete(fullKey);

    try {
        await AsyncStorage.removeItem(fullKey);
    } catch (e) {
        console.log('[SocialCache] Invalidate error:', e);
    }
}

/**
 * Invalidate all caches matching a pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
    // Clear matching memory cache entries
    const keysToDelete = Array.from(memoryCache.keys()).filter(key => key.includes(pattern));
    keysToDelete.forEach(key => memoryCache.delete(key));

    // Clear matching AsyncStorage entries
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const matchingKeys = allKeys.filter(k => k.includes(`${CACHE_PREFIX}${pattern}`));
        if (matchingKeys.length > 0) {
            await AsyncStorage.multiRemove(matchingKeys);
        }
    } catch (e) {
        console.log('[SocialCache] Pattern invalidate error:', e);
    }
}

/**
 * Invalidate all social caches (e.g., on logout or friend mutation)
 */
export async function invalidateAllSocialCaches(): Promise<void> {
    memoryCache.clear();

    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
        }
    } catch (e) {
        console.log('[SocialCache] Clear all error:', e);
    }
}

/**
 * Prefetch and cache data (useful for anticipated navigation)
 */
export async function prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    configKey: string = key
): Promise<void> {
    const config = CACHE_CONFIGS[configKey] || CACHE_CONFIGS.friends_list;

    // Don't prefetch if we have fresh data
    const fullKey = `${CACHE_PREFIX}${key}`;
    const existing = memoryCache.get(fullKey);
    if (existing && (Date.now() - existing.timestamp) < config.ttlMs) {
        return;
    }

    // Fetch in background
    fetchAndCache(key, fetcher, config).catch(() => { });
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { memoryEntries: number; keys: string[] } {
    return {
        memoryEntries: memoryCache.size,
        keys: Array.from(memoryCache.keys())
    };
}

/**
 * Force refresh a cache key (bypass stale-while-revalidate)
 */
export async function forceRefresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    configKey: string = key
): Promise<T> {
    const config = CACHE_CONFIGS[configKey] || CACHE_CONFIGS.friends_list;
    return fetchAndCache(key, fetcher, config);
}
