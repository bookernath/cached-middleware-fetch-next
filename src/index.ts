// @ts-ignore - getCache and waitUntil are available at runtime on Vercel
import { getCache, waitUntil } from '@vercel/functions';
import type { CachedFetchOptions, CacheEntry } from './types';

// Re-export types for convenience
export type { CachedFetchOptions, CacheEntry } from './types';

/**
 * Process body for cache key generation, matching Next.js behavior
 * Note: The body is consumed here for cache key generation only.
 * The original body is preserved for the actual fetch request.
 */
async function processBodyForCacheKey(body: BodyInit | null | undefined): Promise<{ chunks: any[], ogBody?: BodyInit }> {
  if (!body) return { chunks: [] };
  
  // Handle Uint8Array
  if (body instanceof Uint8Array) {
    const decoder = new TextDecoder();
    const decoded = decoder.decode(body);
    return { chunks: [decoded], ogBody: body };
  }
  
  // Handle ReadableStream
  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    // Reconstruct as single Uint8Array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    const decoded = decoder.decode(combined);
    return { chunks: [decoded], ogBody: combined };
  }
  
  // Handle FormData
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const serialized: string[] = [];
    body.forEach((value, key) => {
      if (typeof value === 'string') {
        serialized.push(`${key}=${value}`);
      }
    });
    return { chunks: [serialized.join(',')] };
  }
  
  // Handle URLSearchParams
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    const serialized: string[] = [];
    body.forEach((value, key) => {
      serialized.push(`${key}=${value}`);
    });
    return { chunks: [serialized.join(',')] };
  }
  
  // Handle Blob
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    const text = await body.text();
    const newBlob = new Blob([text], { type: body.type });
    return { chunks: [text], ogBody: newBlob };
  }
  
  // Handle string
  if (typeof body === 'string') {
    return { chunks: [body] };
  }
  
  // Fallback
  return { chunks: [JSON.stringify(body)] };
}

/**
 * Convert headers to plain object and remove trace context headers
 * CRITICAL: Removes 'traceparent' and 'tracestate' headers from cache key
 * to prevent cache fragmentation in distributed tracing scenarios
 */
function processHeadersForCacheKey(headers: HeadersInit | undefined): Record<string, string> {
  const headerObj: Record<string, string> = {};
  
  if (!headers) return headerObj;
  
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip trace context headers
      if (lowerKey !== 'traceparent' && lowerKey !== 'tracestate') {
        headerObj[lowerKey] = value;
      }
    });
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      // Skip trace context headers
      if (lowerKey !== 'traceparent' && lowerKey !== 'tracestate') {
        headerObj[lowerKey] = value;
      }
    });
  } else {
    // Plain object
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      // Skip trace context headers
      if (lowerKey !== 'traceparent' && lowerKey !== 'tracestate') {
        headerObj[lowerKey] = value as string;
      }
    });
  }
  
  return headerObj;
}

/**
 * Generate SHA-256 hash of a string
 */
async function sha256(message: string): Promise<string> {
  // Check if we're in Edge runtime (crypto.subtle is available)
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Node.js runtime
  // @ts-ignore - crypto module is available in Node.js
  const { createHash } = await import('crypto');
  return createHash('sha256').update(message).digest('hex');
}

/**
 * Generate a cache key matching Next.js fetch cache behavior
 */
async function generateCacheKey(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetchCacheKeyPrefix?: string,
  preprocessedBodyChunks?: any[]
): Promise<string> {
  // Extract URL and create Request object for consistent processing
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const request = new Request(url, init);
  
  // Process body
  const bodyChunks = preprocessedBodyChunks ?? (await processBodyForCacheKey(init?.body)).chunks;
  
  // Process headers (removing trace context headers)
  const headers = processHeadersForCacheKey(init?.headers);
  
  // Build cache key components in exact order
  const keyComponents = [
    'v3', // Version prefix
    fetchCacheKeyPrefix || '',
    url,
    request.method,
    headers,
    request.mode || '',
    request.redirect || '',
    request.credentials || '',
    request.referrer || '',
    request.referrerPolicy || '',
    request.integrity || '',
    request.cache || '',
    bodyChunks
  ];
  
  // Generate hash
  const jsonString = JSON.stringify(keyComponents);
  return sha256(jsonString);
}

/**
 * Check if a cache entry has expired (not just stale)
 */
function isCacheEntryExpired(entry: CacheEntry): boolean {
  if (!entry.expiresAt) {
    // No expiry set, consider valid
    return false;
  }
  
  return Date.now() > entry.expiresAt;
}

