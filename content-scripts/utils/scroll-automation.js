// Automatic scroll utilities for Instagram dialogs and pages

const SCROLL_STEP = 400;

// How many consecutive scrolls with no new items before we declare "done".
// Raised to 10 because Instagram lazy-loads in bursts — sometimes 3-4 scrolls
// pass before the next batch arrives from the API.
const MAX_STALE_RETRIES = 10;

// When we're at the very bottom of the container (within this many px) we count
// it as "at bottom" and treat it separately from a stale batch mid-list.
const BOTTOM_THRESHOLD_PX = 80;

/**
 * Auto-scroll a container until no new content loads.
 * @param {Element} container - Scrollable element
 * @param {Object} options
 * @param {Function} options.onScroll      - Called after each scroll
 * @param {Function} options.getItemCount  - Returns current number of loaded items
 * @param {Function} options.shouldCancel  - Returns true to abort
 * @param {number}   options.minDelay      - Min ms between scrolls
 * @param {number}   options.maxDelay      - Max ms between scrolls
 * @returns {Promise<void>}
 */
async function autoScroll(container, options = {}) {
  const {
    onScroll,
    getItemCount = () => 0,
    shouldCancel = () => false,
    minDelay = 1000,
    maxDelay = 2500,
  } = options;

  const { randomDelay, sleep } = window.__IGOrganizer.rateLimiter;

  let staleCount = 0;
  let previousCount = getItemCount();
  let consecutiveBottomHits = 0;

  while (staleCount < MAX_STALE_RETRIES) {
    if (shouldCancel()) break;

    const beforeScrollTop = container.scrollTop;
    container.scrollTop += SCROLL_STEP;

    if (onScroll) onScroll(container.scrollTop);

    // Wait for Instagram to load new rows
    await randomDelay(minDelay, maxDelay);

    const currentCount = getItemCount();

    if (currentCount !== previousCount) {
      // New items arrived — reset everything
      staleCount = 0;
      consecutiveBottomHits = 0;
      previousCount = currentCount;
      continue;
    }

    // Count didn't change. Check if we're genuinely at the end.
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const didntMove = Math.abs(container.scrollTop - beforeScrollTop) < 2;

    if (distanceFromBottom <= BOTTOM_THRESHOLD_PX || didntMove) {
      consecutiveBottomHits++;

      if (consecutiveBottomHits >= 3) {
        // Truly at the bottom and no new items in 3 tries — done
        break;
      }

      // Wait a bit longer before the next attempt — network might be slow
      await sleep(2000);
    } else {
      staleCount++;
    }
  }
}

/**
 * Wait for the scrollable container inside an Instagram dialog to appear
 * and have actual scrollable content.
 *
 * Retries up to `maxAttempts` times with a 600 ms gap so we don't miss it
 * when the follower list is still loading after the dialog opens.
 *
 * @param {number} maxAttempts
 * @returns {Promise<Element|null>}
 */
async function waitForScrollContainer(maxAttempts = 15) {
  const { sleep } = window.__IGOrganizer.rateLimiter;

  for (let i = 0; i < maxAttempts; i++) {
    const container = findScrollContainer();
    if (container) return container;
    await sleep(600);
  }

  return null;
}

/**
 * Find the scrollable container inside an Instagram dialog.
 * Checks both overflow:auto and overflow:scroll, and requires actual
 * scrollable content (scrollHeight clearly exceeds clientHeight).
 * @returns {Element|null}
 */
function findScrollContainer() {
  const dialog = document.querySelector('div[role="dialog"]');
  if (!dialog) return null;

  const candidates = dialog.querySelectorAll("div");
  for (const div of candidates) {
    const style = window.getComputedStyle(div);
    const isScrollable =
      style.overflowY === "auto" || style.overflowY === "scroll";
    // Require at least 50px of extra scrollable height to avoid false positives
    const hasContent = div.scrollHeight > div.clientHeight + 50;

    if (isScrollable && hasContent) {
      return div;
    }
  }

  return null;
}

/**
 * Scroll the main page (for saved posts).
 * @param {Object} options - Same options as autoScroll
 * @returns {Promise<void>}
 */
async function autoScrollPage(options = {}) {
  const {
    onScroll,
    getItemCount = () => 0,
    shouldCancel = () => false,
    minDelay = 1000,
    maxDelay = 2500,
  } = options;

  const { randomDelay, sleep } = window.__IGOrganizer.rateLimiter;

  let staleCount = 0;
  let previousCount = getItemCount();
  let consecutiveBottomHits = 0;

  while (staleCount < MAX_STALE_RETRIES) {
    if (shouldCancel()) break;

    const beforeY = window.scrollY;
    window.scrollBy(0, SCROLL_STEP);

    if (onScroll) onScroll(window.scrollY);

    await randomDelay(minDelay, maxDelay);

    const currentCount = getItemCount();

    if (currentCount !== previousCount) {
      staleCount = 0;
      consecutiveBottomHits = 0;
      previousCount = currentCount;
      continue;
    }

    const distanceFromBottom =
      document.documentElement.scrollHeight -
      window.scrollY -
      window.innerHeight;
    const didntMove = Math.abs(window.scrollY - beforeY) < 2;

    if (distanceFromBottom <= BOTTOM_THRESHOLD_PX || didntMove) {
      consecutiveBottomHits++;
      if (consecutiveBottomHits >= 3) break;
      await sleep(2000);
    } else {
      staleCount++;
    }
  }
}

// Expose to global scope
window.__IGOrganizer = window.__IGOrganizer || {};
window.__IGOrganizer.scroll = {
  autoScroll,
  autoScrollPage,
  findScrollContainer,
  waitForScrollContainer,
};
