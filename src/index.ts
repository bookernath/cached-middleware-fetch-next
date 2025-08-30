// @ts-ignore - getCache is available at runtime on Vercel
import { getCache } from '@vercel/functions';
import type { CachedFetchOptions, CacheEntry, CacheKeyOptions } from './types';

// Re-export types for convenience
export type { CachedFetchOptions, CacheEntry } from './types';

/**
 * Generate a unique cache key for the request
 */
function generateCacheKey(options: CacheKeyOptions): string {
  const { url, method = 'GET', headers = {}, body } = options;
  
  // Create a stable key from request properties
  const keyParts = [
    url,
    method.toUpperCase(),
  ];
  
  // Add relevant headers to the key (like authorization, content-type)
  if (headers) {
    let headerObj: Record<string, string> = {};
    
    if (headers instanceof Headers) {
      // Convert Headers to object
      headers.forEach((value, key) => {
        headerObj[key] = value;
      });
    } else if (Array.isArray(headers)) {
      // Handle array format
      headers.forEach(([key, value]) => {
        headerObj[key] = value;
      });
    } else {
      // Handle object format
      headerObj = headers as Record<string, string>;
    }
    
    const relevantHeaders = ['authorization', 'content-type', 'accept'];
    relevantHeaders.forEach(header => {
      const value = headerObj[header] || headerObj[header.toLowerCase()];
      if (value) {
        keyParts.push(`${header}:${value}`);
      }
    });
  }
  
  // Add body to key for non-GET requests
  if (body && method !== 'GET') {
    keyParts.push(typeof body === 'string' ? body : JSON.stringify(body));
  }
  
  return keyParts.join('|');
}

/**
 * Check if a cache entry is still valid based on revalidate time
 */
function isCacheEntryValid(entry: CacheEntry): boolean {
  if (entry.revalidate === false) {
    // Cache indefinitely
    return true;
  }
  
  if (typeof entry.revalidate === 'number' && entry.revalidate > 0) {
    const expiryTime = entry.timestamp + (entry.revalidate * 1000);
    return Date.now() < expiryTime;
  }
  
  // Default behavior - cache is valid
  return true;
}

/**
 * Convert a Response object to a serializable cache entry
 */
async function responseToCache(response: Response, options?: CachedFetchOptions): Promise<CacheEntry> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  const data = await response.text();
  
  return {
    data,
    headers,
    status: response.status,
    statusText: response.statusText,
    timestamp: Date.now(),
    revalidate: options?.next?.revalidate,
    tags: options?.next?.tags,
  };
}

/**
 * Convert a cache entry back to a Response object
 */
function cacheToResponse(entry: CacheEntry): Response {
  return new Response(entry.data, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

/**
 * Clean fetch options by removing custom properties
 */
function cleanFetchOptions(options?: CachedFetchOptions): RequestInit | undefined {
  if (!options) return undefined;
  
  // Create a copy without our custom properties
  const { cache, next, ...rest } = options;
  const cleanOptions: RequestInit = { ...rest };
  
  // Map our custom cache values to standard RequestCache if needed
  if (cache === 'no-store') {
    cleanOptions.cache = 'no-store';
  } else if (cache === 'force-cache') {
    cleanOptions.cache = 'force-cache';
  }
  // 'auto no cache' doesn't have a direct mapping, so we omit it
  
  return cleanOptions;
}

/**
 * A fetch wrapper that uses Vercel Runtime Cache for caching
 * Mimics Next.js Data Cache API for use in edge middleware
 */
export async function cachedFetch(
  input: RequestInfo | URL,
  init?: CachedFetchOptions
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';
  
  // Determine cache behavior
  const cacheOption = init?.cache || 'auto no cache';
  const revalidate = init?.next?.revalidate;
  
  // Skip cache for no-store or revalidate: 0
  if (cacheOption === 'no-store' || revalidate === 0) {
    return fetch(input, cleanFetchOptions(init));
  }
  
  // Generate cache key
  const cacheKey = generateCacheKey({
    url,
    method,
    headers: init?.headers,
    body: init?.body,
  });
  
  // Get Vercel Runtime Cache instance
  const cache = getCache();
  
  try {
    // Try to get from cache first
    if (cacheOption === 'force-cache' || cacheOption === 'auto no cache') {
      const cachedEntry = await cache.get<CacheEntry>(cacheKey);
      
      if (cachedEntry && isCacheEntryValid(cachedEntry)) {
        // Return cached response
        return cacheToResponse(cachedEntry);
      }
    }
    
    // Fetch from origin
    const response = await fetch(input, cleanFetchOptions(init));
    
    // Only cache successful responses (2xx) and GET requests by default
    if (response.ok && method === 'GET') {
      const cacheEntry = await responseToCache(response.clone(), init);
      
      // Store in cache (fire and forget)
      cache.set(cacheKey, cacheEntry).catch((error: unknown) => {
        console.error('[cached-middleware-fetch] Failed to cache response:', error);
      });
    }
    
    return response;
  } catch (error) {
    // If cache operations fail, fallback to regular fetch
    console.error('[cached-middleware-fetch] Cache operation failed:', error);
    return fetch(input, cleanFetchOptions(init));
  }
}

// Export as default for easier drop-in replacement
export default cachedFetch;

// Named exports for specific use cases
export { cachedFetch as fetch };