/**
 * Check if a cache entry needs revalidation
 */
function needsRevalidation(entry: CacheEntry): boolean {
  if (!entry.revalidateAfter) {
    // No revalidation time set
    return false;
  }
  
  return Date.now() > entry.revalidateAfter;
}

/**
 * Convert a Response object to a serializable cache entry
 */
async function responseToCache(response: Response, options?: CachedFetchOptions): Promise<CacheEntry> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  
  const contentType = response.headers.get('content-type') || '';
  const shouldTreatAsText = /^(text\/|application\/(json|javascript|xml|x-www-form-urlencoded)|image\/svg\+xml)/i.test(contentType);
  let data: string;
  let isBinary = false;
  if (shouldTreatAsText) {
    data = await response.text();
  } else {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    data = toBase64(bytes);
    isBinary = true;
  }
  const now = Date.now();
  
  // Calculate revalidation and expiry times
  let revalidateAfter: number | undefined;
  let expiresAt: number | undefined;
  
  const revalidate = options?.next?.revalidate;
  const expires = options?.next?.expires;
  
  if (revalidate === false) {
    // Never revalidate, but set a default expiry of 365 days
    expiresAt = now + (365 * 24 * 60 * 60 * 1000);
  } else if (typeof revalidate === 'number' && revalidate > 0) {
    revalidateAfter = now + (revalidate * 1000);
    
    // Set expiry time
    if (expires && expires > revalidate) {
      expiresAt = now + (expires * 1000);
    } else {
      // Default expiry: 24 hours or 10x revalidate time, whichever is larger
      const defaultExpiry = Math.max(86400, revalidate * 10);
      expiresAt = now + (defaultExpiry * 1000);
    }
  }
  
  return {
    data,
    headers,
    status: response.status,
    statusText: response.statusText,
    timestamp: now,
    revalidateAfter,
    expiresAt,
    tags: options?.next?.tags,
    isBinary,
    contentType: contentType || undefined,
  };
}

/**
 * Convert a cache entry back to a Response object with cache status headers
 */
