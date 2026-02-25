// Shared popup utility functions

/**
 * Show an element by removing the hidden class.
 */
function showElement(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

/**
 * Hide an element by adding the hidden class.
 */
function hideElement(id) {
  document.getElementById(id)?.classList.add("hidden");
}

/**
 * Set text content of an element.
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Set progress bar width.
 */
function setProgress(id, percent) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

/**
 * Format a timestamp to a human-readable date string.
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Send a message to the service worker and get a response.
 */
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}
