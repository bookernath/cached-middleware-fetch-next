/**
 * Extended fetch options that mirror Next.js fetch API
 */
export interface CachedFetchOptions extends Omit<RequestInit, 'cache'> {
  /**
   * Configure how the request should interact with the cache.
   * - 'auto no cache' (default): Fetches on every request in development, once during build for static routes
   * - 'no-store': Always fetches from the remote server
   * - 'force-cache': Looks for a match in cache first, fetches if not found or stale
   */
  cache?: 'auto no cache' | 'no-store' | 'force-cache';
  
  /**
   * Next.js specific options
   */
  next?: {
    /**
     * Set the revalidation time for SWR-style caching (in seconds)
     * - false: Never revalidate (cache indefinitely)
     * - 0: Prevent caching
     * - number: Revalidate after specified seconds
     */
    revalidate?: false | 0 | number;
    
    /**
     * Set the absolute expiry time for cache entries (in seconds)
     * If not specified, defaults to 24 hours (86400 seconds)
     * Must be greater than revalidate time
     */
    expires?: number;
    
    /**
     * Set cache tags for manual cache invalidation
     * Note: Tag-based revalidation is not automatically supported,
     * but tags can be used with Vercel's cache APIs for manual clearing
     */
    tags?: string[];
    
    /**
     * Optional prefix for cache key generation
     */
    fetchCacheKeyPrefix?: string;
  };
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  timestamp: number;
  revalidateAfter?: number; // Timestamp when revalidation should occur
  expiresAt?: number; // Timestamp when cache entry expires
  tags?: string[];
}