function cacheToResponse(entry: CacheEntry, cacheStatus: 'HIT' | 'STALE' = 'HIT'): Response {
  const headers = new Headers(entry.headers);
  headers.delete('content-length');
  if (entry.contentType && !headers.get('content-type')) {
    headers.set('content-type', entry.contentType);
  }
  
  // Add cache status headers
  const now = Date.now();
  const cacheAge = Math.floor((now - entry.timestamp) / 1000);
  headers.set('X-Cache-Status', cacheStatus);
  headers.set('X-Cache-Age', cacheAge.toString());
  
  if (entry.expiresAt) {
    const expiresIn = Math.max(0, Math.floor((entry.expiresAt - now) / 1000));
    headers.set('X-Cache-Expires-In', expiresIn.toString());
  }
  
  let body: BodyInit | null = null;
  if ((entry as any).isBinary) {
    const bytes = fromBase64(entry.data as string);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as unknown as ArrayBuffer;
    body = ab;
  } else {
    body = entry.data as string;
  }
  return new Response(body, {
    status: entry.status,
    statusText: entry.statusText,
    headers,
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

function toBase64(bytes: Uint8Array): string {
  // @ts-ignore - Buffer may be available in Node runtime
  if (typeof Buffer !== 'undefined') {
    // @ts-ignore
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  // @ts-ignore - btoa available in Edge/Web runtimes
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  // @ts-ignore - Buffer may be available in Node runtime
  if (typeof Buffer !== 'undefined') {
    // @ts-ignore
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  // @ts-ignore - atob available in Edge/Web runtimes
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function computeTTL(expiresAt?: number): number {
  if (!expiresAt) return 86400;
  const ttl = Math.floor((expiresAt - Date.now()) / 1000);
  return Math.max(60, ttl);
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
  const cleanOptions = cleanFetchOptions(init) || {};
  const method = (cleanOptions.method ? String(cleanOptions.method) : 'GET').toUpperCase();
  cleanOptions.method = method;
  
  // Determine cache behavior
  const cacheOption = init?.cache || 'auto no cache';
  const revalidate = init?.next?.revalidate;
  
  // Skip cache for no-store or revalidate: 0
  if (cacheOption === 'no-store' || revalidate === 0) {
    const response = await fetch(input, cleanOptions);
    
    // Clone the response to avoid body consumption issues
    const responseClone = response.clone();
    
    // Add cache status headers to indicate cache was bypassed
    const responseWithCacheHeaders = new Response(responseClone.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
    responseWithCacheHeaders.headers.set('X-Cache-Status', 'MISS');
    responseWithCacheHeaders.headers.set('X-Cache-Age', '0');
    
    return responseWithCacheHeaders;
  }
  
  // Generate cache key
  const { chunks: bodyChunks, ogBody } = await processBodyForCacheKey(init?.body);
  if (ogBody !== undefined) {
    cleanOptions.body = ogBody;
  }
  const cacheKey = await generateCacheKey(input, cleanOptions, init?.next?.fetchCacheKeyPrefix, bodyChunks);
  
  // Get Vercel Runtime Cache instance
  const cache = getCache();
  
  try {
    // Try to get from cache first
    if (cacheOption === 'force-cache' || cacheOption === 'auto no cache') {
      const cachedEntry = await cache.get(cacheKey) as CacheEntry | undefined;
      
      if (
        cachedEntry &&
        typeof cachedEntry.status === 'number' &&
        cachedEntry.data !== undefined &&
        cachedEntry.headers &&
        !isCacheEntryExpired(cachedEntry)
      ) {
        // Check if we need to revalidate in the background
        const isStale = needsRevalidation(cachedEntry);
        if (isStale) {
          // Return stale data immediately and refresh in background (SWR)
          const backgroundRefresh = async () => {
            try {
              const freshResponse = await fetch(input, cleanOptions);
              
              if (freshResponse.ok && (method === 'GET' || method === 'POST' || method === 'PUT')) {
                const freshCacheEntry = await responseToCache(freshResponse.clone(), init);
                const cacheTTL = computeTTL(freshCacheEntry.expiresAt);
                await cache.set(cacheKey, freshCacheEntry, { ttl: cacheTTL });
              }
            } catch (error) {
              console.error('[cached-middleware-fetch] Background refresh failed:', error);
            }
          };
          
          // Use waitUntil to extend the lifetime of the request for background refresh
          if (typeof waitUntil === 'function') {
            waitUntil(backgroundRefresh());
          } else {
            // Fallback if waitUntil is not available (non-Vercel environment)
            backgroundRefresh().catch(() => {});
          }
        }
        
        // Return cached response with appropriate cache status
        return cacheToResponse(cachedEntry, isStale ? 'STALE' : 'HIT');
      }
    }
    
    // Fetch from origin (cache miss or expired)
    const response = await fetch(input, cleanOptions);
    
    // Clone the response first to avoid body consumption issues
    const responseForCaching = response.clone();
    const responseForReturn = response.clone();
    
    // Add cache status headers to indicate this was a miss
    const responseWithCacheHeaders = new Response(responseForReturn.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
    responseWithCacheHeaders.headers.set('X-Cache-Status', 'MISS');
    responseWithCacheHeaders.headers.set('X-Cache-Age', '0');
    
    // Only cache successful responses (2xx) and GET/POST/PUT requests
    if (response.ok && (method === 'GET' || method === 'POST' || method === 'PUT')) {
      const cacheEntry = await responseToCache(responseForCaching, init);
      
      // Store in cache with appropriate TTL
      const cacheTTL = computeTTL(cacheEntry.expiresAt);
      
      cache.set(cacheKey, cacheEntry, { ttl: cacheTTL }).catch((error: unknown) => {
        console.error('[cached-middleware-fetch] Failed to cache response:', error);
      });
    }
    
    return responseWithCacheHeaders;
  } catch (error) {
    // If cache operations fail, fallback to regular fetch
    console.error('[cached-middleware-fetch] Cache operation failed:', error);
    const fallbackResponse = await fetch(input, cleanOptions);
    
    // Clone the response to avoid body consumption issues
    const fallbackResponseClone = fallbackResponse.clone();
    
    // Add cache status headers to indicate this was a miss due to error
    const responseWithCacheHeaders = new Response(fallbackResponseClone.body, {
      status: fallbackResponse.status,
      statusText: fallbackResponse.statusText,
      headers: new Headers(fallbackResponse.headers)
    });
    responseWithCacheHeaders.headers.set('X-Cache-Status', 'MISS');
    responseWithCacheHeaders.headers.set('X-Cache-Age', '0');
    
    return responseWithCacheHeaders;
  }
}

// Export as default for easier drop-in replacement
export default cachedFetch;

// Named exports for specific use cases
export { cachedFetch as fetch };
