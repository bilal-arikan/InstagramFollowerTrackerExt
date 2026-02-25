// DOM helper utilities for content scripts

/**
 * Wait for an element to appear in the DOM.
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms (default 10000)
 * @param {Element} parent - Parent element to observe (default document.body)
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 10000, parent = document.body) {
  return new Promise((resolve, reject) => {
    const existing = parent.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);

    const observer = new MutationObserver(() => {
      const el = parent.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, { childList: true, subtree: true });
  });
}

/**
 * Wait for an element to be removed from the DOM.
 */
function waitForRemoval(selector, timeout = 10000, parent = document.body) {
  return new Promise((resolve, reject) => {
    if (!parent.querySelector(selector)) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for removal: ${selector}`));
    }, timeout);

    const observer = new MutationObserver(() => {
      if (!parent.querySelector(selector)) {
        clearTimeout(timer);
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(parent, { childList: true, subtree: true });
  });
}

/**
 * Query all matching elements and return as array.
 */
function queryAll(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Get text content of an element, trimmed.
 */
function getText(element) {
  return element?.textContent?.trim() || "";
}

// Expose to global scope for other content scripts
window.__IGOrganizer = window.__IGOrganizer || {};
window.__IGOrganizer.dom = {
  waitForElement,
  waitForRemoval,
  queryAll,
  getText,
};
