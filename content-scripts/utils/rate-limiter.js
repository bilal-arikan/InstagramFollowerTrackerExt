// Rate limiting utility with random jitter

/**
 * Sleep for a random duration between min and max milliseconds.
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {Promise<void>}
 */
function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Sleep for an exact duration.
 * @param {number} ms - Duration in ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a rate-limited version of an async function.
 * @param {Function} fn - Async function to wrap
 * @param {number} minDelay - Minimum delay between calls in ms
 * @param {number} maxDelay - Maximum delay between calls in ms
 * @returns {Function}
 */
function createRateLimited(fn, minDelay = 1000, maxDelay = 3000) {
  let lastCall = 0;

  return async function (...args) {
    const now = Date.now();
    const elapsed = now - lastCall;
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    if (elapsed < delay) {
      await sleep(delay - elapsed);
    }

    lastCall = Date.now();
    return fn.apply(this, args);
  };
}

// Expose to global scope
window.__IGOrganizer = window.__IGOrganizer || {};
window.__IGOrganizer.rateLimiter = {
  randomDelay,
  sleep,
  createRateLimited,
};
