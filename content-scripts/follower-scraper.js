// Follower list scraper - dialog scroll + DOM extraction
//
// Instagram uses a virtualized list: only ~13 rows exist in the DOM at any
// time. Old rows are removed as new ones scroll in. We must:
//   1. Harvest visible rows BEFORE each scroll (they disappear after).
//   2. Drive scroll via scrollTop (confirmed working in manual tests).
//   3. Stop when scrollTop stops advancing (true bottom).

(function () {
  if (window.__IGOrganizerFollowerScraperLoaded) return;
  window.__IGOrganizerFollowerScraperLoaded = true;

  const { dom, scroll, rateLimiter } = window.__IGOrganizer;

  let isScanning = false;
  let cancelScan = false;
  // Map<username, {username, fullName, profilePicUrl}>
  let collectedFollowers = new Map();
  // MutationObserver watching for dialog removal
  let dialogObserver = null;

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCAN_FOLLOWERS") {
      startFollowerScan()
        .then((followers) => sendResponse({ success: true, count: followers.length }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }
    if (message.type === "CANCEL_OPERATION") {
      cancelScan = true;
      sendResponse({ cancelled: true });
    }
  });

  // ── Main scan flow ─────────────────────────────────────────────────────────

  async function startFollowerScan() {
    if (isScanning) {
      // If already scanning, treat this as a cancel request
      cancelScan = true;
      return [];
    }

    isScanning = true;
    cancelScan = false;
    collectedFollowers = new Map();

    try {
      let dialog = document.querySelector('div[role="dialog"]');

      if (dialog) {
        // Dialog already open — scroll it back to the top and reuse it
        const container = scroll.findScrollContainer();
        if (container) container.scrollTop = 0;
        await rateLimiter.sleep(400);
      } else {
        // Open followers dialog
        const followersLink = document.querySelector('a[href*="/followers"]');
        if (!followersLink) {
          throw new Error("Could not find followers link. Please navigate to an Instagram profile page.");
        }
        followersLink.click();
        await rateLimiter.sleep(2000);

        try {
          dialog = await dom.waitForElement('div[role="dialog"]', 8000);
        } catch {
          throw new Error("Could not open followers dialog. Please open it manually and try again.");
        }
      }

      // Watch for dialog being closed externally — cancel scan if it disappears
      watchDialogRemoval(dialog);

      // Wait for the list to render and become scrollable
      const scrollContainer = await scroll.waitForScrollContainer(20);
      if (!scrollContainer) {
        extractFollowersFromDOM(dialog);
        throw new Error("Could not find scrollable container. Collected what was visible.");
      }

      sendProgress(0, "Scanning...");
      await scrollVirtualizedList(scrollContainer, dialog);

      // Final sweep
      extractFollowersFromDOM(dialog);

      if (cancelScan) {
        // Cancelled — send whatever was collected so far
        sendProgress(collectedFollowers.size, `Scan stopped. ${collectedFollowers.size} collected.`);
      } else {
        // Convert CDN profile pic URLs to base64 so popup can display them
        // (CDN URLs are signed and blocked cross-origin in the popup context,
        //  but fetch works fine here inside the Instagram page)
        sendProgress(collectedFollowers.size, "Loading profile pictures...");
        await convertProfilePicsToBase64();
      }

      const followers = Array.from(collectedFollowers.values());
      // Extract the username being scanned from the current page URL (/username/)
      const scannedUser = window.location.pathname.replace(/^\/|\/$/g, "").split("/")[0] || "";
      chrome.runtime.sendMessage({ type: "SCAN_FOLLOWERS_COMPLETE", followers, scannedUser });
      sendProgress(followers.length, "Complete!");
      return followers;

    } finally {
      isScanning = false;
      cancelScan = false;
      stopWatchingDialog();
    }
  }

  // ── Dialog removal watcher ─────────────────────────────────────────────────

  function watchDialogRemoval(dialog) {
    stopWatchingDialog();
    dialogObserver = new MutationObserver(() => {
      if (!document.body.contains(dialog)) {
        cancelScan = true;
        stopWatchingDialog();
      }
    });
    dialogObserver.observe(document.body, { childList: true, subtree: true });
  }

  function stopWatchingDialog() {
    if (dialogObserver) {
      dialogObserver.disconnect();
      dialogObserver = null;
    }
  }

  // ── Virtualized list scroll ────────────────────────────────────────────────

  async function scrollVirtualizedList(container, dialog) {
    // Confirmed working: direct scrollTop assignment advances the list.
    // Step size 400px — matches what manual test used successfully.
    const STEP = 400;
    // Stop after this many consecutive scrolls where scrollTop didn't advance.
    const MAX_NO_ADVANCE = 5;
    // Delay after each scroll — give Instagram time to render new rows.
    const DELAY_MS = 1500;

    let noAdvanceCount = 0;

    while (!cancelScan) {
      // Harvest what's currently visible BEFORE scrolling it away
      extractFollowersFromDOM(dialog);
      sendProgress(collectedFollowers.size, `Scanning... (${collectedFollowers.size} found)`);

      const before = container.scrollTop;
      container.scrollTop += STEP;

      // Wait for new rows to render
      await rateLimiter.sleep(DELAY_MS);

      const after = container.scrollTop;

      if (Math.abs(after - before) < 5) {
        noAdvanceCount++;
        if (noAdvanceCount >= MAX_NO_ADVANCE) break;
      } else {
        noAdvanceCount = 0;
      }
    }
  }

  // ── DOM extraction ─────────────────────────────────────────────────────────

  function extractFollowersFromDOM(dialog) {
    if (!dialog) return;

    const excluded = new Set(["explore", "reels", "stories", "p", "accounts",
                               "directory", "about", "static", ""]);

    // Each follower row has 2 links with the same href (avatar + username label).
    // Collect all links first, deduplicate by username, then extract data.
    const rowsByUsername = new Map(); // username → link element

    for (const link of dialog.querySelectorAll('a[href^="/"]')) {
      const href = link.getAttribute("href") || "";
      // Normalize: strip leading/trailing slashes, lowercase
      const username = href.replace(/^\/|\/$/g, "").toLowerCase();
      if (!username) continue;
      if (excluded.has(username)) continue;
      // Only valid Instagram username chars
      if (!/^[a-zA-Z0-9._-]+$/.test(username)) continue;
      // Skip system paths that may appear as hrefs
      if (username.includes("/")) continue;

      // Prefer the link that contains an img (avatar link) for profile pic
      if (!rowsByUsername.has(username) || link.querySelector("img")) {
        rowsByUsername.set(username, link);
      }
    }

    for (const [username, link] of rowsByUsername) {
      const existing = collectedFollowers.get(username);

      // Full name: search within the closest list-item-like ancestor
      let fullName = existing?.fullName || "";
      if (!fullName) {
        // Go up a few levels to find the row container with both avatar and name
        let ancestor = link.parentElement;
        for (let i = 0; i < 6 && ancestor; i++) {
          const spans = ancestor.querySelectorAll("span");
          for (const span of spans) {
            const txt = span.textContent?.trim();
            if (txt && txt !== username && txt.length > 1 && !/^\d+$/.test(txt)) {
              fullName = txt;
              break;
            }
          }
          if (fullName) break;
          ancestor = ancestor.parentElement;
        }
      }

      // Profile picture: prefer img inside this link, fallback to sibling link's img
      let profilePicUrl = existing?.profilePicUrl || "";
      if (!profilePicUrl) {
        const img = link.querySelector("img") ||
                    link.closest("div")?.querySelector("img");
        profilePicUrl = img?.src || "";
      }

      collectedFollowers.set(username, { username, fullName, profilePicUrl });
    }
  }

  // ── Profile pic base64 conversion ─────────────────────────────────────────

  async function convertProfilePicsToBase64() {
    const entries = Array.from(collectedFollowers.values())
      .filter(f => f.profilePicUrl && f.profilePicUrl.startsWith("http"));

    let done = 0;
    // Process in small parallel batches to keep it fast but not overwhelming
    const BATCH = 10;
    for (let i = 0; i < entries.length; i += BATCH) {
      if (cancelScan) break;
      const batch = entries.slice(i, i + BATCH);
      await Promise.all(batch.map(async (f) => {
        try {
          const resp = await fetch(f.profilePicUrl);
          if (!resp.ok) return;
          const blob = await resp.blob();
          const base64 = await blobToBase64(blob);
          collectedFollowers.set(f.username, { ...f, profilePicUrl: base64 });
        } catch (_) {
          // Keep the original URL as fallback — popup will show placeholder
        }
        done++;
      }));
      sendProgress(
        collectedFollowers.size,
        `Loading pictures... (${done}/${entries.length})`
      );
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sendProgress(count, status) {
    chrome.runtime.sendMessage({ type: "SCAN_FOLLOWERS_PROGRESS", count, status }).catch(() => {});
  }
})();
