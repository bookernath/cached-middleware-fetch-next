# cached-middleware-fetch-next

A Next.js fetch wrapper for edge middleware that uses Vercel Runtime Cache as its caching backend. This package provides a drop-in replacement for the native fetch API that mimics Next.js's Data Cache behavior in edge middleware environments where the standard Data Cache is not available.

## Installation

```bash
npm install cached-middleware-fetch-next
# or
yarn add cached-middleware-fetch-next
# or
pnpm add cached-middleware-fetch-next
```

## Why?

In Next.js edge middleware, the built-in Data Cache that normally works with `fetch()` is not available. This package solves that problem by providing a fetch wrapper that uses Vercel's Runtime Cache as its backend, allowing you to cache fetch requests in middleware with the same familiar API as Next.js's extended fetch.

## Features

- 🚀 Drop-in replacement for fetch in Next.js middleware
- 💾 Uses Vercel Runtime Cache for persistence
- 🔄 Supports Next.js fetch options (`cache`, `next.revalidate`, `next.tags`)
- 🎯 Automatic cache key generation
- ⚡ Graceful fallback to regular fetch if cache fails
- 📦 Lightweight with minimal dependencies

## Usage

### Basic Usage

Simply import and use as a replacement for the native fetch:

```typescript
import { cachedFetch } from 'cached-middleware-fetch-next';

export async function middleware(request: NextRequest) {
  // This will be cached using Vercel Runtime Cache
  const response = await cachedFetch('https://api.example.com/data');
  const data = await response.json();
  
  // Use the data in your middleware logic
  return NextResponse.next();
}
```

### Using Next.js Cache Options

The wrapper supports the same caching options as Next.js's extended fetch API:

```typescript
import { cachedFetch } from 'cached-middleware-fetch-next';

// Force cache (default behavior)
const response1 = await cachedFetch('https://api.example.com/data', {
  cache: 'force-cache'
});

// No store - bypass cache entirely
const response2 = await cachedFetch('https://api.example.com/data', {
  cache: 'no-store'
});

// Revalidate after 60 seconds
const response3 = await cachedFetch('https://api.example.com/data', {
  next: { revalidate: 60 }
});

// Cache indefinitely
const response4 = await cachedFetch('https://api.example.com/data', {
  next: { revalidate: false }
});

// Cache with tags (for future on-demand revalidation)
const response5 = await cachedFetch('https://api.example.com/data', {
  next: { tags: ['api-data', 'products'] }
});

// Use custom cache key prefix for multi-tenant scenarios
const response6 = await cachedFetch('https://api.example.com/data', {
  next: { 
    revalidate: 300,
    fetchCacheKeyPrefix: `tenant-${tenantId}` 
  }
});
```

### Real-World Example: Route Resolution in Middleware

Here's an example of using the package for caching route lookups in middleware:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from 'cached-middleware-fetch-next';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Cache route resolution for 30 minutes
  const routeResponse = await cachedFetch(
    `https://api.example.com/routes?path=${pathname}`,
    {
      next: { 
        revalidate: 1800, // 30 minutes
        tags: ['routes']
      }
    }
  );
  
  const route = await routeResponse.json();
  
  if (route.redirect) {
    return NextResponse.redirect(new URL(route.redirect, request.url));
  }
  
  if (route.rewrite) {
    return NextResponse.rewrite(new URL(route.rewrite, request.url));
  }
  
  return NextResponse.next();
}
```

### Using as a Drop-in Replacement

You can also import it as `fetch` for easier migration:

```typescript
import { fetch } from 'cached-middleware-fetch-next';

// Now you can use it exactly like native fetch
const response = await fetch('https://api.example.com/data', {
  next: { revalidate: 300 }
});
```

## API Reference

### `cachedFetch(input, init?)`

#### Parameters

- `input`: `RequestInfo | URL` - The resource to fetch
- `init?`: `CachedFetchOptions` - Extended fetch options

#### CachedFetchOptions

Extends the standard `RequestInit` with:

```typescript
interface CachedFetchOptions extends RequestInit {
  cache?: 'auto no cache' | 'no-store' | 'force-cache';
  next?: {
    revalidate?: false | 0 | number;
    tags?: string[];
  };
}
```

#### Cache Options

- `'force-cache'`: Look for a match in the cache first, fetch if not found or stale
- `'no-store'`: Always fetch from the remote server, bypass cache
- `'auto no cache'` (default): Intelligent caching based on context

#### Revalidation Options

- `false`: Cache indefinitely
- `0`: Prevent caching (same as `cache: 'no-store'`)
- `number`: Cache lifetime in seconds

## How It Works

1. **Cache Key Generation**: Generates cache keys exactly matching Next.js's behavior:
   - Uses "v3" version prefix for compatibility
   - Creates SHA-256 hash of request components
   - Includes URL, method, headers, body, and all request options
   - Automatically removes 'traceparent' and 'tracestate' headers to prevent cache fragmentation
   - Supports custom cache key prefixes via `next.fetchCacheKeyPrefix`
2. **Runtime Cache**: Uses Vercel's Runtime Cache (`@vercel/functions`) for storage
3. **Automatic Expiry**: Honors revalidation times and checks cache validity
4. **Graceful Degradation**: Falls back to regular fetch if cache operations fail

## Requirements

- Next.js 14.0.0 or later
- @vercel/functions 1.4.0 or later
- Deployed on Vercel (Runtime Cache is a Vercel feature)

## Edge Runtime Compatibility

This package is designed specifically for the Edge Runtime and works in:

- Next.js Middleware
- Edge Route Handlers
- Edge API Routes

## Limitations

- Only caches successful responses (2xx status codes)
- Only caches GET requests by default
- Cache tags are stored but on-demand revalidation is not yet implemented
- Runtime Cache has size limits (check Vercel documentation)
- The `getCache` function from `@vercel/functions` is only available at runtime on Vercel's infrastructure

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
