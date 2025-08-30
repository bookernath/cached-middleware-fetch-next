// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from 'cached-middleware-fetch-next';

/**
 * Example middleware showcasing all capabilities of cached-middleware-fetch-next
 * Demonstrates SWR caching, cache status headers, GraphQL support, and various cache strategies
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const userId = request.cookies.get('user-id')?.value;

  try {
    // Example 1: SWR Caching with separate revalidate and expiry times
    // Returns stale data immediately, refreshes in background after 30 minutes
    // Keeps serving stale data for up to 24 hours if origin is down
    const productsResponse = await cachedFetch('https://api.example.com/products', {
      next: {
        revalidate: 1800,  // Consider stale after 30 minutes
        expires: 86400,    // Keep stale data for up to 24 hours
        tags: ['products', 'catalog'],
      },
    });

    const products = await productsResponse.json();
    
    // Comprehensive cache status monitoring
    const cacheStatus = productsResponse.headers.get('X-Cache-Status'); // 'HIT' | 'MISS' | 'STALE'
    const cacheAge = productsResponse.headers.get('X-Cache-Age');
    const expiresIn = productsResponse.headers.get('X-Cache-Expires-In');
    console.log(`Products API: ${cacheStatus} (${cacheAge}s old, expires in ${expiresIn}s)`);

    // Example 2: Multi-tenant caching with custom cache key prefix
    // Different tenants get separate cache entries for the same endpoint
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const tenantSettingsResponse = await cachedFetch('https://api.example.com/settings', {
      next: { 
        revalidate: false, // Cache indefinitely
        tags: ['settings', `tenant-${tenantId}`],
        fetchCacheKeyPrefix: `tenant-${tenantId}` // Separate cache per tenant
      },
    });

    const tenantSettings = await tenantSettingsResponse.json();

    // Example 3: Force cache strategy - always check cache first
    const configResponse = await cachedFetch('https://api.example.com/config', {
      cache: 'force-cache', // Always try cache first
      next: {
        revalidate: 3600, // 1 hour
        tags: ['config']
      }
    });

    // Example 4: No-store for analytics and side effects
    // Never cache requests that have side effects or track user behavior
    await cachedFetch('https://analytics.example.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({ 
        event: 'page_view', 
        path: pathname,
        userId,
        timestamp: Date.now()
      }),
      cache: 'no-store', // Never cache side-effect requests
    });

    // Example 5: GraphQL with variable-based cache separation
    // Different queries and variables get separate cache entries automatically
    const routeGraphQLResponse = await cachedFetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.cookies.get('auth-token')?.value || ''}`,
      },
      body: JSON.stringify({
        query: `
          query GetRouteConfig($path: String!, $userAgent: String!) {
            route(path: $path) {
              redirect
              rewrite
              middleware
              rateLimit(userAgent: $userAgent) {
                allowed
                remaining
              }
            }
          }
        `,
        variables: { 
          path: pathname,
          userAgent: userAgent.substring(0, 100) // Limit length for cache key
        },
      }),
      next: {
        revalidate: 900,   // 15 minutes (shorter for dynamic routing)
        expires: 7200,     // 2 hours max stale time
        tags: ['routes', 'routing-config'],
      },
    });

    const routeData = await routeGraphQLResponse.json();

    // Example 6: Binary/Image caching with proper content-type handling
    if (pathname.startsWith('/api/images/')) {
      const imageId = pathname.split('/').pop();
      const imageResponse = await cachedFetch(`https://cdn.example.com/images/${imageId}`, {
        next: {
          revalidate: 3600,  // 1 hour
          expires: 604800,   // 1 week for images
          tags: ['images', `image-${imageId}`]
        }
      });
      
      // Return the cached image directly
      return new Response(imageResponse.body, {
        status: imageResponse.status,
        headers: {
          'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache-Status': imageResponse.headers.get('X-Cache-Status') || 'UNKNOWN',
        }
      });
    }

    // Example 7: Conditional caching based on user type
    let userProfileResponse;
    if (userId) {
      // Authenticated users get personalized data with shorter cache
      userProfileResponse = await cachedFetch(`https://api.example.com/users/${userId}/profile`, {
        headers: {
          'Authorization': `Bearer ${request.cookies.get('auth-token')?.value}`,
        },
        next: {
          revalidate: 300,   // 5 minutes for user data
          expires: 1800,     // 30 minutes max stale
          tags: ['user-profile', `user-${userId}`],
          fetchCacheKeyPrefix: `user-${userId}` // User-specific cache
        }
      });
    } else {
      // Anonymous users get default profile with longer cache
      userProfileResponse = await cachedFetch('https://api.example.com/users/anonymous/profile', {
        next: {
          revalidate: 3600,  // 1 hour for anonymous data
          expires: 86400,    // 24 hours max stale
          tags: ['user-profile', 'anonymous']
        }
      });
    }

    // Collect all cache statuses for monitoring
    const cacheStatuses = {
      products: {
        status: productsResponse.headers.get('X-Cache-Status'),
        age: productsResponse.headers.get('X-Cache-Age'),
        expiresIn: productsResponse.headers.get('X-Cache-Expires-In')
      },
      tenantSettings: {
        status: tenantSettingsResponse.headers.get('X-Cache-Status'),
        age: tenantSettingsResponse.headers.get('X-Cache-Age')
      },
      route: {
        status: routeGraphQLResponse.headers.get('X-Cache-Status'),
        age: routeGraphQLResponse.headers.get('X-Cache-Age'),
        expiresIn: routeGraphQLResponse.headers.get('X-Cache-Expires-In')
      },
      userProfile: userProfileResponse ? {
        status: userProfileResponse.headers.get('X-Cache-Status'),
        age: userProfileResponse.headers.get('X-Cache-Age')
      } : null
    };

    // Apply routing logic based on cached route data
    if (routeData.data?.route?.redirect) {
      return NextResponse.redirect(new URL(routeData.data.route.redirect, request.url));
    }

    if (routeData.data?.route?.rewrite) {
      return NextResponse.rewrite(new URL(routeData.data.route.rewrite, request.url));
    }

    // Check rate limiting from cached GraphQL response
    const rateLimit = routeData.data?.route?.rateLimit;
    if (rateLimit && !rateLimit.allowed) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
          'Retry-After': '60'
        }
      });
    }

    // Pass comprehensive cache information to the client
    return NextResponse.next({
      headers: {
        'X-Cache-Summary': JSON.stringify(cacheStatuses),
        'X-Route-Cache-Status': routeGraphQLResponse.headers.get('X-Cache-Status') || 'UNKNOWN',
        'X-Products-Cache-Age': productsResponse.headers.get('X-Cache-Age') || '0',
        'X-Tenant-ID': tenantId,
      },
    });

  } catch (error) {
    console.error('Middleware error:', error);
    
    // Return error response with cache bypass indicator
    return NextResponse.next({
      headers: {
        'X-Cache-Error': 'true',
        'X-Error-Message': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
