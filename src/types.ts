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
     * Set the cache lifetime of a resource (in seconds)
     * - false: Cache indefinitely
     * - 0: Prevent caching
     * - number: Cache for specified seconds
     */
    revalidate?: false | 0 | number;
    
    /**
     * Set cache tags for on-demand revalidation
     */
    tags?: string[];
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
  revalidate?: false | number;
  tags?: string[];
}

/**
 * Options for cache key generation
 */
export interface CacheKeyOptions {
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}
