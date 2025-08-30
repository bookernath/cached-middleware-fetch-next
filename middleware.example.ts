// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from 'cached-middleware-fetch-next';

/**
 * Example middleware showing how to use cached-middleware-fetch-next
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  try {
    // Example 1: Cache REST API (Products) for 30 minutes with tags
    // SWR behavior: returns cached data immediately; refreshes in background via waitUntil()
    const productsResponse = await cachedFetch('https://api.example.com/products', {
      next: {
        revalidate: 1800, // 30 minutes (SWR)
        tags: ['products', 'catalog'],
      },
    });

    const products = await productsResponse.json();

    // Example 2: Cache REST API (Settings) indefinitely with tags
    // Use this when data changes rarely; invalidate manually by tag when needed
    const settingsResponse = await cachedFetch('https://api.example.com/settings', {
      next: { revalidate: false, tags: ['settings'] }, // no automatic revalidation
    });

    const settings = await settingsResponse.json();

    // Example 3: Always fetch fresh (no cache) for analytics/side-effect calls
    await cachedFetch('https://analytics.example.com/track', {
      method: 'POST',
      body: JSON.stringify({ event: 'page_view', path: pathname }),
      cache: 'no-store', // never cache
    });

    // Example 4: Simple GraphQL query with 30-minute caching and tags
    // SWR behavior applies here too via revalidate + waitUntil()
    const graphqlResponse = await cachedFetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetRoute($path: String!) {
            route(path: $path) {
              redirect
            }
          }
        `,
        variables: { path: pathname },
      }),
      next: {
        revalidate: 1800, // 30 minutes (SWR)
        tags: ['routes'],
      },
    });

    const routeData = await graphqlResponse.json();

    // Apply routing logic based on cached route data
    if (routeData.route?.redirect) {
      return NextResponse.redirect(new URL(routeData.route.redirect, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
