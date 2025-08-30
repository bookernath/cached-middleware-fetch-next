// This is a test example showing how the package would be used
// Note: This won't actually run outside of a Vercel environment since getCache is only available there

import { cachedFetch } from './dist/index.mjs';

// Example 1: Basic cached fetch
async function example1() {
  console.log('Example 1: Basic cached fetch');
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts/1');
  const data = await response.json();
  console.log('Fetched data:', data);
}

// Example 2: With revalidation time
async function example2() {
  console.log('\nExample 2: Fetch with 60 second revalidation');
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts/2', {
    next: { revalidate: 60 }
  });
  const data = await response.json();
  console.log('Fetched data:', data);
}

// Example 3: No cache
async function example3() {
  console.log('\nExample 3: No-store (bypass cache)');
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts/3', {
    cache: 'no-store'
  });
  const data = await response.json();
  console.log('Fetched data:', data);
}

// Example 4: POST request with body
async function example4() {
  console.log('\nExample 4: POST request');
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    }),
  });
  const data = await response.json();
  console.log('Posted data:', data);
}

// Example 5: With custom cache key prefix
async function example5() {
  console.log('\nExample 5: Custom cache key prefix');
  const tenantId = 'tenant-123';
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts/5', {
    next: { 
      revalidate: 60,
      fetchCacheKeyPrefix: `tenant-${tenantId}`
    }
  });
  const data = await response.json();
  console.log('Fetched data with tenant prefix:', data);
}

// Example 6: SWR-style caching
async function example6() {
  console.log('\nExample 6: SWR caching with separate revalidate and expiry');
  const response = await cachedFetch('https://jsonplaceholder.typicode.com/posts/6', {
    next: {
      revalidate: 30,    // Consider stale after 30 seconds
      expires: 300       // But keep serving for up to 5 minutes
    }
  });
  const data = await response.json();
  console.log('Fetched data with SWR:', data);
  console.log('If cached and stale, fresh data is being fetched in the background');
}

console.log('Note: These examples will only work in a Vercel environment where getCache is available.');
console.log('In other environments, the package will fallback to regular fetch.\n');
