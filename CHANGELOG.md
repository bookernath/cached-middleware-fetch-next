# Changelog

All notable changes to this project will be documented in this file.

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
