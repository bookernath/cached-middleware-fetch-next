import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from './src';

/**
 * Example middleware showing how to use cached-middleware-fetch-next
 */
export async function middleware(request: NextRequest) {
  const channelId = request.headers.get('x-bc-channel-id') || 'default';
  const pathname = request.nextUrl.pathname;

  try {
    // Example 1: Cache GraphQL queries
    const graphqlResponse = await cachedFetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
      },
      body: JSON.stringify({
        query: `
          query GetRoute($path: String!) {
            route(path: $path) {
              redirect
              node {
                __typename
                id
              }
            }
          }
        `,
        variables: { path: pathname },
      }),
      next: {
        revalidate: 1800, // Cache for 30 minutes
        tags: ['routes', `channel-${channelId}`],
      },
    });

    const data = await graphqlResponse.json();

    // Example 2: Cache REST API calls with no expiry
    const configResponse = await cachedFetch(
      `https://api.example.com/config/${channelId}`,
      {
        next: { revalidate: false }, // Cache indefinitely
      }
    );

    const config = await configResponse.json();

    // Example 3: Always fetch fresh data (no cache)
    const analyticsResponse = await cachedFetch(
      'https://analytics.example.com/track',
      {
        method: 'POST',
        body: JSON.stringify({ event: 'page_view', path: pathname }),
        cache: 'no-store', // Never cache analytics calls
      }
    );

    // Apply routing logic based on cached data
    if (data.route?.redirect) {
      return NextResponse.redirect(new URL(data.route.redirect, request.url));
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
