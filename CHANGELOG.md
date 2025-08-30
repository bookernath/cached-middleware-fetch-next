# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2025-01-03

### Added
- Support for caching POST and PUT requests
  - Enables GraphQL query caching
  - Each unique request body generates a different cache key
  - Particularly useful for GraphQL endpoints where different queries need separate cache entries
- GraphQL examples in documentation

### Changed
- Updated cache logic to include POST and PUT methods alongside GET
- Documentation now highlights GraphQL support as a key feature

## [0.3.0] - 2025-01-03

### Added
- **SWR (Stale-While-Revalidate) caching strategy**
  - Returns stale data immediately while refreshing in the background
  - Uses Vercel's `waitUntil()` to extend request lifetime for background refresh
  - Separates `revalidate` time from `expires` time for optimal performance
- New `next.expires` option to set absolute cache expiry time
  - Allows serving stale data beyond revalidation time
  - Defaults to 24 hours or 10x revalidate time, whichever is larger
- Better cache TTL management based on expiry times

### Changed
- Cache entries now store both `revalidateAfter` and `expiresAt` timestamps
- Improved cache validation logic to support SWR behavior
- Documentation clarified that tag-based revalidation is not automatic

## [0.2.0] - 2025-01-03

### Changed
- **BREAKING**: Complete rewrite of cache key generation to exactly match Next.js behavior
  - Now uses "v3" version prefix for compatibility
  - Generates SHA-256 hash of request components
  - Automatically removes 'traceparent' and 'tracestate' headers to prevent cache fragmentation
  - Includes all request properties in specific order (URL, method, headers, mode, redirect, credentials, referrer, referrerPolicy, integrity, cache, body)
  - Supports custom cache key prefixes via `next.fetchCacheKeyPrefix`
- Improved body handling for different types:
  - Uint8Array: decode to string, preserve original
  - ReadableStream: consume stream, collect chunks, reconstruct as Uint8Array
  - FormData/URLSearchParams: serialize key-value pairs
  - Blob: convert to text and preserve as new Blob with same type
  - String: use directly

### Added
- Support for `next.fetchCacheKeyPrefix` option for multi-tenant scenarios
- Environment-specific SHA-256 hashing (crypto.subtle.digest for Edge, crypto.createHash for Node)

## [0.1.0] - 2025-01-03

### Added
- Initial release
- Drop-in replacement for fetch in Next.js middleware
- Uses Vercel Runtime Cache for persistence
- Supports Next.js fetch options (cache, next.revalidate, next.tags)
- Automatic cache key generation
- Graceful fallback to regular fetch if cache fails
