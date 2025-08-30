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

console.log('Note: These examples will only work in a Vercel environment where getCache is available.');
console.log('In other environments, the package will fallback to regular fetch.\n');
